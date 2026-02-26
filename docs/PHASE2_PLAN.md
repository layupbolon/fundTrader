# Phase 2 实施计划：A股基金自动交易平台

## Context

Phase 1 MVP 已完成，包含 7 个实体、11 个 API 端点、2 个策略、回测引擎和 4 个定时任务。但代码审查发现了多个影响资金安全的关键 Bug（移动止盈失效、T+1 确认未实现、回测成本计算错误等），以及 API 无认证、测试覆盖率仅 47.73% 等问题。Phase 2 需要先修复这些安全隐患，再交付新功能。

---

## Sub-Phase 2A：交易安全修复（最高优先级）

> **在使用真实资金之前，必须完成本阶段所有内容。**

### 2A-1. 定投去重防护 [S]
- **问题**：调度器重启或重试时，同一天可能重复执行定投
- **方案**：在 `execute()` 前查询当天是否已有同策略的 PENDING/CONFIRMED 交易；`Strategy` 添加 `last_executed_at` 字段
- **文件**：`auto-invest.strategy.ts`、`strategy.entity.ts`

### 2A-2. 修复周定投 day_of_week 语义 [S]
- **问题**：配置用 1=周一~7=周日，但代码用 `getDay()` (0=周日~6=周六)，导致周几判断偏移
- **方案**：`time.util.ts` 添加 `configDayToJsDay()` 转换函数，修复 `auto-invest.strategy.ts` 和 `backtest.engine.ts`
- **文件**：`time.util.ts`、`auto-invest.strategy.ts`、`backtest.engine.ts`

### 2A-3. 修复净值同步时间 [S]
- **问题**：`sync-nav` 定时任务 09:00 执行，但基金净值通常 20:00 后才发布
- **方案**：主同步改为工作日 20:00，22:00 补充重试，保留 09:00 作为兜底
- **文件**：`scheduler.service.ts`

### 2A-4. 实现 T+1 确认流程 [L]
- **问题**：交易创建后状态永远停在 PENDING，从未确认份额和价格
- **方案**：
  - 新增定时任务 `confirm-pending-transactions`（每天 21:00 执行）
  - 查询超过 1 个工作日的 PENDING 交易，调用 `brokerService.getOrderStatus()` 获取确认信息
  - 更新交易状态为 CONFIRMED/FAILED，触发持仓更新
- **文件**：`scheduler.service.ts`、`trading.processor.ts`、`tiantian.service.ts`（新增 `getOrderStatus`）、`transaction.entity.ts`（新增 `confirmed_at` 等字段）

### 2A-5. T+1 确认后更新持仓 [M]
- **问题**：`Position` 的 `shares`、`avg_price`、`profit_rate` 在确认后从未更新
- **方案**：
  - 新建 `PositionService` 封装持仓更新逻辑
  - 买入确认：加权平均更新 `avg_price`、增加 `shares`
  - 卖出确认：按比例减少 `total_cost`、减少 `shares`
  - 新增每日 21:30 定时任务，用最新净值重算所有持仓的 `market_value` 和 `profit_rate`
- **依赖**：2A-4
- **文件**：`services/position/position.service.ts`（新建）、`trading.processor.ts`、`position.entity.ts`

### 2A-6. 修复移动止盈（getMaxProfitRate 桩函数）[M]
- **问题**：`getMaxProfitRate()` 直接返回当前 `profit_rate`，移动止盈完全失效
- **方案**：`Position` 添加 `max_profit_rate` 字段；持仓更新时同步更新历史最高收益率
- **依赖**：2A-5
- **文件**：`position.entity.ts`、`take-profit-stop-loss.strategy.ts`、`position.service.ts`

---

## Sub-Phase 2B：安全与 API 完善

### 2B-1. JWT 认证 [L]
- **问题**：所有 11 个 API 端点无任何认证
- **方案**：
  - 新建 `auth/` 模块：`@nestjs/passport` + `passport-jwt` + `bcrypt`
  - `POST /api/auth/login`、`POST /api/auth/register`
  - 全局 `JwtAuthGuard`，排除 `/auth/*` 和 `/api/docs`
  - Swagger 添加 `BearerAuth`
- **文件**：`src/auth/`（新建目录，含 module/controller/service/strategy/guard/dto）、`user.entity.ts`、`main.ts`、`app.module.ts`

### 2B-2. 用户管理 API [M]
- **依赖**：2B-1
- **方案**：`GET/PUT /api/users/me`、`PUT /api/users/me/broker-credentials`
- **文件**：`api/user.controller.ts`（新建）

### 2B-3. 完善 Strategy CRUD [S]
- **方案**：添加 `PUT /api/strategies/:id` 和 `DELETE /api/strategies/:id`
- **文件**：`controllers.ts`、`dto.ts`

### 2B-4. 列表分页 [S]
- **方案**：通用 `PaginationDto`（page/limit）+ `PaginatedResponse<T>` 包装器，应用到所有列表端点
- **文件**：`dto/pagination.dto.ts`（新建）、`controllers.ts`、`shared/src/types.ts`

