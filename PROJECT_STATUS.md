# PokerTrack Project Status

## Current State

PokerTrack is an Angular 20+ poker session management app in active development.

The app currently runs with development mock authentication and localStorage-backed mock poker data. Supabase schema work exists, but the Angular UI is not yet connected to live Supabase data.

## Mock Login

- Host: `admin` / `admin`
- Player: `player` / `player`

## Completed Work

- Angular project scaffold with standalone components.
- Tailwind CSS, Angular Material, and routing setup.
- Supabase client configuration placeholders.
- Supabase SQL migration foundation.
- Mock authentication and role-based routing.
- Host dashboard, session creation, active session, session history, and summary screens.
- Add player with preset buy-ins and optional comments.
- Rebuy workflow with preset buttons, custom amount, and optional comments.
- Cash-out workflow with projected net.
- Expandable host player rows.
- Editable buy-in/rebuy amount and comment.
- Soft-delete for buy-in/rebuy entries.
- Player-only dashboard and private transaction ledger.

## Important Behavior

- Rebuy preset buttons save immediately without confirmation.
- Deleted buy-in/rebuy entries remain visible, move to the bottom of the timeline, appear lighter with strikethrough styling, and no longer count toward totals.
- Deleted entries can still have comments edited.
- Player views only show the logged-in mock player's own session data.

## Remaining Work

- Connect Angular services to Supabase RPCs/tables.
- Replace mock auth with Supabase Auth.
- Enforce Supabase RLS policies for host/player access.
- Add production loading, error, and toast states.
- Add report filters and export flows.
- Configure Vercel deployment.

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
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng build"
```

Run tests:

```bash
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless"
```
