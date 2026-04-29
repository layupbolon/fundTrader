## Code Review Summary

**Files reviewed**: 9 files, 463 insertions / 57 deletions including untracked files  
**Overall assessment**: REQUEST_CHANGES

Reviewed only current uncommitted changes for backend user ownership filtering/backtest ownership, frontend route lazy loading, and docs entries.

---

## Findings

### P0 - Critical

(none)

### P1 - High

1. **[packages/backend/src/models/backtest-result.entity.ts:43]** Missing production migration and legacy backfill for `backtest_results.user_id`
  - The entity adds `user_id`, and controllers now query/create with that column. In production, `synchronize` is disabled, so an upgraded server database will not have this column and `/backtest` list/detail/create can fail at runtime.
  - The column is nullable for compatibility, but the new filters use `where: { user_id: user.id }`; existing NULL rows become invisible after upgrade. That contradicts the single-user compatibility goal in `docs/EVOLUTION_ROADMAP.md`.
  - Suggested fix: add a TypeORM migration that adds nullable `user_id`, FK, and an index. Include a backfill step for existing single-user deployments before relying on the ownership filter. If no canonical user can be inferred automatically, document and script an explicit operator step.

### P2 - Medium

2. **[packages/frontend/src/App.tsx:21]** Lazy route chunks have no error boundary or reload path
  - `React.lazy` improves chunking, but failed dynamic imports now occur during navigation. With only `Suspense`, a stale/missing chunk after server deploy can reject and leave the app without a controlled recovery UI.
  - This is especially relevant for a self-hosted long-running server deployment where users may keep an old tab open across deploys.
  - Suggested fix: wrap the route tree with an ErrorBoundary that detects lazy chunk failures and offers a refresh/retry path, or use a small `lazyWithRetry` helper. Add at least one component test or smoke check for lazy import failure behavior.

### P3 - Low

(none)

---

## Removal/Iteration Plan

No removal candidates identified in this diff.

Recommended iteration order:

1. Add and verify the database migration/backfill path for `backtest_results.user_id`.
2. Add frontend lazy chunk failure handling.
3. Add follow-up coverage:
  - API or integration coverage for cross-user access returning no data.
  - Migration/backfill verification for existing NULL backtest rows.
  - Frontend lazy-load failure recovery test or deploy smoke note.

## Verification Performed

- `pnpm --filter @fundtrader/backend test -- src/api/__tests__/backtest-controller.test.ts src/api/__tests__/strategy-controller.test.ts src/api/__tests__/transaction-controller.test.ts src/api/__tests__/position-controller.test.ts`
  - Exit 0; backend test script ran full backend suite: 33 files, 374 tests passed.
- `pnpm --filter @fundtrader/frontend build`
  - Exit 0; route chunks generated, main bundle `240.12 kB`.
- `pnpm build`
  - Exit 0.
- `pnpm lint`
  - Exit 0 with existing warning-level diagnostics; no blocking lint errors.
- `git diff --check`
  - Exit 0.

## Additional Suggestions

- The ownership predicate changes for strategy, position, transaction, and new backtest records are directionally correct.
- The tests assert repository predicates, which is useful, but they do not prove HTTP-level guard/decorator behavior or legacy row compatibility. The migration/backfill test is the higher-value missing piece for this change.
