# Session Deletion, Feedback, and Mini-Game Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe completed-session deletion for host admins, keep action feedback below the top navigation, and correct the requested mini-game and player-dashboard presentation behaviors.

**Architecture:** Reuse the atomic `delete_session` RPC and `PokerStoreService.deleteSession` path, adding the missing completed-summary controls and state handling. Keep visual fixes in shared components or pure dashboard logic so all relevant views receive the same behavior without per-page duplication. Filter player mini-game history with the existing `viewerParticipantId`; global live-game visibility remains unchanged.

**Tech Stack:** Angular 20 standalone components and signals, Angular Material dialogs and menus, Lucide Angular icons, component/global CSS, Jasmine/Karma, Supabase PostgreSQL RPCs, pgTAP.

## Global Constraints

- Mobile is the primary layout target unless another viewport is explicitly named.
- Destructive confirmation uses visible No/Yes buttons; the user never types `confirm`.
- Registered member/player and authentication accounts survive completed-session deletion.
- Feedback overlays do not change document flow or move page content.
- Player mini-game history includes only games where `viewerParticipantId` is non-null.
- Active table games keep Game players before Game timeline; completed games reverse that order.
- Do not add a migration unless a database test proves the existing deletion path is insufficient.

## File Map

- `src/app/features/host/sessions/session-summary.page.ts`: completed-session delete menu and workflow.
- `src/app/features/host/sessions/session-summary.page.spec.ts`: role, status, cancellation, success, and failure tests.
- `src/app/features/host/shared/action-feedback-toast.component.ts`: shell-aware fixed toast offset.
- `src/app/features/host/shared/action-feedback-toast.component.spec.ts`: positioning regression test.
- `src/styles.css`: shell offsets and Material mini-game menu typography/alignment.
- `src/app/features/mini-game/mini-game-panel.component.spec.ts`: generated menu layout test.
- `src/app/features/mini-game/mini-game-dashboard-section.component.ts`: host empty state.
- `src/app/features/mini-game/mini-game-dashboard-section.component.spec.ts`: empty-state tests.
- `src/app/features/mini-game/mini-game-history-toggle.component.ts`: conditional mini-game option.
- `src/app/features/player/dashboard/player-dashboard.logic.ts`: history filter and detail order.
- `src/app/features/player/dashboard/player-dashboard.logic.spec.ts`: pure behavior tests.
- `src/app/features/player/dashboard/player-dashboard.page.ts`: history fallback and ordered rendering.
- `src/app/features/player/dashboard/player-dashboard.page.spec.ts`: rendered player-view tests.
- `supabase/tests/database/completed_session_delete.test.sql`: deletion/account-retention regression.

---

### Task 1: Completed-Session Delete Control

**Files:**
- Create: `src/app/features/host/sessions/session-summary.page.spec.ts`
- Modify: `src/app/features/host/sessions/session-summary.page.ts`

**Interfaces:**
- Consumes: `PokerStoreService.deleteSession(sessionId: string): Promise<void>`, `AuthStateService.isHostAdmin(): boolean`, `ConfirmationDialogComponent`, and `messageFromUnknownError`.
- Produces: `.session-summary-menu-trigger`, a completed-only deletion workflow, and history redirect.

- [ ] **Step 1: Write failing role, status, and cancellation tests**

Create a standalone-component test with mocked route, router, store, auth state, and dialog:

