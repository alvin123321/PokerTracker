# PokerTrack Roadmap And Handoff

This file is the durable project memory for Codex sessions on another computer. If the chat history is missing, start here.

## Current Release

- Product: PokerTrack
- Release status: V1 released
- GitHub repository: `https://github.com/alvin123321/PokerTracker`
- Production branch: `main`
- Current release tag: `v1.0.0`
- Production URL: `https://poker-tracker-hazel-theta.vercel.app`
- Vercel project: `rocky16/poker-tracker`
- Supabase project URL: `https://rfyaqfecnkwrlcdfmmaj.supabase.co`
- Supabase publishable key location: `src/environments/environment.ts` and `src/environments/environment.development.ts`

Never commit Supabase `service_role`, secret API keys, or other private backend secrets. Only the publishable browser key belongs in Angular environment files.

## One-Line Context For A New Codex Session

PokerTrack is an Angular 20, Tailwind, Angular Material, Supabase, and Vercel poker session app. V1 is live on Vercel, with host workflows, player-only private history, registered player management, Supabase RPCs, RLS, and Edge Functions complete. Reporting is intentionally left for a later phase.

## How To Resume On Another Computer

```bash
git clone https://github.com/alvin123321/PokerTracker.git
cd PokerTracker
npm install
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng serve --host 127.0.0.1 --port 4201"
```

Then tell Codex:

```text
Read docs/ROADMAP.md, PROJECT_STATUS.md, README.md, and git log. Continue PokerTrack from V1 release.
```

## Verification Commands

```bash
npm run test:ci
npm run vercel-build
```

Production smoke checks:

```bash
curl -I https://poker-tracker-hazel-theta.vercel.app
curl -I https://poker-tracker-hazel-theta.vercel.app/host/dashboard
```

Expected result: both production URLs return `HTTP 200`.

## Development Login

Local development login helper:

- Host: `admin1223` / `admin1223`
- Player: `player123` / `player123`
- Auto-created player temporary password: `123456`

Short login names are expanded to `@pokertrack.local` by the Angular auth service. Example: `admin1223` becomes `admin1223@pokertrack.local`.

The message `Development login: admin1223/admin1223 for host, player123/player123 for player.` should only appear on local development builds. It should not appear on the Vercel production build because development auth is disabled when `environment.production === true`.

## Product Goals

PokerTrack is for poker hosts who need fast session tracking during live games.

Core goals:

- Record rebuys in 1-2 clicks.
- Keep host workflows fast on mobile.
- Let players see only their own history.
- Never expose other players, table totals, or other players' results to a player account.
- Keep the UI dark, clean, poker themed, and mobile first.

## User Roles

Host can:

- Create sessions.
- Add registered players to sessions.
- Create new player accounts from the add-player flow.
- Record buy-ins and rebuys.
- Record cash-outs.
- Edit buy-in/rebuy amount and comment.
- Soft-delete buy-in/rebuy entries.
- Close sessions.
- View session history and summaries.
- Manage registered players from the admin-only Players page.

Player can:

- Log in.
- View only their own session history.
- View only their own buy-ins, rebuys, cash-outs, and net results.

Player must never see:

- Other players.
- Session totals.
- Other players' buy-ins.
- Other players' results.

## Completed Phase History

- ~~Phase 1: Angular foundation~~
  - Angular 20 standalone app created.
  - Tailwind CSS configured.
  - Angular Material dialogs configured.
  - Routing shell added.
  - Supabase client dependency and environment files added.

- ~~Phase 2: Supabase database foundation~~
  - Tables created: `users`, `sessions`, `players`, `session_players`, `transactions`.
  - Enums created for roles, session status, player status, and transaction type.
  - RLS policies and RPC foundation added.
  - Migration file: `supabase/migrations/20260625180500_phase_2_database_foundation.sql`.

- ~~Phase 3: Authentication and role routing~~
  - Supabase Auth sign-in connected.
  - Short login names expand to `@pokertrack.local`.
  - Host and player route guards added.
  - Local-only development login fallback added, then disabled for production builds.

- ~~Phase 4: Host core workflow~~
  - Host dashboard.
  - New session.
  - Active session.
  - Add player dialog.
  - Rebuy dialog with presets and custom amount.
  - Cash-out dialog.
  - Session summary.
  - Session history.
  - Buy-in timeline expansion.
  - Completed players sort lower in active session.
  - Cash-out sorting in completed/summary views.

