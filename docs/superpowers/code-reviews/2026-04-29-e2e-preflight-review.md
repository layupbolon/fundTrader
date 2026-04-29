# Code Review: E2E and Preflight Fixes

Reviewer: sub-agent `019dd8bf-c9ae-7a33-982a-b29d3f9de6e4` (`gpt-5.5`, `xhigh`)

## Code Review Summary

**Files reviewed**: 本轮主文件 6 个，约 197 行变更/新增；额外抽查了相关 dirty diff 的 broker/transaction 交互。

**Overall assessment**: REQUEST_CHANGES

**Scope note**: 工作区存在大量既有 dirty diff；下面已标注“本轮相关”与“其他 dirty diff”。

---

## Findings

### P0 - Critical

无。

### P1 - High

1. **本轮相关 - `packages/backend/test/e2e/create-e2e-app.ts:19` / `setup-env.ts:25`** E2E 队列清理可能误删非测试 Redis Bull 数据
   - 影响：`setup-env.ts` 保留外部传入的 `BULL_PREFIX`，而 `cleanE2EQueues()` 会直接 `KEYS ${prefix}:*` 后 `DEL`。如果本机环境或 `.env` 里是 `BULL_PREFIX=bull`、生产同款前缀，跑 `pnpm test:e2e:pr` 会删除该 Redis 上全部匹配队列历史，属于测试脚本的数据破坏风险。
   - 建议：E2E 固定覆盖为专用前缀，例如 `fundtrader:e2e:${process.pid}`，或在清理前强校验 prefix 必须包含 `e2e`/随机 run id；同时用 `SCAN` + `UNLINK/DEL`，并在 `finally` 中关闭 Redis 连接。

2. **其他 dirty diff - `packages/backend/src/scheduler/trading.processor.ts:63`** 券商提交缺少幂等保护，失败重试可能重复真实下单
   - 影响：`brokerService.buyFund/sellFund` 是外部副作用，当前先调用券商，再写入 `order_id`。如果券商下单成功但 DB update 或后续日志失败，Bull 会重试，下一次仍可能再次调用券商，导致重复交易。若日志失败发生在 DB update 之后，还会把已提交交易标记为 `FAILED`。
   - 建议：把提交拆成明确状态机：先用条件更新锁住 `PENDING_SUBMIT -> SUBMITTING`，生成/持久化幂等键；券商支持时传 client order id；券商成功后先持久化 `order_id`，日志失败不得触发 broker 重试；重试入口必须优先检查已有 `order_id`。

3. **其他 dirty diff - `packages/backend/src/api/controllers.ts:401`** 交易已保存但入队失败会留下永远待提交的孤儿交易
   - 影响：`transactionRepository.save()` 成功后才 `tradingQueue.add()`。如果 Redis 短暂失败，API 抛错，但 DB 中已经有 `PENDING_SUBMIT` 交易，后续没有补偿任务能提交或取消它。
   - 建议：保存交易和 outbox/job 创建使用事务性 outbox，或在 `queue.add` 失败时立即回滚/标记 `FAILED` 并记录可恢复原因；后台补偿任务扫描 `PENDING_SUBMIT` 且无 job 的交易。

### P2 - Medium

4. **本轮相关 - `packages/frontend/playwright.config.ts:37`** proxy 修复过宽且仍有漏项
   - 影响：配置直接删除当前 Node 进程的 proxy env，会影响 webServer 子进程的所有网络行为；同时没有处理 `ALL_PROXY/all_proxy`，且已有 `NO_PROXY` 时不会补追加 `localhost,127.0.0.1,::1`。在部分环境里，原来的 localhost 探测误判仍可能复现。
   - 建议：构造 Playwright/webServer 专用 env，不要改全局 `process.env`；清理 `ALL_PROXY/all_proxy`；把 local hosts append 到已有 `NO_PROXY/no_proxy`。

### P3 - Low

5. **本轮相关 - `packages/backend/scripts/preflight-check.ts:51` / `63`** 连接清理缺少 `finally`
   - 影响：`client.end()` 和 `redis.disconnect()` 只在 happy path 执行；连接失败或 query/ping 异常时依赖进程退出回收。脚本短期可接受，但 preflight 作为部署前检查应更严谨。
   - 建议：DB/Redis check 用 `try/finally` 关闭连接；Redis 可用 `disconnect()` 或 `quit()` 语义明确处理。

---

## Removal/Iteration Plan

无明确可立即删除项。本轮更像测试隔离、部署前检查和前端 payload 合同修复，不建议在同一轮做删除型重构。

## Verification Notes

review 子代理未复跑验证命令；review 基于当前工作区 diff 和主代理提供的验证结果。主代理列出的本轮验证覆盖了 e2e、preflight、typecheck、frontend build 与本轮文件 Biome，但 `pnpm lint` 仍受既有基线影响失败。
