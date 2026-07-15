# Mini-Game Completion and Local Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the final winner with the river, add a non-destructive host completion action, simplify the mobile mini-game UI, and make local preview structurally unable to connect to production Supabase.

**Architecture:** Keep production mutations in the existing RPC plus Edge Function boundary and add a focused archive RPC. Route unconfigured development mode through a browser-local adapter with the same snapshot/action contract, while a pure hostname policy guards Supabase client creation before any network-capable client exists.

**Tech Stack:** Angular 20 signals and standalone components, Angular Material menu/dialog, localStorage and browser storage events, Supabase Postgres/RLS/Edge Functions/Realtime, Jasmine/Karma, Deno tests, pgTAP.

## Global Constraints

- Mobile is the primary layout and browser verification target.
- River decides the winner immediately; Complete archives rather than recalculating or deleting.
- No local or private-LAN origin may create a production Supabase client.
- `live sync` is production-to-local only and is not part of this implementation.
- Confirmations use clickable Yes/No dialogs.

---

### Task 1: Local Supabase Safety Policy

**Files:**
- Create: `src/app/core/supabase/supabase-environment.logic.ts`
- Create: `src/app/core/supabase/supabase-environment.logic.spec.ts`
- Modify: `src/app/core/supabase/supabase.client.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `shouldCreateSupabaseClient(appHostname: string, supabaseUrl: string): boolean`
- Produces: `npm run start:local`

- [ ] Write policy tests proving localhost, loopback, RFC1918, and `.local` origins reject the production URL while public deployments and local Supabase URLs remain allowed.
- [ ] Run the focused spec and verify it fails because the policy module does not exist.
- [ ] Implement hostname normalization, private-host detection, production-project detection, and the client-factory guard.
- [ ] Add `start:local` using `ng serve --configuration development --host 0.0.0.0 --port 4200`.
- [ ] Run the focused spec and verify it passes.

### Task 2: Browser-Local Mini-Game Domain

**Files:**
- Create: `src/app/features/mini-game/mini-game-local.store.ts`
- Create: `src/app/features/mini-game/mini-game-local.store.spec.ts`
- Modify: `src/app/features/mini-game/mini-game.service.ts`
- Modify: `src/app/features/mini-game/mini-game.models.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `MiniGameLocalStore.current(viewer)`, `history(viewer)`, `detail(gameId, viewer)`, `perform(request, viewer)`, and `claimCelebration(gameId, viewerId)`.
- Consumes: the existing `MiniGameSnapshot` and `MiniGameActionRequest` contracts plus `@poker-apprentice/hand-evaluator@4.2.0` for final hand evaluation.

- [ ] Write failing tests for unique hands, invalid street actions, immediate winner and tie selection after river, archive preserving history, delete removing history, and viewer-specific participation.
- [ ] Run the focused spec and verify the missing store failure.
- [ ] Implement deterministic contract validation, cryptographically shuffled dealing when available, final seven-card evaluation, localStorage persistence, and a same-origin storage event.
- [ ] Route `MiniGameService` reads, actions, history, detail, and celebration claims to the local store whenever Supabase is unconfigured.
- [ ] Run the focused specs and verify they pass.

### Task 3: Production Archive Mutation

**Files:**
- Create: `supabase/migrations/20260715042000_archive_completed_mini_game.sql`
- Modify: `supabase/tests/database/global_poker_mini_game.test.sql`
- Modify: `supabase/functions/mini-game-action/handler.ts`
- Modify: `supabase/functions/mini-game-action/handler_test.ts`

**Interfaces:**
- Produces: `public.archive_mini_game(p_game_id uuid)` returning `game_id`, `state_version`, and `equity_status`.
- Produces: Edge Function action `{ action: 'archive'; gameId: string }`.

- [ ] Add failing Deno expectations for archive parsing, RPC mapping, and skipping equity calculation.
- [ ] Run the Deno handler test and verify the expected failures.
- [ ] Add the archive action to the Edge Function contract and handler response path.
- [ ] Add the migration with creator authorization, `COMPLETE` plus `READY` validation, current-state archival, grants, and revokes.
- [ ] Add pgTAP assertions proving archive is host-only, removes the current dashboard game, and preserves history.
- [ ] Run Deno tests and the complete Supabase reset/test/lint workflow.

### Task 4: Mobile Controls and Loading Feedback

**Files:**
- Modify: `src/app/features/mini-game/mini-game-panel.component.ts`
- Modify: `src/app/features/mini-game/mini-game-participant-row.component.ts`
- Modify: `src/app/features/mini-game/mini-game-board.component.ts`
- Modify: `src/app/features/mini-game/mini-game-dashboard-section.component.ts`
- Create: `src/app/features/mini-game/mini-game-panel.component.spec.ts`

**Interfaces:**
- `MiniGamePanelComponent` consumes `activeAction: MiniGameActionName | null`.
- `MiniGamePanelComponent` emits `completeGame` in addition to existing commands.

- [ ] Write a failing component spec for the four-item ellipsis menu, hidden seat/equity text, winner marker, Complete button, and action-specific loading copy.
- [ ] Run the focused component spec and verify those assertions fail.
- [ ] Replace the header detail icon and separate tool row with an Angular Material ellipsis menu whose invalid actions are disabled.
- [ ] Distill participant rows to avatar, name, cards, hand label, winner, and optional remove button.
- [ ] Add stable loading states for Join, Start, Turn, River, and Complete with reduced-motion support.
- [ ] Wire Complete to archive and retain Yes/No confirmation for reshuffle, delete, and remove.
- [ ] Run the focused component and mini-game logic specs.

### Task 5: Integrated Verification and Local Preview

**Files:**
- Verify all files changed by Tasks 1-4.

- [ ] Run `npm.cmd run test:ci` and require all Jasmine tests to pass.
- [ ] Run `npm.cmd run build` and record only existing budget warnings.
- [ ] Run `git diff --check`.
- [ ] Verify host and player flows at 360px and 390px, including river winner visibility, archive, ellipsis menu, roster density, and loading states.
- [ ] Stop only PokerTracker-related development listeners, then start `npm.cmd run start:local` so port 4200 is the sole project listener.
- [ ] Verify the running process includes development configuration, the app is reachable from localhost and the LAN URL, and no served bundle contains the production Supabase project hostname.