- ~~Phase 4.1: Host UI polish~~
  - Player rows converted from cards to clearer row layout.
  - Status text color adjusted for readability.
  - Hover cursor and smooth clickable transitions added globally.
  - Toast messages added for session actions.
  - Toast moved to bottom right and slowed enough to read.
  - Optional comments added to buy-ins and rebuys.
  - Comments displayed alongside amount for timeline consistency.
  - Admin can edit amount and comment.
  - Admin can soft-delete buy-in/rebuy entries.
  - Deleted entries remain visible, are struck through/lighter, move to the bottom, and no longer count toward totals.

- ~~Phase 5: Player UI~~
  - Player dashboard.
  - Player session detail.
  - Player-only transaction ledger.
  - Player dashboard sync fix so Supabase totals match host/admin data.
  - Direct player session detail refreshes Supabase data before showing not-found.

- ~~Phase 6: Backend connection and Supabase hardening~~
  - Angular store connected to Supabase.
  - RPC-backed session workflows connected.
  - Audit compatibility migration added.
  - Registered-player account support added.
  - Player directory access added.
  - Edge Functions added:
    - `create-registered-player`
    - `delete-registered-player`
  - Important migrations:
    - `supabase/migrations/20260626181000_phase_6_3_transaction_audit_compatibility.sql`
    - `supabase/migrations/20260626183500_phase_6_5_registered_player_accounts.sql`
    - `supabase/migrations/20260626192500_phase_6_6_player_directory_access.sql`

- ~~Phase 7: Admin players directory~~
  - Admin-only `/host/players` page.
  - Shows registered backend users with player role.
  - Shows linked buy-ins, cash-outs, net, active/completed sessions.
  - Admin can add player login.
  - Admin can delete player login through Edge Function.
  - Add-user layout aligned with input.
  - Removed unnecessary validation helper text from UI.

- ~~Phase 8: Mobile workflow QA and UI compression~~
  - Active session totals hidden on mobile to reduce noise.
  - Mobile player row shortened.
  - Row click expands buy-in timeline.
  - Mobile row keeps only important info: player name, total buy-in, Rebuy, Cash Out.
  - Horizontal overflow checked during release QA.

- ~~Phase 10: Deployment prep~~
  - `vercel.json` added.
  - SPA route rewrites added.
  - Production build command added: `npm run vercel-build`.
  - Node 22 deployment support added.
  - Vercel production deploy completed.
  - Production URL recorded in `README.md` and `PROJECT_STATUS.md`.

- ~~Phase 11: V1 release polish~~
  - Login fade-in and fade-out transition added.
  - Login button shows `Opening dashboard...` during route transition.
  - Production build hides development login helper.
  - Store naming cleaned up from prototype/mock naming to `PokerStoreService`.
  - V1 merged to `main`.
  - V1 deployed to Vercel production.
  - Release tag `v1.0.0` created and pushed.

## Remaining Phases

- Phase 9: Reporting and analytics
  - Host reporting dashboard.
  - Session/date filters.
  - Player performance summaries.
  - Export flow, likely CSV first.
  - Useful metrics:
    - Total buy-in by session/date.
    - Total cash-out by session/date.
    - Net by player.
    - Largest winners/losers.
    - Rebuy count and average rebuy.
    - Active vs completed sessions.

- Post-V1 hardening
  - Add more unit tests around store mapping and auth routing.
  - Add integration smoke tests for main host/player flows.
  - Production login smoke test after Supabase Auth URL Configuration is confirmed.
  - Review RLS policies again before real-money/real-customer use.
  - Add better error handling for unavailable Edge Functions.
  - Add admin password reset or invite flow for player accounts.
  - Add delete/restore strategy for sessions if product wants it later.

## Important Routes

- `/login`
- `/host/dashboard`
- `/host/sessions/new`
- `/host/sessions/:sessionId`
- `/host/sessions/:sessionId/summary`
- `/host/sessions/history`
- `/host/players`
- `/player/dashboard`
- `/player/sessions/:sessionId`

## Important Frontend Files

