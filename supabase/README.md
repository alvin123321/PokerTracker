# PokerTrack Supabase

This directory contains versioned SQL migrations for the PokerTrack backend.

Apply the migrations to a linked Supabase project:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Validate from a local Supabase stack:

```bash
supabase start
supabase db reset
```

Phase 2 is intentionally RPC-first for operational writes. The Angular app should call:

- `create_session`
- `add_player_to_session`
- `record_rebuy`
- `record_cashout`
- `close_session`

Hosts should read `session_summaries`. Players should read `player_session_results` and their own transactions.

Registered player creation uses the Edge Function in `functions/create-registered-player`.
Deploy it after applying the Phase 6.5 migration:

```bash
supabase functions deploy create-registered-player
```

The function creates player Auth accounts with a temporary development password of `123456`.
It requires the standard Supabase function environment values, including `SUPABASE_SERVICE_ROLE_KEY`.