```ts
it('shows deletion only for a completed session viewed by the host admin', () => {
  const fixture = renderSummary(completedSession(), true);
  expect(fixture.nativeElement.querySelector('.session-summary-menu-trigger')).not.toBeNull();

  authState.isHostAdmin.and.returnValue(false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.session-summary-menu-trigger')).toBeNull();
});

it('keeps the session when No is selected', async () => {
  dialog.open.and.returnValue(dialogResult(false));
  const fixture = renderSummary(completedSession(), true);
  clickDeleteMenu(fixture);
  await fixture.whenStable();
  expect(store.deleteSession).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the spec and verify it fails**

```powershell
npm.cmd run test:ci -- --include src/app/features/host/sessions/session-summary.page.spec.ts
```

Expected: failure because the summary menu does not exist.

- [ ] **Step 3: Add the completed-only overflow menu**

Import `HostListener`, `OnDestroy`, `MatDialog`, `LucideEllipsis`, `Router`, `AuthStateService`, the confirmation dialog, action-feedback toast, and error parser. Render:

```html
@if (currentSession.status === 'COMPLETED' && authState.isHostAdmin()) {
  <div class="session-summary-menu" (click)="$event.stopPropagation()">
    <button
      type="button"
      class="session-summary-menu-trigger"
      aria-label="Session actions"
      [attr.aria-expanded]="sessionMenuOpen()"
      [disabled]="deletingSession()"
      (click)="toggleSessionMenu()"
    >
      <svg lucideEllipsis [strokeWidth]="2.3" aria-hidden="true"></svg>
    </button>
    @if (sessionMenuOpen()) {
      <div class="session-summary-menu-panel" role="menu">
        <button type="button" role="menuitem" (click)="confirmDeleteSession()">
          Delete session
        </button>
      </div>
    }
  </div>
}
```

Use a 44-by-44-pixel trigger, right-aligned viewport-safe menu, outside-click close, and Escape close.

- [ ] **Step 4: Implement confirmation, loading, error, and redirect**

Use this dialog data:

```ts
data: {
  title: 'Delete completed session?',
  message: 'This permanently deletes this session and all game records. Registered members remain available.',
  cancelLabel: 'No, keep session',
  confirmLabel: 'Yes, delete',
  tone: 'danger',
  details: [currentSession.name, playerCount, totalBuyIn],
}
```

After Yes, set `deletingSession`, call `store.deleteSession`, and run:

```ts
await this.router.navigateByUrl('/host/sessions/history', { replaceUrl: true });
```

On error, stay on the summary and show `messageFromUnknownError(error, 'Unable to delete this session.')` in the shared red feedback toast. Clear its timer in `ngOnDestroy`.

- [ ] **Step 5: Add success and failure tests**

```ts
expect(store.deleteSession).toHaveBeenCalledOnceWith('session-complete');
expect(router.navigateByUrl).toHaveBeenCalledWith('/host/sessions/history', {
  replaceUrl: true,
});
```

For a rejected store promise, assert the parsed message is visible and navigation is not called.

- [ ] **Step 6: Run focused and full Angular tests**

Run the focused command and `npm.cmd run test:ci`. Expected: all Angular tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/app/features/host/sessions/session-summary.page.ts src/app/features/host/sessions/session-summary.page.spec.ts
git commit -m "feat: delete completed sessions from history"
```

---

### Task 2: Shared Feedback Below Navigation

**Files:**
- Create: `src/app/features/host/shared/action-feedback-toast.component.spec.ts`
- Modify: `src/app/features/host/shared/action-feedback-toast.component.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `--pokertrack-action-feedback-top` inherited from the shell.
- Produces: a fixed, non-layout-shifting feedback card below the header.

- [ ] **Step 1: Write a failing position test**

```ts
it('uses the shell offset while remaining fixed outside document flow', () => {
  const fixture = TestBed.createComponent(ActionFeedbackToastComponent);
  fixture.componentRef.setInput('message', 'Rebuy successful.');
  fixture.nativeElement.style.setProperty('--pokertrack-action-feedback-top', '80px');
  fixture.detectChanges();
  const toast = fixture.nativeElement.querySelector('.action-feedback-toast');
  expect(getComputedStyle(fixture.nativeElement).position).toBe('fixed');
  expect(Number.parseFloat(getComputedStyle(toast).top)).toBeGreaterThan(80);
});
```

- [ ] **Step 2: Run the toast spec and verify it fails**

```powershell
npm.cmd run test:ci -- --include src/app/features/host/shared/action-feedback-toast.component.spec.ts
```

Expected: the current top value ignores the shell offset.

- [ ] **Step 3: Implement the shared offset**

Use `z-index: 70` on the fixed host and:

```css
.action-feedback-toast {
  top: calc(
    var(--pokertrack-action-feedback-top, 4.25rem) +
    max(0.65rem, env(safe-area-inset-top))
  );
}
```

Define shell values in `src/styles.css`:

```css
app-host-shell,
app-player-shell {
  --pokertrack-action-feedback-top: 4.25rem;
}

@media (min-width: 640px) {
  app-host-shell { --pokertrack-action-feedback-top: 8rem; }
  app-player-shell { --pokertrack-action-feedback-top: 4.75rem; }
}
```

Keep the overlay fixed and pointer-events disabled.

- [ ] **Step 4: Run focused and full Angular tests**

Run the focused command and `npm.cmd run test:ci`. Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/host/shared/action-feedback-toast.component.ts src/app/features/host/shared/action-feedback-toast.component.spec.ts src/styles.css
git commit -m "fix: place action feedback below navigation"
```

---

