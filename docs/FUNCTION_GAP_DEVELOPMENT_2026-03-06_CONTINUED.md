# 功能缺口开发文档（续）- 订单管理增强（2026-03-06）

## 1. 开发范围

本次为上一轮 P0/P1 交付后的继续开发，聚焦原分析文档中的 P2 项：

1. 撤单能力（单笔 + 批量）
2. 订单状态追踪（单笔 + 批量）
3. 前端 API 契约补齐

---

## 2. 后端改动

### 2.1 Broker 能力扩展

文件：`packages/backend/src/services/broker/tiantian.service.ts`

新增：
- `cancelOrder(orderId)`：执行撤单并返回 `CANCELLED`

增强：
- `OrderStatus.status` 增加 `CANCELLED`
- `parseOrderStatus` 将“取消”映射为 `CANCELLED`

---

### 2.2 交易 API 扩展

文件：`packages/backend/src/api/controllers.ts`

在 `TransactionController` 新增接口：

1. `POST /api/transactions/:id/refresh-status`
- 刷新单笔交易状态
- 查询 broker 状态后同步到本地交易记录

2. `POST /api/transactions/:id/cancel`
- 撤销单笔交易
- 支持普通待处理交易撤单
- 对“待确认交易（confirmation）”走确认服务取消逻辑

3. `POST /api/transactions/batch/refresh-status`
- 批量刷新状态
- 返回每笔 success/failure 明细

4. `POST /api/transactions/batch/cancel`
- 批量撤单
- 返回每笔 success/failure 明细

内部新增：
- `refreshTransactionStatus(...)` 私有方法，统一状态更新逻辑（`CONFIRMED/FAILED/CANCELLED`）

---

### 2.3 DTO 扩展

文件：`packages/backend/src/api/dto.ts`

新增：
- `BatchTransactionIdsDto`
  - `transaction_ids: string[]`
  - 至少 1 个 UUID

---

## 3. 前端 API 改动

### 3.1 类型补齐

文件：`packages/frontend/src/api/types.ts`

新增：
- `TransactionStatusRefreshResult`
- `BatchTransactionOperationResult`

### 3.2 交易 API 扩展

文件：`packages/frontend/src/api/transactions.ts`

新增：
- `refreshTransactionStatus(id)`
- `cancelTransaction(id)`
- `batchRefreshTransactionStatus(ids)`
- `batchCancelTransactions(ids)`

---

## 4. 前端页面联调落地

### 4.1 新增交易管理页

新增文件：`packages/frontend/src/transactions/TransactionsPage.tsx`

实现内容：

1. 交易列表分页查询（支持基金代码筛选）
2. 单笔操作：
   - 刷新状态
   - 撤单（仅 `PENDING/SUBMITTED` 可用）
3. 批量操作：
   - 批量刷新状态
   - 批量撤单
4. 结果反馈：
   - 成功/失败提示
   - 批量操作成功数与失败数
5. 撤单二次确认：
   - 单笔撤单确认弹窗
   - 批量撤单确认弹窗
6. 高级筛选：
   - 基金代码
   - 交易类型（BUY/SELL）
   - 交易状态
   - 日期范围（start_date/end_date）
7. 批量结果可视化与导出：
   - 批量操作结果明细面板（逐笔 success/failure）
   - 一键导出 CSV（包含失败原因）

### 4.2 路由与导航接入

修改文件：
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/shared/Navbar.tsx`

变更：
- 新增路由：`/transactions`
- 顶部导航新增“交易管理”

### 4.3 后端查询接口增强（配合前端筛选）

文件：`packages/backend/src/api/controllers.ts`

`GET /api/transactions` 新增查询参数：

1. `type`
2. `status`
3. `start_date`
4. `end_date`

服务端按条件组合过滤，保证分页总数与筛选结果一致。

---

## 5. 测试与验证

### 4.1 后端测试

执行：

```bash
pnpm --filter @fundtrader/backend test -- \
  src/api/__tests__/transaction-controller.test.ts \
  src/services/broker/__tests__/tiantian.service.test.ts
```

结果：通过（37 passed）

说明：`tiantian.service` 单测中的错误日志是预期的异常分支测试输出，不影响通过结果。

### 4.2 构建验证

- `pnpm --filter @fundtrader/backend build` 通过
- `pnpm --filter @fundtrader/frontend build` 通过

---

## 6. 接口清单（新增）

1. `POST /api/transactions/:id/refresh-status`
2. `POST /api/transactions/:id/cancel`
3. `POST /api/transactions/batch/refresh-status`
4. `POST /api/transactions/batch/cancel`

请求体（批量接口）：

```json
{
  "transaction_ids": ["uuid-1", "uuid-2"]
}
```

---

## 7. 增量开发：操作历史留存（最近 N 次批量结果）

### 7.1 需求背景

现状问题：
- 批量操作结果仅存在页面内存状态
- 刷新页面后结果丢失，运营无法回看最近执行记录

目标：
- 支持页面刷新后查看最近 N 次批量操作结果
- 可在历史记录间切换查看明细并继续导出 CSV
- 不引入后端新表，先采用前端本地持久化实现

### 7.2 实现方案

文件：`packages/frontend/src/transactions/TransactionsPage.tsx`

新增核心点：

1. 本地缓存常量
- `BATCH_HISTORY_STORAGE_KEY = fundtrader.transaction.batch.history.v1`
- `MAX_BATCH_HISTORY = 10`

2. 批量结果模型标准化
- `BatchAction`
- `BatchResultItem`
- `BatchResultRecord`（含 `history_id`、`created_at`）

3. 启动恢复机制
- 页面挂载时从 `localStorage` 读取历史数组
- 通过 `isBatchResultRecord(...)` 做基本结构校验
- 恢复后默认展示最新一条明细

4. 自动持久化
- `batchHistory` 变化时自动写回 `localStorage`

5. 批量执行后写入历史
- `saveBatchResultToHistory(...)` 统一封装写入逻辑
- 每次批量操作生成新记录（唯一 `history_id` + 时间戳）
- 使用“头插 + 截断”策略保留最近 10 条

6. UI 交互增强
- 新增“最近批量操作历史（最近 10 次）”区块
- 可点击某条历史切换右侧明细面板内容
- 新增“清空历史”按钮（同时清空当前明细）

### 7.3 验收标准

1. 执行任意批量刷新/批量撤单后，历史区新增一条记录。
2. 连续执行超过 10 次，仅保留最近 10 条。
3. 刷新浏览器页面后，历史与最近明细仍可恢复查看。
4. 点击不同历史记录，明细面板内容正确切换。
5. 对历史记录执行 CSV 导出，内容与当前选中记录一致。

### 7.4 风险与边界

1. `localStorage` 容量有限，但当前仅存最近 10 次结果，风险可控。
2. 本地缓存属于当前浏览器环境，不跨设备同步。
3. 若历史结构升级，需调整 `BATCH_HISTORY_STORAGE_KEY` 版本后缀或兼容迁移逻辑。

---

## 8. 后续建议

1. 增加后端“交易操作日志查询”接口，实现跨端共享的审计历史。
2. 为交易管理页补充 UI 自动化测试（批量选择、撤单确认、历史恢复）。
3. 优化状态筛选显示文案（枚举值映射中文标签），减少运营认知成本。
