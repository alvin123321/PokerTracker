# Global Active Table Realtime Design

## Scope

Every registered player account must see active poker tables without refreshing the player dashboard. A player does not need to be seated or added to the active session before the table appears.

When one or more active tables exist, the player dashboard presents those tables as the current live state. When no active table exists, the dashboard keeps its current behavior and presents the player's latest completed game history.

The change exposes only public table and session identity. It does not make another player's seat, buy-in, cash-out, transactions, chip totals, time calls, or completed-game history visible.

## Player Experience

The player dashboard loads the active-table directory when the authenticated player initializes the page. Each active table includes:

- session ID and session name;
- session date;
- table ID, table name, and table number; and
- the active status needed to determine whether it belongs in the live section.

An unseated player sees the table identity with a neutral waiting state. A seated player continues to see the existing detailed active-game card with their personal buy-in, transactions, table roster, and call-time controls.

If multiple tables are active, the dashboard lists all of them in stable session-date, session-created, and table-number order. Every seated active entry is presented as a detailed card before any unseated table cards. Completed tables never appear in the active directory.

When the final active table closes, the live section disappears and the dashboard returns to the existing latest-completed-game presentation. The existing History tab remains unchanged.

## Public-Safe Active Table Directory

A new authenticated database RPC returns the current active-table directory. The function validates that the caller is a registered `PLAYER` account and returns only the public fields listed above.

The directory is intentionally application-global, not scoped to the player's host relationships. Every registered `PLAYER` account can see the public-safe identity of every active table across all hosts. `HOST`, `MANAGER`, roleless authenticated, and anonymous callers cannot execute the directory RPC.

The RPC runs with a fixed search path and explicit execute grants. Anonymous callers, host-only administrative data, and completed-session metadata are excluded. Existing source-table RLS remains restrictive; the implementation does not grant every player direct read access to all `sessions` or `session_tables` rows.

This RPC boundary is preferred over broad source-table policies because a table that becomes closed would immediately stop matching an active-only RLS policy. That can suppress the closing Postgres Changes event and leave an unseated player's dashboard stale. It would also be inappropriate to expose completed table rows merely to keep close events observable.

## Realtime Invalidation

A small singleton revision table acts only as an invalidation signal. It contains a revision value and update timestamp, with no session, table, player, or financial data.

Database triggers increment the revision whenever a change can alter the active-table directory:

- a session is created, activated, completed, or deleted; or
- a session table is created, activated, closed, or deleted.

The revision table is added idempotently to the `supabase_realtime` publication. Registered players may select the revision row so Supabase can authorize Postgres Changes delivery. They receive no source-row payload through this channel.

`PokerStoreService` subscribes to the revision table on its existing authenticated Realtime channel. On an event it uses the existing audited refresh queue, reloads the active-table RPC, and updates a dedicated read-only signal. Initial authentication and Realtime reconnection also reload the directory, so a missed connection does not require a page refresh.

Host and manager session synchronization remains on the existing source-table subscriptions. The active-table invalidation event is an additional player-safe signal, not a replacement for host data synchronization.

## Client State and Rendering

`PokerStoreService` owns a typed `playerActiveTables` signal. It clears and invalidates that state whenever the authenticated user identity changes, when the authenticated role is not `PLAYER`, when the user signs out, or when the RPC reports no active tables. Overlapping reads are latest-request-wins for the same account, so an older response cannot replace a newer confirmed directory. An ordinary same-account refresh failure preserves the last confirmed directory while surfacing the store error.

The player dashboard derives two live groups:

- seated entries, which use the existing personal session data; and
- unseated active tables from the public directory, excluding any table already represented by a seated entry.

The overview prioritizes these live groups whenever either contains data. Completed-game fallback selection continues to use the existing player-specific session history and is shown only when both live groups are empty.

An RPC or Realtime refresh failure leaves the last confirmed directory visible and surfaces the existing store error state. Reconnection performs a fresh authoritative read rather than attempting to replay revision numbers client-side.

## Database Safety

The migration will:

- create the public-safe active-table RPC;
- create the singleton revision table with RLS enabled;
- grant only the minimum select and execute permissions;
- create or replace the trigger function and create its statement triggers once as migration-managed DDL;
- add the revision table to `supabase_realtime` only when it is not already published; and
- notify PostgREST to reload its schema cache.

The trigger function performs only one singleton-row update per statement. It does not copy poker data into the revision table and does not bypass authorization for application reads.

## Testing

Database tests will verify that:

- a registered player can list currently active tables owned by multiple hosts even when unseated;
- host, manager, roleless authenticated, and anonymous callers cannot use the directory;
- completed sessions and closed tables are excluded;
- financial and roster fields are absent from the RPC result;
- session and table create, activate, complete/close, and delete paths increment the revision;
- registered players can read the revision while anonymous clients cannot and authenticated clients cannot write it; and
- the revision table belongs to the `supabase_realtime` publication.

Angular tests will verify that:

- the store loads and refreshes the public active-table directory for players;
- Realtime invalidation uses the existing coalesced refresh path;
- all unseated registered players receive active-table state;
- every seated active entry remains visible before all unseated active tables, without duplication;
- active tables take precedence over completed-game fallback content; and
- completed history remains unchanged when no active table exists.

The full Angular suite, production build, database reset, pgTAP suite, and database lint will run before completion. The player dashboard will be rendered at mobile width with active and no-active-table states.

## Rollout

The database migration must be applied and verified before the frontend is released. Production smoke testing requires two authenticated accounts: a host creates and closes a table while a registered, unseated player keeps the dashboard open. The player must see the live table appear and disappear without a manual refresh, and their completed-game fallback must return after the final table closes.

The feature branch must not merge into `main` or be pushed live until this migration and smoke test succeed.
