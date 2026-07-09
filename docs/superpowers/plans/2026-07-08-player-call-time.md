# Player Call Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete player Call Time so a player tap immediately starts a 30-second admin-side clock.

**Architecture:** The existing call-time branch already contains the Supabase table/RPC migration, store methods, player call-time button, and session overview screen. This plan finishes the confirmed admin mobile `Clock` tab and verifies player-to-admin countdown behavior.

**Tech Stack:** Angular standalone components, Supabase/Postgres migration, Supabase realtime/store refresh, existing PokerTracker CSS.

## Global Constraints

- Admin mobile bottom navigation tab label is `Clock`.
- Desktop host nav label remains `Session Overview`.
- Player gets 3 call-time uses per session.
- Timer duration is 30 seconds.
- Only one timer can run per session at a time.
- Cancelled timers do not consume a use.
- Build command is `npm.cmd run build`.
- Do not mutate production data during development testing.

---

### Task 1: Add Admin Mobile Clock Tab

**Files:**
- Modify: `src/app/core/layout/host-shell.component.ts`

**Interfaces:**
- Consumes: existing `/host/session-overview` route.
- Produces: mobile bottom-nav link labeled `Clock` via `aria-label` and screen-reader text.

- [x] **Step 1: Add icon import**

Use `LucideAlarmClock` from `@lucide/angular` because the player UI already uses the same icon family.

- [x] **Step 2: Add mobile nav item**

Insert a mobile tab after Dashboard:

```html
<a routerLink="/host/session-overview" routerLinkActive="host-mobile-tab-active" class="host-mobile-tab" aria-label="Clock">
  <svg lucideAlarmClock class="pokertrack-nav-icon" [strokeWidth]="3" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
  <span class="sr-only">Clock</span>
</a>
```

- [x] **Step 3: Verify build**

Run: `npm.cmd run build`

Expected: PASS.

---

### Task 2: Verify Player-to-Admin Countdown

**Files:**
- Read/verify: `src/app/features/player/dashboard/player-dashboard.page.ts`
- Read/verify: `src/app/features/host/overview/session-overview.page.ts`
- Read/verify: `src/app/features/host/data/poker-store.service.ts`

**Interfaces:**
- Consumes: `requestTimeCall(sessionId, sessionPlayerId)`.
- Produces: visible countdown from `activeTimeCallForSession(session)` on `/host/session-overview`.

- [x] **Step 1: Confirm player action path**

Verify player button calls:

```ts
await this.store.requestTimeCall(entry.session.id, entry.player.id);
```

- [x] **Step 2: Confirm admin display path**

Verify overview reads:

```ts
const activeCall = store.activeTimeCallForSession(session);
store.secondsRemainingFor(activeCall);
```

- [x] **Step 3: Browser test**

Run local app, sign in as a player, tap Call Time, open admin `Clock`/`Session Overview`, and confirm the countdown starts at 30 and decreases immediately.

- [x] **Step 4: Regression check**

Confirm dashboard, history, members, and pot calculator routes still load.
