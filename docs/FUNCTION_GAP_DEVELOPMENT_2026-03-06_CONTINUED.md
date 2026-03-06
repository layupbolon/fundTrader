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

## 7. 后续建议

1. 在前端交易列表页增加“刷新状态/撤单”操作按钮并支持多选批量操作。
2. 将批量任务执行结果以 toast + 明细面板展示，便于运营排障。
3. 对接真实 broker 后补充集成测试（当前为模拟接口语义）。
