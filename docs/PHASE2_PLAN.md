# Phase 2 实施计划：A股基金自动交易平台

## Context

Phase 1 MVP 已完成，包含 7 个实体、11 个 API 端点、2 个策略、回测引擎和 4 个定时任务。但代码审查发现了多个影响资金安全的关键 Bug（移动止盈失效、T+1 确认未实现、回测成本计算错误等），以及 API 无认证、测试覆盖率仅 47.73% 等问题。Phase 2 需要先修复这些安全隐患，再交付新功能。

---

## 实施进度总览

| 轮次 | 状态 | 任务 |
|------|------|------|
| 第 1 轮 | ✅ 已完成 | 2A-1, 2A-2, 2A-3, 2A-4 |
| 第 2 轮 | ✅ 已完成 | 2A-5, 2A-6, 2C-1, 2B-6 |
| 第 3 轮 | ✅ 已完成 | 2B-1, 2B-3, 2B-4, 2B-5 |
| 第 4 轮 | ⬜ 待开始 | 2B-2, 2C-2, 2C-3, 2D-* |
| 第 5 轮 | ⬜ 待开始 | 2E-1, 2E-2, 2E-3 |

**当前测试状态**: 14 suites / 149 tests 全部通过

---

## Sub-Phase 2A：交易安全修复（最高优先级）

> **在使用真实资金之前，必须完成本阶段所有内容。**

### ✅ 2A-1. 定投去重防护 [S] — 已完成 (2026-02-27)
- **问题**：调度器重启或重试时，同一天可能重复执行定投
- **方案**：在 `execute()` 前查询当天是否已有同策略的 PENDING/CONFIRMED 交易；`Strategy` 添加 `last_executed_at` 字段
- **修改文件**：`auto-invest.strategy.ts`、`strategy.entity.ts`、`auto-invest.strategy.test.ts`
- **变更详情**：
  - `strategy.entity.ts`：新增 `last_executed_at` 可空时间戳字段
  - `auto-invest.strategy.ts`：`execute()` 方法开头增加 `createQueryBuilder` 查重逻辑，存在今日交易则跳过；执行成功后调用 `strategyRepository.update()` 更新 `last_executed_at`
  - 测试：新增 3 个测试用例（跳过重复、更新时间戳、正常执行）

### ✅ 2A-2. 修复周定投 day_of_week 语义 [S] — 已完成 (2026-02-27)
- **问题**：配置用 1=周一~7=周日，但代码用 `getDay()` (0=周日~6=周六)，导致周日(7)永远无法匹配
- **方案**：`time.util.ts` 添加 `configDayToJsDay()` 转换函数（`configDay % 7`），修复 `auto-invest.strategy.ts` 和 `backtest.engine.ts`
- **修改文件**：`time.util.ts`、`auto-invest.strategy.ts`、`backtest.engine.ts`、`time.util.test.ts`
- **变更详情**：
  - `time.util.ts`：新增 `configDayToJsDay(configDay: number): number` 函数
  - `auto-invest.strategy.ts`：周定投比较改用 `configDayToJsDay()`
  - `backtest.engine.ts`：回测周定投比较改用 `configDayToJsDay()`
  - 测试：新增 5 个测试用例覆盖 Mon(1→1) 到 Sun(7→0)

### ✅ 2A-3. 修复净值同步时间 [S] — 已完成 (2026-02-27)
- **问题**：`sync-nav` 定时任务 09:00 执行，但基金净值通常 20:00 后才发布
- **方案**：主同步改为工作日 20:00，22:00 补充重试，保留 09:00 作为兜底
- **修改文件**：`scheduler.service.ts`
- **变更详情**：
  - 原 `0 9 * * *`（每天 09:00）拆分为 3 个 workday-only 任务：
    - `0 20 * * 1-5`：主同步（NAV 通常 18:00-20:00 发布）
    - `0 22 * * 1-5`：补充重试（晚发布基金）
    - `0 9 * * 1-5`：次日兜底同步