### Task 3: Mini-Game Menu and Host Empty State

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/features/mini-game/mini-game-panel.component.spec.ts`
- Modify: `src/app/features/mini-game/mini-game-dashboard-section.component.ts`
- Create: `src/app/features/mini-game/mini-game-dashboard-section.component.spec.ts`

**Interfaces:**
- Consumes: Angular Material `.mat-mdc-menu-item` and `.mat-mdc-menu-item-text`.
- Produces: app-font single-row menu items and `.mini-game-empty-section`.

- [ ] **Step 1: Add a failing generated-menu layout test**

After opening the existing menu, assert:

```ts
const item = document.querySelector<HTMLElement>('.mini-game-menu .mat-mdc-menu-item');
const content = item?.querySelector<HTMLElement>('.mat-mdc-menu-item-text');
expect(getComputedStyle(item!).fontFamily).toContain('Aptos');
expect(getComputedStyle(content!).display).toBe('flex');
expect(getComputedStyle(content!).alignItems).toBe('center');
```

- [ ] **Step 2: Add failing host empty-state tests**

Create a signal-based `MiniGameService` mock with no current game and no loading. For a `HOST` profile with `showCreate=true`, assert:

```ts
expect(compiled.querySelector('.mini-game-empty-heading')?.textContent).toContain('Mini game');
expect(compiled.querySelector('.mini-game-empty-heading svg')).not.toBeNull();
expect(compiled.querySelector('.mini-game-empty-action button')?.textContent)
  .toContain('Create mini game');
expect(compiled.textContent).not.toContain('No game running');
```

For a `PLAYER` profile, assert `.mini-game-empty-section` is absent.

- [ ] **Step 3: Run both specs and verify failure**

```powershell
npm.cmd run test:ci -- --include src/app/features/mini-game/mini-game-panel.component.spec.ts --include src/app/features/mini-game/mini-game-dashboard-section.component.spec.ts
```

Expected: the Material inner wrapper and requested empty state are missing.

- [ ] **Step 4: Fix overlay typography and icon alignment**

Use generated Material selectors in `src/styles.css`:

```css
.mini-game-menu .mat-mdc-menu-item {
  min-height: 2.8rem;
  color: rgb(226 232 240);
  font-family: Aptos, Inter, ui-sans-serif, system-ui, sans-serif !important;
  font-size: 0.75rem;
}

.mini-game-menu .mat-mdc-menu-item-text {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
}

.mini-game-menu .mat-mdc-menu-item-text svg {
  width: 0.95rem;
  height: 0.95rem;
  flex: 0 0 auto;
}
```

Keep `.mini-menu-danger` red and disabled options muted.

- [ ] **Step 5: Build the approved unframed host empty state**

```html
<section class="mini-game-empty-section">
  <div class="mini-game-empty-heading">
    <svg lucideDices [strokeWidth]="2.1" aria-hidden="true"></svg>
    <h2>Mini game</h2>
  </div>
  <div class="mini-game-empty-action">
    <button type="button" (click)="create()">
      <svg lucidePlus [strokeWidth]="2.2" aria-hidden="true"></svg>
      Create mini game
    </button>
  </div>
</section>
```

Use a subtle section divider, left-aligned heading, centered action, and no nested card.

- [ ] **Step 6: Run focused and full tests**

Run the focused command and `npm.cmd run test:ci`. Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/styles.css src/app/features/mini-game/mini-game-panel.component.spec.ts src/app/features/mini-game/mini-game-dashboard-section.component.ts src/app/features/mini-game/mini-game-dashboard-section.component.spec.ts
git commit -m "fix: refine mini-game controls and empty state"
```

---

### Task 4: Player History Eligibility and Completed Detail Order

**Files:**
- Modify: `src/app/features/mini-game/mini-game-history-toggle.component.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.logic.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.logic.spec.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.page.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.page.spec.ts`

**Interfaces:**
- Produces: `joinedMiniGameHistory(games: MiniGameSnapshot[]): MiniGameSnapshot[]`.
- Produces: `playerGameDetailSections(mode: PlayerGameStatMode): PlayerGameDetailSection[]`.
- Consumes: `MiniGameSnapshot.viewerParticipantId` and `MiniGameService.loadHistory()`.

- [ ] **Step 1: Write failing pure-logic tests**

```ts
it('keeps only mini-games joined by the current player', () => {
  const games = [
    miniGame({ id: 'joined', viewerParticipantId: 'participant-1' }),
    miniGame({ id: 'watched', viewerParticipantId: null }),
  ];
  expect(joinedMiniGameHistory(games).map((game) => game.id)).toEqual(['joined']);
});

it('puts timeline first only for completed table games', () => {
  expect(playerGameDetailSections('ACTIVE_GAME')).toEqual(['players', 'timeline']);
  expect(playerGameDetailSections('COMPLETED_GAME')).toEqual(['timeline', 'players']);
});
```

