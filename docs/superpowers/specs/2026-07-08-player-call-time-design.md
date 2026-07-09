# Player Call Time Design

## Goal

Complete the Player Call Time feature so each active player gets 3 call-time uses per session, and admin/manager users can view a live 30-second countdown in a dedicated Session Overview screen.

## Confirmed Product Decisions

- Admin mobile bottom navigation gets a new tab labeled `Clock`.
- Admin desktop uses the full label `Session Overview`.
- Player Call Time is session-scoped. A player gets 3 uses per session after joining that session.
- The timer duration is fixed at 30 seconds.
- Only one running timer is allowed per session.
- A running, finished, or expired timer counts against the player's 3 uses.
- A cancelled timer does not count against the player's 3 uses.
- Players can request time only for their own active session seat.
- Cashed-out players cannot call time.
- Admin and manager users can finish or cancel the active timer.
- The feature must not change unrelated session, rebuy, cash-out, member, history, profile, or pot calculator behavior.

## Data Model

Add a `time_calls` table with these fields:

- `id`
- `session_id`
- `session_player_id`
- `status`
- `started_at`
- `expires_at`
- `resolved_at`
- `resolved_by`

Supported statuses:

- `RUNNING`
- `FINISHED`
- `EXPIRED`
- `CANCELLED`

Database rules:

- Only one `RUNNING` call is allowed per session.
- `expires_at` must be later than `started_at`.
- `RUNNING` calls have no `resolved_at`.
- Non-running calls have `resolved_at`.

Database functions:

- `request_time_call(session_id, session_player_id)`
- `resolve_time_call(time_call_id, status)`
- `expire_running_time_calls(session_id)`

## Store Logic

The Angular store owns all call-time state and exposes small helpers to components.

Required store responsibilities:

- Load `time_calls` with each session.
- Add `time_calls` to Supabase realtime refresh.
- Track whether call-time schema is installed and show a clear setup message if missing.
- Calculate remaining call-time uses per player.
- Find the active timer for a session.
- Calculate seconds remaining from `expires_at`.
- Calculate timer progress for circular UI.
- Auto-expire stale running timers before accepting a new request.
- Support local/dev fallback so testing still works without Supabase.

Component-facing helpers:

- `requestTimeCall(sessionId, sessionPlayerId)`
- `resolveTimeCall(timeCallId, status)`
- `activeTimeCallForSession(session)`
- `remainingTimeCallsForPlayer(session, sessionPlayerId)`
- `canRequestTimeCall(session, player)`
- `secondsRemainingFor(timeCall)`
- `timeCallProgressFor(timeCall)`
- `playerNameForTimeCall(session, timeCall)`

## Player UI

Player mobile dashboard:

- Show a large Call Time icon button inside the active session card.
- Show remaining uses as `3/3`, `2/3`, `1/3`, or `0/3`.
- When the player's timer is running, replace the button with a compact circular countdown.
- Disable the button when:
  - player is cashed out
  - session is completed
  - no call-time uses remain
  - another timer is running for the same session
  - request is already submitting
- Keep the UI aligned with the existing high-end dark green PokerTracker style.
- Use the same loading/animation language already used elsewhere in the app.

## Admin Mobile UI

Host mobile bottom navigation:

- Add a fifth tab labeled `Clock`.
- The tab links to `/host/session-overview`.
- Use a bold clock-style icon.
- The nav remains fixed at the bottom like the player view.
- The selected state uses icon color/glow only, not a thick underline.

Clock screen behavior:

- Show one clock panel per active session.
- If a session has a running timer, show a large countdown ring starting at 30.
- If no timer is running, show a ready state for that session.
- Show session name, active player count, cashed-out count, and player list.
- Player list labels use `Active` and `Cashed out`.
- Do not show buy-in totals on this display.

## Admin Desktop UI

Desktop navigation:

- Add `Session Overview` to the host top navigation.
- Route: `/host/session-overview`.

Desktop display:

- Show one large table-display card per active session.
- The countdown clock is visually centered and large enough for players to see from the table.
- The screen should feel more like a polished table display than a data-entry page.
- Use stronger typography, animated green accents, and subtle motion.
- Admin/manager controls appear inside each session card:
  - `Finish`
  - `Cancel`

## Error Handling

- If the call-time table or RPCs are missing, show a clear setup message instead of a generic failure.
- If a player has no uses left, disable the button and show `0/3`.
- If another timer is already running, disable the button and show the running clock.
- If a timer expires while the app is open, update it to `EXPIRED` and refresh the displayed state.
- If realtime fails, regular refresh/local fallback should still keep the app usable.

## Testing

Build check:

- `npm.cmd run build`

Manual test cases:

- Active player can request Call Time.
- Player sees countdown after request.
- Admin mobile `Clock` tab shows the same countdown.
- Admin desktop `Session Overview` shows the same countdown.
- Timer counts down from 30 to 0.
- Timer auto-expires at 0.
- Admin can finish a timer.
- Admin can cancel a timer.
- Cancelled timer does not reduce remaining uses.
- Finished timer reduces remaining uses.
- Expired timer reduces remaining uses.
- Player cannot request a fourth call in the same session.
- Cashed-out player cannot call time.
- Completed session cannot call time.
- Second player cannot start a timer while one is already running in the same session.
- Existing rebuy, cash-out, add player, close session, delete session, history, member, profile, and pot calculator flows still work.

Mobile viewport checks:

- 320 px
- 360 px
- 390 px
- 414 px

Desktop viewport checks:

- 1280 px
- wide display layout

## Implementation Notes

- Use a feature branch from latest `main`: `feature/player-call-time`.
- Keep commits small:
  - database migration
  - store logic
  - player UI
  - admin Clock nav and overview UI
  - verification fixes
- Do not force-push rebased branches unless explicitly approved.
- Keep production data read-only during any development data sync.