### ✅ 2A-4. 实现 T+1 确认流程 [L] — 已完成 (2026-02-27)
- **问题**：交易创建后状态永远停在 PENDING，从未确认份额和价格
- **修改文件**：`transaction.entity.ts`、`trading.processor.ts`、`tiantian.service.ts`、`scheduler.service.ts`
- **新增文件**：`scheduler/__tests__/trading.processor.test.ts`
- **变更详情**：
  - `transaction.entity.ts`：新增 `confirmed_shares`（decimal 15,4）和 `confirmed_price`（decimal 10,4）可空字段
  - `trading.processor.ts`：
    - 构造函数新增 `Transaction` 仓库和 `NotifyService` 注入
    - 新增 `@Process('confirm-pending-transactions')` 处理方法：查询超过 1 天的 PENDING 交易，调用 `brokerService.getOrderStatus()` 获取状态，更新为 CONFIRMED/FAILED 并发送通知
  - `tiantian.service.ts`：新增 `getOrderStatus(orderId)` 方法和 `OrderStatus` 接口，通过 Puppeteer 查询订单详情页
  - `scheduler.service.ts`：新增 `0 21 * * 1-5` cron job（工作日 21:00 确认交易）
  - 测试：新增 5 个测试用例（确认成功、标记失败、跳过无订单号、错误处理、跳过仍 PENDING）

### ✅ 2A-5. T+1 确认后更新持仓 [M] — 已完成 (2026-02-28)
- **问题**：`Position` 的 `shares`、`avg_price`、`profit_rate` 在确认后从未更新
- **方案**：
  - 新建 `PositionService` 封装持仓更新逻辑
  - 买入确认：加权平均更新 `avg_price`、增加 `shares`
  - 卖出确认：按比例减少 `total_cost`、减少 `shares`
  - 新增每日 21:30 定时任务，用最新净值重算所有持仓的 `market_value` 和 `profit_rate`
- **依赖**：2A-4 ✅
- **文件**：`services/position/position.service.ts`（新建）、`trading.processor.ts`、`scheduler.service.ts`、`app.module.ts`
- **变更详情**：
  - `position.service.ts`（新建）：`updatePositionOnBuy()`（加权平均更新，不存在则自动创建）、`updatePositionOnSell()`（按 avg_price 比例减少成本，全卖时归零）、`refreshAllPositionValues()`（用最新 NAV 重算 current_value/profit/profit_rate）
  - `trading.processor.ts`：注入 `PositionService`，在 CONFIRMED 分支中根据 `transaction.type` 调用 `updatePositionOnBuy/Sell`；新增 `@Process('refresh-position-values')` 处理器
  - `scheduler.service.ts`：新增 `30 21 * * 1-5` cron job（工作日 21:30 刷新持仓市值）
  - `app.module.ts`：注册 `PositionService`
  - 测试：新增 `position.service.test.ts`（11 个用例）、更新 `trading.processor.test.ts`（+3 个用例）

### ✅ 2A-6. 修复移动止盈（getMaxProfitRate 桩函数）[M] — 已完成 (2026-02-28)
- **问题**：`getMaxProfitRate()` 直接返回当前 `profit_rate`，移动止盈完全失效
- **方案**：`Position` 添加 `max_profit_rate` 字段；持仓更新时同步更新历史最高收益率
- **依赖**：2A-5 ✅
- **文件**：`position.entity.ts`、`take-profit-stop-loss.strategy.ts`、`position.service.ts`
- **变更详情**：
  - `position.entity.ts`：新增 `max_profit_rate` 列（`decimal(10,4)`, default 0）
  - `take-profit-stop-loss.strategy.ts`：`getMaxProfitRate()` 改为返回 `position.max_profit_rate`
  - `position.service.ts`：`refreshAllPositionValues()` 中计算完 `profit_rate` 后自动更新 `max_profit_rate`（只升不降）
  - 测试：更新所有 Position mock 添加 `max_profit_rate` 字段，新增 max_profit_rate 更新/保持测试用例

---

## Sub-Phase 2B：安全与 API 完善

