# 功能缺口开发文档（2026-03-06）

## 1. 开发目标

基于 `docs/FUNCTION_GAP_ANALYSIS.md` 的推荐顺序，本次交付聚焦 P0 + P1 的可用性闭环：

1. 统一前后端策略契约（枚举 + 配置结构）
2. 补齐手动交易创建接口（`POST /transactions`）
3. 补齐分析快照调度闭环
4. 修复健康检查公开访问与路径一致性
5. 增加运维手动触发入口（净值同步 / 持仓刷新 / 快照生成）

不在本次范围：P2 订单生命周期增强（撤单、状态轮询、批量操作）。

---

## 2. 变更总览

### 2.1 契约统一（P0）

#### 2.1.1 策略类型统一为 `TAKE_PROFIT_STOP_LOSS`

- 修改文件：`packages/backend/src/models/enums.ts`
- 结果：后端 `StrategyType` 从 `TAKE_PROFIT`/`STOP_LOSS` 合并为 `TAKE_PROFIT_STOP_LOSS`

#### 2.1.2 定投频率值统一为大写

- 修改文件：`packages/backend/src/models/enums.ts`
- 结果：`InvestFrequency` 从 `daily/weekly/monthly` 改为 `DAILY/WEEKLY/MONTHLY`，对齐共享类型与前端提交

#### 2.1.3 止盈止损配置校验映射统一

- 修改文件：`packages/backend/src/api/dto/strategy-config/validate-strategy-config.ts`
- 结果：`StrategyType.TAKE_PROFIT_STOP_LOSS -> TakeProfitStopLossConfigDto`

#### 2.1.4 策略执行逻辑适配嵌套配置

- 修改文件：`packages/backend/src/scheduler/trading.processor.ts`
- 结果：
  - 查询策略类型改为 `TAKE_PROFIT_STOP_LOSS`
  - 从配置中读取：
    - `config.take_profit`
    - `config.stop_loss`
  - 分别执行止盈/止损判定与卖出

#### 2.1.5 回测引擎适配合并策略类型

- 修改文件：`packages/backend/src/core/backtest/backtest.engine.ts`
- 结果：
  - `evaluateStrategy` 新分支：`TAKE_PROFIT_STOP_LOSS`
  - 新增 `evaluateTakeProfitStopLoss`：先评估止盈，再评估止损

#### 2.1.6 前端止盈止损表单与类型对齐

- 修改文件：
  - `packages/frontend/src/strategies/TakeProfitStopLossForm.tsx`
  - `packages/frontend/src/api/types.ts`
- 结果：前端提交结构由扁平字段改为嵌套结构：

```ts
{
  take_profit: {
    target_rate: number,
    sell_ratio: number,
    trailing_stop?: number,
  },
  stop_loss: {
    max_drawdown: number,
    sell_ratio: number,
  }
}
```

---

### 2.2 手动交易创建闭环（P0）

#### 2.2.1 新增交易创建 DTO

- 修改文件：`packages/backend/src/api/dto.ts`
- 新增：`CreateTransactionDto`
  - `fund_code`
  - `type` (`BUY` | `SELL`)
  - `amount`
  - `shares?`（卖出可选）

#### 2.2.2 新增接口：`POST /api/transactions`

- 修改文件：`packages/backend/src/api/controllers.ts`
- 控制器：`TransactionController.create`
- 核心流程：
  1. 校验基金存在
  2. 黑名单检查
  3. 交易限额检查
  4. 买入时额外检查持仓比例限制
  5. 判断是否需要大额确认
  6. 需要确认：创建待确认交易 + 发送确认通知
  7. 无需确认：直接调用 broker 买/卖，写入 `PENDING` 交易记录
  8. 写入操作审计日志（`OperationLogService`）

#### 2.2.3 前端交易 payload 扩展

- 修改文件：`packages/frontend/src/api/types.ts`
- 变更：`CreateTransactionPayload` 新增 `shares?: number`

---

### 2.3 快照调度闭环（P1）

#### 2.3.1 新增快照定时任务

- 修改文件：`packages/backend/src/scheduler/scheduler.service.ts`
- 新增任务：
  - 队列：`data-sync`
  - 任务：`create-snapshot`
  - Cron：`35 22 * * 1-5`（工作日 22:35）

---

### 2.4 健康检查可用性与路径一致性（P1）

#### 2.4.1 健康检查公开访问

- 修改文件：`packages/backend/src/core/monitoring/health.controller.ts`
- 变更：为 `GET /health` 添加 `@Public()`，绕过全局 JWT Guard

#### 2.4.2 启动日志健康检查地址修正

- 修改文件：`packages/backend/src/main.ts`
- 变更：日志展示地址由 `/health` 改为 `/api/health`

---

### 2.5 运维手动入口（P1）

#### 2.5.1 新增运维控制器

- 修改文件：`packages/backend/src/api/controllers.ts`
- 新增控制器：`OperationsController` (`/api/operations`)

新增接口：

1. `POST /api/operations/sync-nav`
2. `POST /api/operations/refresh-positions`
3. `POST /api/operations/create-snapshot`

共同特性：
- 立即投递队列任务
- 返回 `job_id`
- 记录操作日志（审计）

#### 2.5.2 注册到应用模块

- 修改文件：`packages/backend/src/app.module.ts`
- 变更：将 `OperationsController` 加入 controllers 列表

---

## 3. 关键接口说明

### 3.1 创建交易

- 方法：`POST`
- 路径：`/api/transactions`
- 鉴权：需要 JWT

请求示例：

```json
{
  "fund_code": "110011",
  "type": "BUY",
  "amount": 1000
}
```

响应示例（无需确认）：

```json
{
  "id": "uuid",
  "status": "PENDING",
  "requires_confirmation": false
}
```

响应示例（需要确认）：

```json
{
  "id": "uuid",
  "status": "PENDING",
  "requires_confirmation": true
}
```

### 3.2 手动触发任务

- `POST /api/operations/sync-nav`
- `POST /api/operations/refresh-positions`
- `POST /api/operations/create-snapshot`

响应结构：

```json
{
  "message": "...",
  "job_id": "..."
}
```

---

## 4. 测试与构建结果

执行时间：2026-03-06

### 4.1 后端针对性测试

命令：

```bash
pnpm --filter @fundtrader/backend test -- \
  src/api/dto/strategy-config/__tests__/validate-strategy-config.test.ts \
  src/api/__tests__/transaction-controller.test.ts \
  src/scheduler/__tests__/scheduler.service.test.ts \
  src/scheduler/__tests__/trading.processor.test.ts \
  src/core/backtest/__tests__/backtest.engine.test.ts
```

结果：`5 passed, 67 passed`

### 4.2 构建验证

- `pnpm --filter @fundtrader/backend build` 通过
- `pnpm --filter @fundtrader/frontend build` 通过

---

## 5. 兼容性说明

1. 策略配置契约已切换到嵌套结构，旧扁平结构不再作为主契约。
2. `InvestFrequency` 使用大写值，旧数据若为小写，建议通过一次性数据修复脚本统一。
3. 手动卖出若未传 `shares`，当前按持仓 `avg_price` 估算份额；如需更高精度可在后续接入实时净值估算。

---

## 6. 尚未覆盖项（后续阶段）

对应分析文档中的 P2：

1. 撤单接口
2. 订单状态轮询与重试策略增强
3. 批量查询/批量撤单

