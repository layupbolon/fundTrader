# Biome/Vitest Migration Code Review

Date: 2026-04-29
Reviewer: subagent `019dd80f-e0da-7dc1-9154-a19404efbb7f` (`gpt-5.5`, `xhigh`)
Scope: ESLint/Prettier to Biome migration, backend Jest to Vitest migration, related scripts/configs/tests/docs/dependencies.

## Code Review Summary

**Files reviewed**: 78 task-scoped files; 92 files total in diff, excluding unrelated deletions under `.agents/skills/agent-browser/**`, `.claude/**`, and `skills-lock.json`
**Overall assessment**: COMMENT
**Blockers**: no P0/P1 found

The review used `code-review-expert` and checked the Biome/Vitest migration boundary, package scripts, dependency changes, E2E config, backend test migration patterns, frontend Vitest config, and docs references. No files were modified by the reviewer.

## Findings

### P0 - Critical

None.

### P1 - High

None.

### P2 - Medium

1. **[packages/backend/vitest.e2e.config.ts:21] Backend E2E lacks serial execution guard**

   Vitest defaults to running test files in parallel, but the E2E helpers truncate all tables before each test against the same Postgres database. Once Docker is available, PR/nightly E2E can become flaky.

   Suggested fix: set `fileParallelism: false` or `maxWorkers: 1` in the backend E2E Vitest config.

2. **[packages/backend/tsconfig.json:28] Backend test sources are no longer typechecked**

   The backend build now excludes test files and Vitest/SWC transpilation does not typecheck by default. Test code can compile at runtime while containing type errors.

   Suggested fix: add `tsconfig.test.json` plus `tsc --noEmit`, or enable a Vitest typecheck gate for backend tests.

3. **[biome.json:29] Biome rule set is narrower than the removed ESLint baseline**

   The new Biome config disables recommended rules and restores only a small subset. This is a material weakening from the old TypeScript ESLint recommended baseline.

   Suggested fix: enable Biome recommended rules and explicitly disable noisy rules, or document the accepted baseline and follow-up hardening plan.

4. **[docs/PHASE3_IMPLEMENTATION.md:95] Phase 3 docs still describe Jest**

   `docs/PHASE3_IMPLEMENTATION.md` still documents `jest.config.js`, `jest.fn()` examples, and a link to the deleted backend Jest config. This conflicts with the migration and will send future contributors to stale setup instructions.

   Suggested fix: update the Phase 3 implementation notes to reference Vitest and the new config files.

### P3 - Low

None blocking.

## Removal/Iteration Plan

Safe to defer:

- Replace `jest.Mocked` compatibility types in tests with `Mocked` / `Mock` from `vitest`, then remove `packages/backend/src/test-compat.d.ts`.
- Remove stale `eslint-disable-next-line` comments now that ESLint is gone.
- Decide whether `docs/IMPLEMENTATION.md.bak` should be updated, ignored, or removed from maintained docs.

Excluded from this review per request:

- `.agents/skills/agent-browser/**`
- `.claude/**`
- `skills-lock.json`

## Additional Suggestions

- Run `pnpm --filter @fundtrader/backend test:cov` once Docker-independent coverage behavior is checked; current known validation did not include coverage.
- Keep `noExplicitAny` as warning for now if it is accepted baseline, but track a burn-down plan before turning warnings into failures.

## Next Steps

Found 4 issues: P0: 0, P1: 0, P2: 4, P3: 0.

Recommended next step from reviewer: fix the E2E serial execution guard and stale docs in this PR; treat test typechecking and Biome rule parity as either current PR hardening or explicit follow-up items.

## Remediation Status

- Fixed P2-1 by setting `fileParallelism: false` in `packages/backend/vitest.e2e.config.ts`.
- Fixed P2-2 by adding `packages/backend/tsconfig.test.json` and wiring `test:typecheck` into backend `test`.
- Fixed P2-3 by documenting the intentional Biome migration baseline in `AGENTS.md` and `CLAUDE.md`.
- Fixed P2-4 by updating `docs/PHASE3_IMPLEMENTATION.md` from Jest references to Vitest references.