- [ ] **Step 2: Run the logic spec and verify failure**

```powershell
npm.cmd run test:ci -- --include src/app/features/player/dashboard/player-dashboard.logic.spec.ts
```

Expected: both helper exports are missing.

- [ ] **Step 3: Implement the pure helpers**

```ts
export type PlayerGameDetailSection = 'players' | 'timeline';

export function joinedMiniGameHistory(games: MiniGameSnapshot[]): MiniGameSnapshot[] {
  return games.filter((game) => game.viewerParticipantId !== null);
}

export function playerGameDetailSections(
  mode: PlayerGameStatMode,
): PlayerGameDetailSection[] {
  return mode === 'COMPLETED_GAME'
    ? ['timeline', 'players']
    : ['players', 'timeline'];
}
```

- [ ] **Step 4: Make the history icon and list participant-aware**

Add `readonly showMiniGames = input(true)` to `MiniGameHistoryToggleComponent`; render the second icon only when true and use one grid column when false.

In the player page add:

```ts
protected readonly joinedMiniGames = computed(() =>
  joinedMiniGameHistory(this.miniGame.history()),
);

protected readonly showMiniGameHistory = computed(
  () => this.miniGame.historyLoading() || this.joinedMiniGames().length > 0,
);
```

Pass `[showMiniGames]="showMiniGameHistory()"` and `[games]="joinedMiniGames()"`. Load mini-game history whenever the History tab activates. If `view=mini-games` resolves with no joined games, call `selectHistoryView('tables')`.

- [ ] **Step 5: Render detail sections from one ordered loop**

```html
@for (section of detailSections(statMode); track section) {
  @switch (section) {
    @case ('players') {
      <div class="feature-roster" data-detail-section="players">
        <div class="feature-detail-heading">
          <span>Game players</span>
          @if (statMode === 'ACTIVE_GAME') {
            <span class="feature-active-count">
              <svg lucideUsersRound [strokeWidth]="1.9" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
              <strong>{{ activePlayerCount(entry) }}</strong>
            </span>
          }
        </div>
        <div class="feature-player-list">
          @for (player of gamePlayers(entry); track player.sessionPlayerId) {
            <div
              class="feature-player-row"
              [class.feature-player-row-active]="player.status === 'ACTIVE'"
              [class.feature-player-row-cashed]="player.status === 'COMPLETED'"
              [class.feature-player-row-current]="player.sessionPlayerId === entry.player.id"
            >
              <span class="feature-player-dot" aria-hidden="true"></span>
              <strong>{{ player.name }}</strong>
              <span class="feature-player-status">
                {{ player.status === 'ACTIVE' ? 'Active' : 'Cashed' }}
              </span>
            </div>
          }
        </div>
      </div>
    }
    @case ('timeline') {
      <div data-detail-section="timeline">
        <div class="feature-detail-heading">
          <span>Game timeline</span>
        </div>
        <div class="feature-buyin-list">
          @for (transaction of gameTimelineRows(entry); track transaction.id) {
            <div
              class="feature-buyin-row"
              [class.feature-buyin-row-buyin]="transaction.type === 'BUYIN'"
              [class.feature-buyin-row-rebuy]="transaction.type === 'REBUY'"
              [class.feature-buyin-row-cashout]="transaction.type === 'CASHOUT'"
            >
              <span class="feature-buyin-type">{{ activityLabel(transaction.type) }}</span>
              <span class="feature-buyin-time">{{ transaction.createdAt | date: 'shortTime' }}</span>
              <strong>{{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
            </div>
          } @empty {
            <p class="activity-empty">No game timeline yet.</p>
          }
        </div>
      </div>
    }
  }
}
```

Each existing content block appears once. Expose `detailSections(mode)` as a thin call to `playerGameDetailSections(mode)`.

- [ ] **Step 6: Add rendered player-page tests**

With only unjoined history, assert the Mini-game history button is absent and a requested mini-game view falls back. With a joined snapshot, assert the icon appears and the list receives only joined games.

For completed and active sessions, collect:

```ts
const order = Array.from(
  compiled.querySelectorAll<HTMLElement>('[data-detail-section]'),
).map((section) => section.dataset['detailSection']);
```

Expect `['timeline', 'players']` for completed and `['players', 'timeline']` for active.

- [ ] **Step 7: Run focused and full tests**