### ✅ 2B-1. JWT 认证 [L] — 已完成 (2026-02-28)
- **问题**：所有 11 个 API 端点无任何认证
- **方案**：
  - 新建 `auth/` 模块：`@nestjs/passport` + `passport-jwt` + `bcrypt`
  - `POST /api/auth/register`、`POST /api/auth/login`（@Public 豁免）
  - 全局 `JwtAuthGuard`（APP_GUARD），@Public() 装饰器豁免认证端点
  - `@CurrentUser()` 参数装饰器替代 `@Query('user_id')`
  - Swagger 添加 `BearerAuth` 和 `auth` 标签
- **文件**：`src/auth/`（新建目录，含 module/controller/service/jwt.strategy/jwt-auth.guard/public.decorator/user.decorator/dto）、`user.entity.ts`（新增 password_hash）、`main.ts`、`app.module.ts`、`controllers.ts`、`dto.ts`
- **变更详情**：
  - `auth.module.ts`：PassportModule + JwtModule（异步注册，从 env 读 JWT_SECRET，7 天过期）
  - `auth.service.ts`：register（bcrypt.hash + save + sign JWT）、login（bcrypt.compare + sign JWT）、validateUser
  - `auth.controller.ts`：@Public() + POST /auth/register + POST /auth/login
  - `jwt.strategy.ts`：从 Bearer header 提取 token，validate 返回 { id, username }
  - `jwt-auth.guard.ts`：继承 AuthGuard('jwt')，检查 @Public() 元数据
  - `user.entity.ts`：新增 password_hash（nullable，兼容现有用户）
  - `app.module.ts`：导入 AuthModule，注册 APP_GUARD → JwtAuthGuard
  - `controllers.ts`：所有 Controller 添加 @ApiBearerAuth()，user_id 改从 @CurrentUser() 获取
  - `dto.ts`：CreateStrategyDto 移除 user_id 字段
  - `.env.example`：新增 JWT_SECRET
  - 测试：auth.service.test.ts（7 用例）、jwt-auth.guard.test.ts（5 用例）

### ⬜ 2B-2. 用户管理 API [M] — 待开始
- **依赖**：2B-1
- **方案**：`GET/PUT /api/users/me`、`PUT /api/users/me/broker-credentials`
- **文件**：`api/user.controller.ts`（新建）

### ✅ 2B-3. 完善 Strategy CRUD [S] — 已完成 (2026-02-28)
- **方案**：添加 `PUT /api/strategies/:id` 和 `DELETE /api/strategies/:id`，含权限校验和 config 校验
- **文件**：`controllers.ts`、`dto.ts`
- **变更详情**：
  - `dto.ts`：新增 UpdateStrategyDto（name/config/enabled 均可选，type/fund_code 不可更新）
  - `controllers.ts`：PUT（查 → 校权限 → 校 config → 更新）、DELETE（查 → 校权限 → 硬删除）
  - toggle 端点也增加权限校验，使用 NotFoundException/ForbiddenException 替代 Error
  - 测试：strategy-controller.test.ts（13 用例：findAll/create/update/remove/toggle）

### ✅ 2B-4. 列表分页 [S] — 已完成 (2026-02-28)
- **方案**：通用 `PaginationDto`（page/limit）+ `PaginatedResponse<T>` + `createPaginatedResponse()` 工厂，应用到 5 个列表端点
- **文件**：`pagination.dto.ts`（新建）、`paginated-response.ts`（新建）、`controllers.ts`
- **变更详情**：
  - `PaginationDto`：page（默认 1，min 1）、limit（默认 20，min 1，max 100），@Type(() => Number) 处理 query string
  - `createPaginatedResponse()`：计算 totalPages，返回 { data, total, page, limit, totalPages }
  - 5 个列表端点改用 findAndCount + skip/take + createPaginatedResponse()
  - 测试：pagination.test.ts（5 用例：空数据/单条/整除/非整除/分页参数）

