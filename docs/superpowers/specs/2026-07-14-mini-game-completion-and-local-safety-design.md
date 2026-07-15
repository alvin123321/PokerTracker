# Mini-Game Completion and Local Safety Design

## Goal

Make the river immediately produce and publish the final winner, let the creator host archive that completed result with an explicit Complete mini game action, simplify the mobile mini-game controls, and ensure a locally served PokerTracker app cannot connect to the production Supabase project.

## Approved Behavior

- Revealing the river remains the action that changes the game to `COMPLETE`.
- Exact final equity is calculated during the river action. The returned snapshot and Realtime refresh identify every winner, including split-pot ties.
- Host, manager, and player dashboards show the winning participant row immediately after the result is ready.
- The creator host then sees a full-width `Complete mini game` button. This archives the current result without deleting it, so it disappears from dashboards but remains in mini-game history.
- Delete remains a separate destructive action and continues to remove the result from dashboards and history.
- The header uses one ellipsis menu. It contains Open game, Edit game, Reshuffle cards, and Delete game; actions that are invalid for the current street are disabled.
- Participant rows show avatar, name, public cards, optional final hand label, winner state, and the host remove action. Join numbers, seat labels, and displayed equity are removed.
- Join, Start, Turn, River, and Complete show action-specific loading text and a restrained spinner. Buttons remain dimensionally stable and disabled while an action is active.

## Local Safety Boundary

- The Supabase client factory independently checks the browser hostname. If PokerTracker is served from localhost, loopback, a private IPv4 address, or a `.local` hostname, it refuses to create a client for the production project URL even if a production Angular build is accidentally served.
- Development configuration keeps Supabase credentials empty and uses local browser persistence for the mini-game.
- The local mini-game store implements the same user-visible lifecycle in localStorage and broadcasts changes between same-origin tabs. It never calls production.
- `live sync` remains a separate, explicit production-to-local copy operation. This change does not run it and does not write to production.
- The local preview command is fixed to development configuration, host `0.0.0.0`, and port `4200`.

## Data and Backend

- Add `archive_mini_game(uuid)`, creator-host-only and valid only for a completed result whose final equity is ready.
- Archiving sets `is_current = false`, preserves the completed row and cards, and returns the standard mutation state.
- Add `archive` to the Edge Function action contract. It bypasses equity calculation because the result must already be final.
- The existing river action remains responsible for drawing board position five, marking the game complete, calculating exact final equity, and returning a winner-bearing snapshot.

## Verification

- Unit-test production URL blocking on local/private hosts and allowance on a deployed public host.
- Unit-test local card uniqueness, lifecycle validation, final winner/tie selection, archive/history persistence, and viewer-specific snapshot fields.
- Test Edge Function action parsing/mapping and no-equity behavior for archive.
- Add pgTAP coverage for archive permissions and history/current behavior.
- Run Angular tests, production build, Deno tests, database reset/test/lint, and mobile browser checks at 360px and 390px.
- Before handoff, stop PokerTracker development listeners and run only the development frontend at `http://0.0.0.0:4200`.