Run both player-dashboard specs, then `npm.cmd run test:ci`. Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/app/features/mini-game/mini-game-history-toggle.component.ts src/app/features/player/dashboard/player-dashboard.logic.ts src/app/features/player/dashboard/player-dashboard.logic.spec.ts src/app/features/player/dashboard/player-dashboard.page.ts src/app/features/player/dashboard/player-dashboard.page.spec.ts
git commit -m "fix: personalize player mini-game history"
```

---

### Task 5: Database Deletion Regression

**Files:**
- Create: `supabase/tests/database/completed_session_delete.test.sql`
- Modify only if a test proves a defect: `supabase/migrations/20260715103000_harden_completed_session_delete.sql`

**Interfaces:**
- Consumes: `public.delete_session(uuid)` and existing cascading foreign keys.
- Produces: pgTAP evidence that game data is removed while the registered player remains.

- [ ] **Step 1: Write a transactional pgTAP fixture**

Insert one host, one registered player, one completed session, one table, one session-player row, buy-in/cash-out transactions, and one time-call row. Authenticate as the owning host and assert:

```sql
select lives_ok(
  $$select public.delete_session('31000000-0000-0000-0000-000000000001'::uuid)$$,
  'owning host can delete a completed session'
);

select is((select count(*) from public.sessions where id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'session removed');
select is((select count(*) from public.session_tables where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'tables removed');
select is((select count(*) from public.session_players where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'participation removed');
select is((select count(*) from public.transactions where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'transactions removed');
select is((select count(*) from public.time_calls where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'time calls removed');
select is((select count(*) from public.players where id = '32000000-0000-0000-0000-000000000001'), 1::bigint, 'registered player retained');
```

Finish with `select * from finish(); rollback;`.

- [ ] **Step 2: Run database tests and lint**

```powershell
npx.cmd supabase test db
npx.cmd supabase db lint --level warning
```

Expected: all pgTAP assertions pass and lint reports no new errors.

- [ ] **Step 3: Add a migration only if a dependency blocks deletion**

If the test demonstrates a real missing dependency delete, create an additive migration that updates `delete_session` while preserving `assert_host()`, dependency ordering, grants, and `notify pgrst, 'reload schema'`. Then run:

```powershell
npx.cmd supabase db reset
npx.cmd supabase test db
npx.cmd supabase db lint --level warning
```

If the original test passes, do not create a migration; record that production already has the required RPC.

- [ ] **Step 4: Commit**

```powershell
git add supabase/tests/database/completed_session_delete.test.sql supabase/migrations
git commit -m "test: verify completed session deletion cascade"
```

---

### Task 6: Integrated Verification and Release Readiness

**Files:**
- Modify only to correct defects found by verification.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: a clean, review-ready feature branch and local mobile preview.

- [ ] **Step 1: Run all automated checks**

```powershell
npm.cmd run test:ci
npx.cmd -y deno@2.5.6 test --allow-env supabase/functions/mini-game-action
npm.cmd run build
git diff --check
```

Expected: Angular and Edge Function tests pass, the production build succeeds with only existing documented budget warnings, and whitespace validation is clean.

- [ ] **Step 2: Verify completed-session controls at 390px**

Open a completed summary locally. Confirm the ellipsis is at the far right, the menu remains inside the viewport, and the dialog shows **No, keep session** and **Yes, delete**. Cancel once. Use a temporary test session for the successful deletion path, verify it disappears from history, and verify the registered member remains.

- [ ] **Step 3: Verify feedback geometry without layout movement**

Trigger a local add-player or rebuy action. Compare the header bottom and route-content rectangle before and during feedback. The toast top must be below the header bottom, and route-content coordinates must remain unchanged. Repeat a desktop sanity check.

- [ ] **Step 4: Verify mini-game states at mobile width**

- With no current mini-game, confirm the host sees dice + Mini game and a centered Create mini game button.
- Create a temporary local mini-game and confirm overflow-menu icons and labels share one row and use the app font.
- For a player with joined mini-game history, confirm only joined results appear.
- For a player with no joined mini-game history, confirm the mini-game history icon is absent and a direct query falls back to table history.
- Confirm a completed table game renders Timeline then Players and an active game renders Players then Timeline.

- [ ] **Step 5: Confirm backend and branch state**

```powershell
git status --short --branch
git log --oneline --decorate -8
```

Confirm the branch is clean. Confirm no migration was required, or apply and verify any migration created in Task 5 before calling the feature complete.

- [ ] **Step 6: Prepare the review summary**

Report exact test totals, build warnings, browser checks, database test result, migration status, and `http://localhost:4200`. Do not merge until the user requests the normal go-live flow.
