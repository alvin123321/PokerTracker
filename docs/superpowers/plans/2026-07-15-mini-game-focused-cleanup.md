# Mini-Game Focused Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove measured mini-game frontend waste without changing game behavior, UI, or backend contracts.

**Architecture:** Split the browser-local adapter behind a cached dynamic import, reduce each local-store operation to one persisted-state read, and remove only code proven to have no runtime consumers. Existing async service contracts and exact-equity behavior remain intact.

**Tech Stack:** Angular 20, TypeScript, Jasmine/Karma, Supabase JS, Angular production build metadata

## Global Constraints

- Preserve all mini-game state transitions, winner calculation, authorization, and public-card behavior.
- Keep local development isolated from production Supabase.
- Do not add dependencies or modify database and Edge Function code.
- Keep the development preview on port `4200`.

---

### Task 1: Reduce local-storage parsing and serialization

**Files:**
- Modify: `src/app/features/mini-game/mini-game-local.store.spec.ts`
- Modify: `src/app/features/mini-game/mini-game-local.store.ts`

**Interfaces:**
- Consumes: `MiniGameLocalStore.current`, `history`, `detail`, and `perform`.
- Produces: The same public methods and result types with one `Storage.getItem` call per operation.

- [x] **Step 1: Write failing storage-read regression tests**

Add a counter to the in-memory `Storage` test double, reset it before each assertion, and assert that `current`, `history`, `detail`, and `perform` each call `getItem` exactly once.

- [x] **Step 2: Run the focused spec and verify the tests fail**

Run: `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/mini-game/mini-game-local.store.spec.ts"`

Expected: the new read-count assertions fail because `forViewer` reads storage again.

- [x] **Step 3: Pass claims from the already-read state into viewer mapping**

Change the helper contract to:

```ts
private forViewer(
  game: MiniGameSnapshot,
  viewer: MiniGameLocalViewer,
  celebrationClaims: Record<string, string[]>,
): MiniGameSnapshot
```

Each public operation must call `read()` once, then reuse `state.games` and `state.celebrationClaims`.

- [x] **Step 4: Remove the redundant full-state JSON clone**

Add a failing JSON parse-count regression, then persist a shallow canonical projection that clears `viewerParticipantId` and `viewerCelebrationSeen` without mutating the in-memory state.

- [x] **Step 5: Run the focused spec and verify it passes**

Run: `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/mini-game/mini-game-local.store.spec.ts"`

Expected: all local-store specs pass.

### Task 2: Remove the local evaluator from production dashboard dependencies

**Files:**
- Create: `src/app/features/mini-game/mini-game-local.constants.ts`
- Modify: `src/app/features/mini-game/mini-game-local.store.ts`
- Modify: `src/app/features/mini-game/mini-game.service.ts`
- Modify: `src/app/features/mini-game/mini-game.service.spec.ts`

**Interfaces:**
- Produces: `MINI_GAME_LOCAL_STORAGE_KEY` and a private cached `getLocalStore(): Promise<MiniGameLocalStore>` loader.
- Preserves: every public `MiniGameService` method signature.

- [x] **Step 1: Move the storage key to a dependency-free constants module**

Export the unchanged value `pokertrack.localMiniGame.v1` and update store/service specs to import it there.

- [x] **Step 2: Replace the eager store instance with a cached dynamic import**

Use a type-only store import and construct the store once from `import('./mini-game-local.store')`. Await it only in branches where `isConfigured` is false. Capture the initiating viewer before the await so account changes cannot alter an in-flight operation's identity.

- [x] **Step 3: Run service and local-store specs**

Run: `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/mini-game/mini-game.service.spec.ts --include=src/app/features/mini-game/mini-game-local.store.spec.ts"`

Expected: all selected specs pass and local mode never invokes Supabase.

- [x] **Step 4: Build with stats and inspect dashboard imports**

Run: `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng build --stats-json"`

Expected: production build passes; host and player dashboard entry chunks do not statically import the chunk containing `@poker-apprentice/hand-evaluator`.

### Task 3: Remove confirmed dead code and duplicate environment work

**Files:**
- Modify: `src/app/features/mini-game/mini-game.logic.ts`
- Modify: `src/app/features/mini-game/mini-game.logic.spec.ts`
- Modify: `src/app/features/mini-game/mini-game.models.ts`
- Modify: `src/app/core/supabase/supabase.client.ts`

**Interfaces:**
- Removes: `shouldRefreshMiniGameFromRealtime`, `MiniGameActionFailure`, and `MiniGameActionResponse`.
- Preserves: Supabase client creation and local-origin blocking behavior.

- [x] **Step 1: Remove symbols with no runtime consumers and their isolated test**

Delete the unused table set/helper, unused failure/union action response types, and the test that exists only for the dead helper.

- [x] **Step 2: Cache the environment guard result**

Compute `canCreateClient` once and reuse it for the early return and blocked-client log condition.

- [x] **Step 3: Run focused Supabase and mini-game logic specs**

Run: `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/mini-game/mini-game.logic.spec.ts --include=src/app/core/supabase/supabase-environment.logic.spec.ts"`

Expected: all selected specs pass.

### Task 4: Full verification and review

**Files:**
- Modify: `.planning/mini-game-cleanup/progress.md` (ignored local execution log)

**Interfaces:**
- Produces: current test, build, bundle, browser, and git evidence.

- [x] **Step 1: Run complete automated verification**

Run: `npm.cmd run test:ci`, `npx.cmd -p node@22 -c "node ./node_modules/@angular/cli/bin/ng build --stats-json"`, `npx.cmd -y deno@2.5.6 test --allow-env`, and `git diff --check`.

Expected: all tests pass; the build has only previously known budget warnings; diff check is clean.

- [x] **Step 2: Verify the rendered development app**

Open host and player dashboards from `http://localhost:4200`, verify mini-game loading and actions at 360px and 390px widths, and confirm no remote Supabase request is made.

- [x] **Step 3: Review the final diff**

Check for behavioral changes, accidental backend edits, new dependencies, stale imports, and untracked files. Address any finding before reporting completion.