### ✅ 2B-5. Strategy.config 运行时校验 [M] — 已完成 (2026-02-28)
- **问题**：`config` 字段类型为 `any`，无运行时校验
- **方案**：按策略类型定义 DTO 类，用 `class-validator` + `class-transformer` 校验
- **文件**：`dto/strategy-config/`（新建目录）、`controllers.ts`
- **变更详情**：
  - `auto-invest-config.dto.ts`：amount（min 10）、frequency（InvestFrequency 枚举）、day_of_week（1-7，WEEKLY 时必填）、day_of_month（1-31，MONTHLY 时必填）、start_date/end_date（可选）
  - `take-profit-config.dto.ts`：TakeProfitPartDto（target_rate, sell_ratio, trailing_stop 可选）、StopLossPartDto（max_drawdown ≤ 0, sell_ratio）、TakeProfitStopLossConfigDto（@IsDefined + @ValidateNested）
  - `validate-strategy-config.ts`：根据 type 选择 DTO 类，plainToInstance + validate，错误时抛 BadRequestException
  - 在 StrategyController.create() 和 update() 中调用校验
  - 测试：validate-strategy-config.test.ts（11 用例：合法/非法 config、未知 type）

### ✅ 2B-6. 持久化回测结果 [S] — 已完成 (2026-02-28)
- **问题**：`BacktestResult` 实体已定义但从未写入数据库
- **方案**：回测完成后保存到数据库，新增 `GET /api/backtest` 和 `GET /api/backtest/:id`
- **文件**：`controllers.ts`
- **变更详情**：
  - `BacktestController` 注入 `BacktestResult` Repository
  - `POST /api/backtest`：运行回测后自动保存结果到 `backtest_results` 表
  - `GET /api/backtest`：查询回测结果列表（按 `created_at` DESC）
  - `GET /api/backtest/:id`：查询单个回测结果详情
  - 所有新端点均配置 `@ApiOperation`、`@ApiResponse`、`@ApiParam` Swagger 装饰器

---

## Sub-Phase 2C：回测引擎修复 & 新策略

### ✅ 2C-1. 修复回测成本计算 [M] — 已完成 (2026-02-28)
- **问题**：`calculateAvgCost()` 用历史净值平均值代替实际加权成本，导致回测结果不准确
- **方案**：回测状态新增 `totalCost` 字段，买入时累加，卖出时按比例减少，`avgCost = totalCost / shares`
- **文件**：`backtest.engine.ts`
- **变更详情**：
  - 回测状态从 `{ cash, shares }` 扩展为 `{ cash, shares, totalCost }`
  - 买入执行后 `totalCost += signal.amount`
  - 卖出执行后 `totalCost -= totalCost * sellRatio`（按卖出比例减少）
  - `calculateAvgCost()` 改为 `totalCost / shares`，移除 `historicalNav` 参数
  - `evaluateStrategy`、`evaluateTakeProfit`、`evaluateStopLoss` 签名统一移除 `historicalNav` 参数
  - 测试：新增 3 个用例验证真实加权成本计算

### ⬜ 2C-2. 网格交易策略 [L] — 待开始
- **依赖**：2B-5、2C-1
- **配置**：`price_high`/`price_low`（网格范围）、`grid_count`（网格数量）、`amount_per_grid`（每格金额）
- **逻辑**：净值跌破未买入网格线→买入；净值涨破已买入网格线→卖出
- **文件**：`core/strategy/grid-trading.strategy.ts`（新建）、`backtest.engine.ts`、`shared/src/enums.ts`、`trading.processor.ts`

### ⬜ 2C-3. 动态再平衡策略 [L] — 待开始
- **依赖**：2B-5、2C-1
- **配置**：`target_allocations`（多基金目标比例）、`rebalance_threshold`（偏离阈值）、`frequency`
- **逻辑**：计算当前配比，偏离超阈值则卖出超配、买入欠配
- **文件**：`core/strategy/rebalancing.strategy.ts`（新建）、`backtest.engine.ts`、`trading.processor.ts`

---

## Sub-Phase 2D：测试覆盖率提升至 80%

> 穿插在各阶段同步进行，每完成一个功能模块即补充测试。

