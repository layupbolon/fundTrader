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

## 4. 测试与验证

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

## 5. 接口清单（新增）

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

## 6. 后续建议

1. 在前端交易列表页增加“刷新状态/撤单”操作按钮并支持多选批量操作。
2. 将批量任务执行结果以 toast + 明细面板展示，便于运营排障。
3. 对接真实 broker 后补充集成测试（当前为模拟接口语义）。