- `src/app/app.routes.ts`
- `src/app/core/auth/auth-state.service.ts`
- `src/app/core/auth/auth.guard.ts`
- `src/app/core/supabase/supabase.service.ts`
- `src/app/core/layout/host-shell.component.ts`
- `src/app/core/layout/player-shell.component.ts`
- `src/app/features/auth/login.page.ts`
- `src/app/features/host/data/poker-store.service.ts`
- `src/app/features/host/dashboard/host-dashboard.page.ts`
- `src/app/features/host/sessions/active-session.page.ts`
- `src/app/features/host/sessions/session-summary.page.ts`
- `src/app/features/host/sessions/session-history.page.ts`
- `src/app/features/host/players/add-player-dialog.component.ts`
- `src/app/features/host/players/players-admin.page.ts`
- `src/app/features/host/transactions/rebuy-dialog.component.ts`
- `src/app/features/host/transactions/cash-out-dialog.component.ts`
- `src/app/features/host/transactions/edit-buy-in-dialog.component.ts`
- `src/app/features/player/dashboard/player-dashboard.page.ts`
- `src/app/features/player/sessions/player-session-detail.page.ts`
- `src/styles.css`

## Important Supabase Files

- `supabase/README.md`
- `supabase/migrations/20260625180500_phase_2_database_foundation.sql`
- `supabase/migrations/20260626181000_phase_6_3_transaction_audit_compatibility.sql`
- `supabase/migrations/20260626183500_phase_6_5_registered_player_accounts.sql`
- `supabase/migrations/20260626192500_phase_6_6_player_directory_access.sql`
- `supabase/functions/create-registered-player/index.ts`
- `supabase/functions/delete-registered-player/index.ts`

## Data Model Summary

Tables:

- `users`: public profile for Supabase Auth users. Includes role `HOST` or `PLAYER`.
- `sessions`: poker sessions created by host.
- `players`: host-owned player records, optionally linked to a Supabase user.
- `session_players`: players seated in a session, with total buy-in, cash-out, net, status.
- `transactions`: transaction ledger for `BUYIN`, `REBUY`, `CASHOUT`.

Transaction fields include:

- `id`
- `amount`
- `created_at`
- `session_id`
- `player_id`
- `session_player_id`
- `type`
- `comment`
- `deleted_at`

Soft-deleted buy-in/rebuy entries keep their record but stop contributing to totals.

## Key Product Behaviors

- Rebuy preset buttons save immediately with no confirmation.
- Every buy-in/rebuy/cash-out records a timestamp.
- Optional comments can be added and edited.
- Completed players sort lower in active-session view.
- Completed/summary sorting prioritizes cash-out/net result display.
- Player row click expands the buy-in timeline.
- Player views are private and must not expose table totals.
- Host can add existing registered players from a dropdown.
- Host can create a new player login from manual input if no duplicate username exists.
- Newly created player accounts use temporary password `123456`.

## Supabase Setup Notes

In Supabase Auth URL Configuration, set:

- Site URL: `https://poker-tracker-hazel-theta.vercel.app`
- Redirect URLs:
  - `https://poker-tracker-hazel-theta.vercel.app/**`
  - any Vercel preview URL patterns that should be allowed

If production login fails but local login works, check:

- Supabase Auth Site URL and Redirect URLs.
- Environment values in `src/environments/environment.ts`.
- Whether the production deployment is the latest Vercel alias.
- Whether the user exists in `auth.users`.
- Whether the matching profile exists in `public.users`.
- Whether `public.users.role` is `HOST` or `PLAYER`.

## Vercel Notes

Vercel reads `vercel.json`.

Important settings:

- Build command: `npm run vercel-build`
- Output directory: `dist/pokertrack/browser`
- Route rewrite: all paths serve `/index.html`
- Node version: 22.x

Manual deploy command:

```bash
npx vercel --prod --yes
```

## Git Notes

Current release:

```bash
git checkout main
git pull
git log --oneline --decorate -5
git tag --points-at HEAD
```

Expected current release marker:

```text
v1.0.0
```

Recent release commits included:

- `chore(release): polish v1 login and store naming`
- `docs(deploy): record vercel production url`
- `chore(deploy): finalize vercel phase`
- `feat(deploy): prepare v1 mobile release`
- `feat(ui): improve session toast timing`

## Suggested Next Work Order

1. Confirm production login on Vercel using the real Supabase users.
2. Confirm player login privacy with `player123`.
3. Run one full host flow on production:
   - Create session.
   - Add existing player.
   - Add manually created player.
   - Record buy-in/rebuy with comment.
   - Edit comment.
   - Soft-delete rebuy.
   - Cash out.
   - Close session.
   - Open summary.
4. Start Phase 9 Reporting.
5. Add higher-value automated tests around store mapping, RLS assumptions, and routing.

## Known Non-Issues

- The development login hint appears locally and is expected.
- The development login hint should not appear on the Vercel production URL.
- The publishable Supabase key is safe to ship in the browser when RLS policies are correct.
- `service_role` and secret keys must never be shipped to Angular.

