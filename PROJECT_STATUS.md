# PokerTrack Project Status

## Current State

PokerTrack is an Angular 20+ poker session management app connected to Supabase Auth, PostgreSQL tables, RLS policies, RPCs, and Edge Functions.

The V1 focus is live-game speed for hosts and private player history for players. Reporting is intentionally deferred to the final phase.

## Development Login

- Host: `admin1223` / `admin1223`
- Player: `player123` / `player123`
- Auto-created players use temporary password `123456`.
- Short login names are expanded to `@pokertrack.local` by the Angular auth service.

## Completed Work

- Angular project scaffold with standalone components.
- Tailwind CSS, Angular Material, and routing setup.
- Supabase client configuration.
- Supabase SQL migration foundation, RLS policies, RPCs, and registered-player Edge Functions.
- Supabase authentication and role-based routing.
- Host dashboard, session creation, active session, session history, and summary screens.
- Add player with preset buy-ins and optional comments.
- Rebuy workflow with preset buttons, custom amount, and optional comments.
- Cash-out workflow with projected net.
- Expandable host player rows.
- Editable buy-in/rebuy amount and comment.
- Soft-delete for buy-in/rebuy entries.
- Player-only dashboard and private transaction ledger.
- Admin-only registered Players page with add/delete and player detail.
- Mobile active-session compaction for fast rebuy and cash-out workflows.
- Floating host action toast for pending/success/error feedback.
- Vercel deployment configuration with production build command, output directory, Node version, and SPA route rewrite.

## Important Behavior

- Rebuy preset buttons save immediately without confirmation.
- Deleted buy-in/rebuy entries remain visible, move to the bottom of the timeline, appear lighter with strikethrough styling, and no longer count toward totals.
- Deleted entries can still have comments edited.
- Player views only show the logged-in player's own session data.
- Host add-player can select an existing registered player or create a new player login.
- Direct player session links refresh Supabase data before showing a not-found state.

## Remaining Work

- GitHub branch cleanup and merge to `main`.
- Reporting dashboard, filters, analytics, and export flows.
- External deployment handoff: connect the GitHub repo to Vercel, deploy, then add the deployed URL to Supabase Auth Site URL and Redirect URLs.

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server with Node 22:

```bash
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng serve --host 127.0.0.1 --port 4200"
```

Run build:

```bash
npm run build:prod
```

Run tests:

```bash
npm run test:ci
```

## Vercel Deployment

- Framework preset: Angular.
- Build command: `npm run vercel-build`.
- Output directory: `dist/pokertrack/browser`.
- Node version: 22.x from `.nvmrc` and `package.json`.
- Supabase URL and publishable key are currently configured in `src/environments/environment.ts`.
- In Supabase Auth URL Configuration, add the deployed Vercel URL to Site URL and Redirect URLs before production login testing.
