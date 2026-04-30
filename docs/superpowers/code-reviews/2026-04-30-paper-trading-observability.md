## Code Review Summary

**Files reviewed**: 19 files, tracked diff `+583/-47` plus 5 untracked files
**Overall assessment**: `REQUEST_CHANGES`
**Scope**: 只评审当前工作区 diff，未修改文件；已执行 `git status -sb`、`git diff --stat`、`git diff`、`rg`、`git diff --check`。

## Findings

### P0 - Critical

无 P0。

### P1 - High

::code-comment{title="[P1] Broker submit lacks atomic claim" body="handleSubmitTransaction reads a PENDING_SUBMIT transaction and calls the broker before any atomic state claim or row lock. If a Bull job is retried after a stalled lock, processed by another worker, or races with a cancel path that marks the row CANCELLED after this read, the broker call can still execute against a transaction that should no longer submit. For real broker mode this can create duplicate or user-cancelled trades. Claim the row transactionally before broker IO, for example update by id plus status/order_id predicate and verify affected=1, or use SELECT FOR UPDATE/advisory lock plus a distinct in-flight state." file="/Users/yinxiaojie/Desktop/workspace/quant/fundTrader/packages/backend/src/scheduler/trading.processor.ts" start=47 end=67 priority=1 confidence=0.82}

1. **[packages/backend/src/scheduler/trading.processor.ts:47]** broker 提交前没有原子 claim，仍存在重复/取消后提交窗口。
   - 这次增强了持久化失败后抑制 Bull retry，但没有解决提交前的并发所有权问题。
   - 建议在 broker IO 前通过事务/条件更新抢占状态，失败则直接退出。

::code-comment{title="[P1] Broker evidence leaks server and page details" body="The new response exposes brokerEvidence.screenshotPath and domSummary directly, and the frontend renders both. The path can reveal server filesystem layout, user/transaction identifiers, and artifact storage conventions; domSummary is scraped from a broker page and may include account, balance, risk prompt, or other sensitive trading text. Return a redacted evidence summary instead, store the raw artifact behind a protected evidence-id endpoint, and avoid returning absolute paths to the browser." file="/Users/yinxiaojie/Desktop/workspace/quant/fundTrader/packages/backend/src/api/log.controller.ts" start=108 end=114 priority=1 confidence=0.88}

2. **[packages/backend/src/api/log.controller.ts:108]** `brokerEvidence` 原样透出截图路径和 DOM 摘要。
   - 前端又在 `PaperTradingRunsPanel.tsx:179` 展示这些字段，路径/页面文本泄漏面扩大。
   - 建议只返回脱敏摘要、证据 ID、采集时间和人工接管状态；截图用受控下载接口获取，且不暴露绝对路径。

### P2 - Medium

::code-comment{title="[P2] Row limit before grouping can hide runs" body="findPaperTradingRuns limits raw log rows before grouping by runId. A small number of chatty runs can consume the 500-row cap and hide older distinct runs inside the requested date window, so the frontend may show fewer than the requested latest runs. Query distinct run ids first or use SQL grouping/window functions, then fetch events for those selected runs." file="/Users/yinxiaojie/Desktop/workspace/quant/fundTrader/packages/backend/src/core/logger/operation-log.service.ts" start=309 end=316 priority=2 confidence=0.78}

3. **[packages/backend/src/core/logger/operation-log.service.ts:309]** 先限制日志行再按 run 聚合，会漏 run。
   - `limit * 10` 是经验值，不是正确分页边界。
   - 建议先选 distinct run，再取这些 run 的事件明细。

::code-comment{title="[P2] Missing controller-level coverage for logs route" body="The new /logs/paper-trading/runs route fixes static route order by moving :id lower, but tests only cover OperationLogService. There is no controller or e2e coverage proving /logs/paper-trading/runs, /logs/user/:userId, and /logs/stats/range are not intercepted by :id, nor validating days/limit behavior at the HTTP boundary." file="/Users/yinxiaojie/Desktop/workspace/quant/fundTrader/packages/backend/src/api/log.controller.ts" start=224 end=279 priority=2 confidence=0.74}

4. **[packages/backend/src/api/log.controller.ts:224]** 新日志路由缺少 controller/e2e 覆盖。
   - 路由顺序当前看起来是对的，但这是这类回归最容易再次踩的点。
   - 建议补最小 controller 测试覆盖静态路由命中和 `days/limit` 边界。

### P3 - Low

::code-comment{title="[P3] Avoid tsbuildinfo churn" body="packages/frontend/tsconfig.tsbuildinfo is a generated TypeScript build cache file and this diff only records the newly added source file in that cache. Keeping this artifact in feature diffs adds avoidable churn and merge noise; remove it from the change or stop tracking build info if the project policy allows." file="/Users/yinxiaojie/Desktop/workspace/quant/fundTrader/packages/frontend/tsconfig.tsbuildinfo" start=1 end=1 priority=3 confidence=0.9}

5. **[packages/frontend/tsconfig.tsbuildinfo:1]** 生成缓存文件进入 diff，建议从本次提交中剔除或后续停止跟踪。

## Additional Notes

- JSONB 查询语法与项目 PostgreSQL/`jsonb` 实体匹配，未发现兼容性 P1。
- `preflight-check` 的 PG/Redis `finally` 清理方向正确，未发现连接泄漏问题。
- `git diff --check` 无输出；未运行测试套件，因为本轮是只读评审。