| 测试目标 | 复杂度 | 状态 | 文件 |
|---------|--------|------|------|
| 工具函数 (time/crypto) | S | ✅ 已完成 | `utils/__tests__/` 2 个 |
| 定投策略 | M | ✅ 已完成 | `strategy/__tests__/auto-invest.strategy.test.ts` |
| 止盈止损策略 | M | ✅ 已完成 | `strategy/__tests__/take-profit-stop-loss.strategy.test.ts` |
| 基金数据服务 | M | ✅ 已完成 | `data/__tests__/fund-data.service.test.ts` |
| 通知服务 | S | ✅ 已完成 | `notify/__tests__/notify.service.test.ts` |
| 回测引擎 | M | ✅ 已完成 | `backtest/__tests__/backtest.engine.test.ts` |
| 交易处理器 | M | ✅ 已完成 | `scheduler/__tests__/trading.processor.test.ts` |
| API 控制器 | M | ✅ 部分完成 | `api/__tests__/strategy-controller.test.ts`、`api/__tests__/pagination.test.ts`、`api/dto/strategy-config/__tests__/` |
| 调度器服务 | S | ⬜ 待开始 | `scheduler/__tests__/scheduler.service.test.ts` |
| 数据同步处理器 | S | ⬜ 待开始 | `scheduler/__tests__/data-sync.processor.test.ts` |
| 交易平台服务 | M | ⬜ 待开始 | `broker/__tests__/tiantian.service.test.ts` |
| 通知渠道 | S | ⬜ 待开始 | `notify/__tests__/telegram.service.test.ts`、`feishu.service.test.ts` |
| 认证模块 | M | ✅ 已完成 | `auth/__tests__/` 2 个文件 |
| PositionService | M | ✅ 已完成 | `position/__tests__/position.service.test.ts` |

---

## Sub-Phase 2E：Web 前端基础

### ⬜ 2E-1. 前端项目初始化 [M] — 待开始
- **依赖**：2B-1、2B-4
- **技术栈**：Vite + React 19 + TypeScript + Tailwind CSS
- **文件**：`packages/frontend/`（package.json、vite.config.ts、src/main.tsx、api/client.ts、pages/Login.tsx）

### ⬜ 2E-2. 仪表盘页面 [L] — 待开始
- 投资组合概览（总市值、总盈亏、收益率）
- 持仓列表 + 实时收益率
- 最近交易记录
- 活跃策略状态

### ⬜ 2E-3. 策略管理页面 [M] — 待开始
- 策略列表（启用/禁用）
- 新建/编辑/删除策略表单
- 触发回测并展示结果

---

## 依赖关系 & 实施顺序

```
第 1 轮 (交易安全，可并行): ✅ 已完成
  ✅ 2A-1 定投去重
  ✅ 2A-2 day_of_week 修复
  ✅ 2A-3 净值同步时间修复
  ✅ 2A-4 T+1 确认流程
                                 ├─→ 第 2 轮
第 2 轮 (持仓 & 止盈):            │  ✅ 已完成
  ✅ 2A-5 持仓更新 ←── 2A-4 ✅  │
  ✅ 2A-6 移动止盈修复 ←── 2A-5 ✅│
  ✅ 2C-1 回测成本修复 (独立)    │
  ✅ 2B-6 持久化回测结果 (独立)  │
                                 ├─→ 第 3 轮
第 3 轮 (安全 & API):             │  ✅ 已完成
  ✅ 2B-1 JWT 认证                 │
  ✅ 2B-3 Strategy CRUD            │
  ✅ 2B-4 分页                     │
  ✅ 2B-5 Config 校验              │
                                 ├─→ 第 4 轮
第 4 轮 (新功能):                 │  ⬜ 待开始
  2B-2 用户管理 ←── 2B-1         │
  2C-2 网格交易 ←── 2B-5, 2C-1   │
  2C-3 动态再平衡 ←── 2B-5, 2C-1 │
  2D-* 测试 (穿插进行)            │
                                 ├─→ 第 5 轮
第 5 轮 (前端):                      ⬜ 待开始
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
