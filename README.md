# PokerTrack

PokerTrack is a mobile-first poker session management app for hosts and players.

Hosts can create sessions, add registered players, record buy-ins/rebuys, cash players out, close sessions, and manage player accounts. Players can sign in and only view their own session history, buy-ins, rebuys, cash-outs, and net results.

## Stack

- Angular 20 standalone components
- TypeScript
- Tailwind CSS
- Angular Material dialogs
- Supabase Auth, PostgreSQL, RLS, RPCs, and Edge Functions
- Vercel deployment

## Development Login

- Host: `admin1223` / `admin1223`
- Player: `player123` / `player123`
- Auto-created player password: `123456`

Short login names are expanded to `@pokertrack.local` by the app.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app with Node 22:

```bash
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng serve --host 127.0.0.1 --port 4201"
```

Build:

```bash
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng build"
```

Test:

```bash
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless"
```

## Supabase

Production environment values are currently set in:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`

Database migrations and Edge Functions live in `supabase/`.

## Vercel

Use these settings:

- Framework preset: Angular
- Build command: `npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng build"`
- Output directory: `dist/pokertrack/browser`
- Node version: 22.x

`vercel.json` rewrites all routes to `index.html` so deep links like `/host/sessions/:id` and `/player/sessions/:id` work after refresh.
