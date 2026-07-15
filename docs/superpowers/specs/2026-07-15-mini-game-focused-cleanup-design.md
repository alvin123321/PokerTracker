# Mini-Game Focused Cleanup Design

## Goal

Reduce avoidable frontend work introduced by the global mini-game while preserving its UI, game rules, local-preview safety, and Supabase contracts.

## Scope

- Keep the production Supabase path independent from the browser-local mini-game implementation.
- Load `MiniGameLocalStore` only when Supabase is intentionally unavailable.
- Keep the storage event key in a lightweight constants module so the service does not statically import the local store.
- Parse local storage once per public store operation and pass celebration claims through snapshot mapping.
- Persist a canonical projection directly instead of JSON-cloning the full state before serialization.
- Remove only exports with no runtime consumers and remove their isolated tests.
- Evaluate the Supabase environment guard once during client creation.

## Non-Goals

- No UI or copy changes.
- No changes to dealing, equity, winner selection, or game state transitions.
- No schema, RPC, Edge Function, RLS, or Realtime changes.
- No rewrite of the exact-equity algorithm; its measured runtime is already below the target.
- No new dependencies or static-analysis tooling.

## Architecture

`MiniGameService` will statically import only the local-storage key. When `SupabaseService.isConfigured` is false, a cached dynamic import will construct one `MiniGameLocalStore`; production dashboard entry chunks therefore will not depend on the hand evaluator. Each local operation captures its viewer before awaiting that import so an account change cannot alter the operation's identity. All existing service methods remain asynchronous and keep their public signatures.

`MiniGameLocalStore` will read and validate its persisted state once at the start of `current`, `history`, `detail`, or `perform`. The same in-memory state's celebration claims will be supplied to `forViewer`, avoiding repeated JSON parsing while preserving viewer-specific fields. Writes will shallow-project canonical games with viewer fields cleared, avoiding a redundant full-state JSON parse/stringify cycle.

## Verification

- Add storage-call regression tests that fail if read operations parse persisted state more than once.
- Run focused mini-game tests during implementation.
- Run the full Angular test suite and production build.
- Inspect `dist/pokertrack/stats.json` and emitted imports to confirm host and player dashboards no longer eagerly load the evaluator chunk.
- Verify host and player dashboards in the development app on mobile widths, with port `4200` remaining isolated from production Supabase.