### 2B-5. Strategy.config 运行时校验 [M]
- **问题**：`config` 字段类型为 `any`，无运行时校验
- **方案**：按策略类型定义 `AutoInvestConfigDto`、`TakeProfitConfigDto`、`StopLossConfigDto`，用 `class-validator` 校验
- **文件**：`dto/strategy-config.dto.ts`（新建）、`dto.ts`、`controllers.ts`、`shared/src/types.ts`

### 2B-6. 持久化回测结果 [S]
- **问题**：`BacktestResult` 实体已定义但从未写入数据库
- **方案**：回测完成后保存到数据库，新增 `GET /api/backtest` 和 `GET /api/backtest/:id`
- **文件**：`controllers.ts`、`backtest-result.entity.ts`

---

## Sub-Phase 2C：回测引擎修复 & 新策略

### 2C-1. 修复回测成本计算 [M]
- **问题**：`calculateAvgCost()` 用历史净值平均值代替实际加权成本，导致回测结果不准确
- **方案**：回测状态新增 `totalCost` 字段，买入时累加，卖出时按比例减少，`avgCost = totalCost / shares`
- **文件**：`backtest.engine.ts`

### 2C-2. 网格交易策略 [L]
- **依赖**：2B-5、2C-1
- **配置**：`price_high`/`price_low`（网格范围）、`grid_count`（网格数量）、`amount_per_grid`（每格金额）
- **逻辑**：净值跌破未买入网格线→买入；净值涨破已买入网格线→卖出
- **文件**：`core/strategy/grid-trading.strategy.ts`（新建）、`backtest.engine.ts`、`shared/src/enums.ts`、`trading.processor.ts`

### 2C-3. 动态再平衡策略 [L]
- **依赖**：2B-5、2C-1
- **配置**：`target_allocations`（多基金目标比例）、`rebalance_threshold`（偏离阈值）、`frequency`
- **逻辑**：计算当前配比，偏离超阈值则卖出超配、买入欠配
- **文件**：`core/strategy/rebalancing.strategy.ts`（新建）、`backtest.engine.ts`、`trading.processor.ts`

---

## Sub-Phase 2D：测试覆盖率提升至 80%

> 穿插在各阶段同步进行，每完成一个功能模块即补充测试。

| 测试目标 | 复杂度 | 文件 |
|---------|--------|------|
| API 控制器 | M | `api/__tests__/strategy.controller.test.ts` 等 5 个 |
| 调度器 & 处理器 | M | `scheduler/__tests__/` 3 个文件 |
| 交易平台服务 | M | `broker/__tests__/tiantian.service.test.ts` |
| 通知渠道 | S | `notify/__tests__/telegram.service.test.ts`、`feishu.service.test.ts` |
| 认证模块 | M | `auth/__tests__/` 3 个文件 |

---

## Sub-Phase 2E：Web 前端基础

### 2E-1. 前端项目初始化 [M]
- **依赖**：2B-1、2B-4
- **技术栈**：Vite + React 19 + TypeScript + Tailwind CSS
- **文件**：`packages/frontend/`（package.json、vite.config.ts、src/main.tsx、api/client.ts、pages/Login.tsx）

### 2E-2. 仪表盘页面 [L]
- 投资组合概览（总市值、总盈亏、收益率）
- 持仓列表 + 实时收益率
- 最近交易记录
- 活跃策略状态

### 2E-3. 策略管理页面 [M]
- 策略列表（启用/禁用）
- 新建/编辑/删除策略表单
- 触发回测并展示结果

---

## 依赖关系 & 实施顺序

```
第 1 轮 (交易安全，可并行):
  2A-1 定投去重 ─────────────────┐
  2A-2 day_of_week 修复 ─────────┤
  2A-3 净值同步时间修复 ─────────┤
  2A-4 T+1 确认流程 ─────────────┤
                                  ├─→ 第 2 轮
第 2 轮 (持仓 & 止盈):            │
  2A-5 持仓更新 ←── 2A-4         │
  2A-6 移动止盈修复 ←── 2A-5     │
  2C-1 回测成本修复 (独立)        │
  2B-6 持久化回测结果 (独立)      │
                                  ├─→ 第 3 轮
第 3 轮 (安全 & API):             │
  2B-1 JWT 认证                   │
  2B-3 Strategy CRUD              │
  2B-4 分页                       │
  2B-5 Config 校验                │
                                  ├─→ 第 4 轮
第 4 轮 (新功能):                 │
  2B-2 用户管理 ←── 2B-1         │
  2C-2 网格交易 ←── 2B-5, 2C-1   │
  2C-3 动态再平衡 ←── 2B-5, 2C-1 │
  2D-* 测试 (穿插进行)            │
                                  ├─→ 第 5 轮
第 5 轮 (前端):
  2E-1 前端初始化 ←── 2B-1
  2E-2 仪表盘 ←── 2E-1
  2E-3 策略管理 ←── 2E-2
```

---

## 验证方式

1. **交易安全**：模拟 T+1 确认流程，验证持仓正确更新；构造重复调度场景，验证去重
2. **API 安全**：无 Token 请求返回 401；非法 config 返回 400
3. **回测准确性**：手动计算已知 NAV 序列的预期收益，对比回测结果
4. **测试覆盖率**：`pnpm test:cov` 达到 80%+
5. **前端**：登录→仪表盘→策略创建→回测完整流程可用
