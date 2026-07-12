# Session Detail Cash-Out and Player Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default-open the first session table, expose editable cash-outs in timelines, prevent duplicate session members, and sort completed players by net.

**Architecture:** Put ordering rules in pure helpers with Jasmine coverage. Pass session member user IDs to the existing dialog from both host surfaces. Reuse the existing cash-out dialog and `recordCashOut` RPC path; no database schema changes are required.

**Tech Stack:** Angular standalone components, signals/reactive forms, TypeScript, Jasmine/Karma, existing Supabase RPCs.

## Global Constraints

- Mobile-first verification at 390px width.
- Active players remain above completed players.
- Completed players sort by net descending, then existing name/join-time tie-breakers.
- Existing session members remain visible but disabled at the bottom of player search.

---

### Task 1: Shared Sorting and Timeline Tests

**Files:**
- Modify: `src/app/features/host/dashboard/host-dashboard.logic.ts`
- Modify: `src/app/features/host/dashboard/host-dashboard.logic.spec.ts`
- Create or modify: `src/app/features/host/data/session-timeline.logic.spec.ts`

**Interfaces:** Add optional `net?: number` to `DashboardTablePlayerSortInput`; preserve `sortDashboardTablePlayers` and `gameTimelineTransactions` exports.

- [ ] Write failing Jasmine test: completed players with nets `250` and `-100` sort as `250`, then `-100`, after active players.
- [ ] Run `npm.cmd run test:ci -- --include='**/host-dashboard.logic.spec.ts'`; observe expected failure.
- [ ] Add net descending comparison only when both players are `COMPLETED`; retain existing tie-breakers.
- [ ] Add timeline test proving a `CASHOUT` transaction is returned by `gameTimelineTransactions`.
- [ ] Re-run focused tests; commit as `Sort cashed-out players by net`.

### Task 2: Duplicate-Safe Player Search

**Files:**
- Create: `src/app/features/host/players/add-player-dialog.logic.ts`
- Create: `src/app/features/host/players/add-player-dialog.logic.spec.ts`
- Modify: `src/app/features/host/players/add-player-dialog.component.ts`
- Modify: `src/app/features/host/sessions/active-session.page.ts`
- Modify: `src/app/features/host/dashboard/host-dashboard.page.ts`

**Interfaces:** `sortRegisteredPlayerOptions<T extends { id: string }>(players: T[], sessionMemberUserIds: readonly string[]): T[]`; add `sessionMemberUserIds` to `AddPlayerDialogData`.

- [ ] Write failing test showing an existing member sorts after an available member.
- [ ] Run `npm.cmd run test:ci -- --include='**/add-player-dialog.logic.spec.ts'`; observe expected missing-helper failure.
- [ ] Implement helper using a `Set` of existing IDs; preserve original order within selectable and disabled groups.
- [ ] Pass every current session player's non-null `playerUserId` into the dialog from both callers.
- [ ] Render matching members disabled, muted, labelled `Already in game`, and defend `selectRegisteredPlayer` against them.
- [ ] Re-run focused test; commit as `Disable existing session members in player search`.

### Task 3: Default Table and Editable Cash-Out Timelines

**Files:**
- Modify: `src/app/features/host/sessions/active-session.page.ts`
- Modify: `src/app/features/host/dashboard/host-dashboard.page.ts`
- Test: `src/app/features/host/sessions/active-session*.spec.ts` when extracting a pure first-table helper.

**Interfaces:** Reuse `gameTimelineTransactions`, active-session `openCashOutDialog(player)`, dashboard `openCashOutDialog(sessionId, player)`, and store `recordCashOut`.

- [ ] Write a failing helper test asserting `initialExpandedTableIds([{ id: 'first' }, { id: 'second' }])` returns `['first']`.
- [ ] Run focused test; observe expected missing-helper failure.
- [ ] Initialize the session detail’s expanded table IDs with only the first loaded table, while retaining user toggles afterward.
- [ ] Use `gameTimelineTransactions` for session-detail timeline rows; make active cash-out entries accessible buttons that open the existing edit dialog.
- [ ] Add the same cash-out edit affordance to dashboard timeline rows without bringing back completed-row actions.
- [ ] Run `npm.cmd run test:ci` and `npm.cmd run build`; both must exit 0.
- [ ] Run local server and mobile browser verification at 390px for first-table expansion, cash-out edit, disabled existing members, and net descending completed groups.
- [ ] Commit as `Improve session cashout timeline controls`.
