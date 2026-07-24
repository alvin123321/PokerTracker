import { Component, input, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { GlobalChatPage } from '../../chat/global-chat.page';
import { MiniGameDashboardSectionComponent } from '../../mini-game/mini-game-dashboard-section.component';
import { MiniGameHistoryListComponent } from '../../mini-game/mini-game-history-list.component';
import type { MiniGameSnapshot } from '../../mini-game/mini-game.models';
import {
  type MiniGameHistoryLoadResult,
  MiniGameService
} from '../../mini-game/mini-game.service';
import type {
  PlayerActiveTable,
  PokerSession,
  SessionPlayer
} from '../../host/data/poker-store.service';
import { PokerStoreService } from '../../host/data/poker-store.service';
import { PlayerDashboardPage } from './player-dashboard.page';

@Component({
  selector: 'app-global-chat-page',
  template: ''
})
class GlobalChatPageStub {
  readonly compact = input(false);
}

@Component({
  selector: 'app-mini-game-dashboard-section',
  template: ''
})
class MiniGameDashboardSectionStub {}

function findStyleRuleContaining(...selectorFragments: string[]): CSSStyleRule | undefined {
  const visit = (rules: CSSRuleList): CSSStyleRule | undefined => {
    for (const rule of Array.from(rules)) {
      if (
        rule instanceof CSSStyleRule &&
        selectorFragments.every((fragment) => rule.selectorText.includes(fragment))
      ) {
        return rule;
      }

      if ('cssRules' in rule) {
        const nestedRule = visit((rule as CSSGroupingRule).cssRules);
        if (nestedRule) {
          return nestedRule;
        }
      }
    }

    return undefined;
  };

  for (const stylesheet of Array.from(document.styleSheets)) {
    const rule = visit(stylesheet.cssRules);
    if (rule) {
      return rule;
    }
  }

  return undefined;
}

describe('PlayerDashboardPage', () => {
  let fixture: ComponentFixture<PlayerDashboardPage>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let sessions: WritableSignal<PokerSession[]>;
  let playerActiveTables: WritableSignal<PlayerActiveTable[]>;
  let miniGameHistory: WritableSignal<MiniGameSnapshot[]>;
  let miniGameHistoryLoading: WritableSignal<boolean>;
  let miniGameError: WritableSignal<string | null>;
  let miniGameLoadHistory: jasmine.Spy;
  let miniGameLoadLatestHistory: jasmine.Spy;

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject(convertToParamMap({ tab: 'chat' }));
    const authState = {
      profile: signal({ displayName: 'Player' }),
      user: signal({ id: 'player-1' })
    };
    sessions = signal<PokerSession[]>([]);
    playerActiveTables = signal<PlayerActiveTable[]>([]);
    miniGameHistory = signal<MiniGameSnapshot[]>([]);
    miniGameHistoryLoading = signal(false);
    miniGameError = signal<string | null>(null);
    miniGameLoadHistory = jasmine
      .createSpy('loadHistory')
      .and.callFake(async () => ({
        history: miniGameHistory(),
        success: true,
        current: true
      }));
    miniGameLoadLatestHistory = jasmine
      .createSpy('loadLatestHistory')
      .and.callFake(() => miniGameLoadHistory());
    const store = {
      sessions: sessions.asReadonly(),
      playerActiveTables: playerActiveTables.asReadonly(),
      error: signal<string | null>(null),
      refreshSessions: jasmine.createSpy('refreshSessions').and.resolveTo(),
      activeTimeCallForSession: () => undefined,
      isTimeCallStarting: () => false,
      remainingTimeCallsForPlayer: () => 3,
      timeCallSchemaReady: () => true,
      canRequestTimeCall: () => true,
      playerPublicTableRoster: signal([]),
      playerPublicTableSummaries: signal([]),
      supportsSharedSessionUpdates: () => true
    };
    const miniGame = {
      history: miniGameHistory.asReadonly(),
      historyLoading: miniGameHistoryLoading.asReadonly(),
      error: miniGameError.asReadonly(),
      loadHistory: miniGameLoadHistory,
      loadLatestHistory: miniGameLoadLatestHistory
    };

    await TestBed.configureTestingModule({
      imports: [PlayerDashboardPage, RouterTestingModule],
      providers: [
        { provide: AuthStateService, useValue: authState },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap,
            snapshot: {
              queryParamMap: queryParamMap.value
            }
          }
        },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: PokerStoreService, useValue: store },
        { provide: MiniGameService, useValue: miniGame }
      ]
    })
      .overrideComponent(PlayerDashboardPage, {
        remove: { imports: [GlobalChatPage, MiniGameDashboardSectionComponent] },
        add: { imports: [GlobalChatPageStub, MiniGameDashboardSectionStub] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PlayerDashboardPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) {
      fixture.destroy();
    }
  });

  it('uses the full chat layout in the player chat tab', () => {
    const chat = fixture.debugElement.query(By.directive(GlobalChatPageStub));

    expect(chat).not.toBeNull();
    expect(chat.componentInstance.compact()).toBeFalse();
  });

  it('returns from chat to Home when the shell updates the route and restores the player tabs', () => {
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.player-dashboard-chat-active')).toBeNull();
    expect(compiled.querySelector('.player-tabs')).not.toBeNull();
  });

  it('writes the Chat selection to the URL so the shell back link can return Home', () => {
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const chatButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.player-tab')
    ).find((button) => button.textContent?.includes('Chat'));

    chatButton?.click();

    expect(chatButton).toBeDefined();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { tab: 'chat' },
      queryParamsHandling: 'merge'
    });
  });

  it('hides the player bottom tabs while mobile chat is active', () => {
    const hiddenTabsRule = findStyleRuleContaining(
      '.player-dashboard-chat-active',
      '.player-tabs'
    );

    expect(hiddenTabsRule).toBeDefined();
    expect(hiddenTabsRule?.style.display).toBe('none');
  });

  it('uses a light digital font for the game players and game timeline headings', () => {
    const headingRule = findStyleRuleContaining('feature-detail-heading', 'span', ':first-child');

    expect(headingRule).toBeDefined();
    expect(headingRule?.style.fontFamily).toContain('Share Tech Mono');
    expect(headingRule?.style.fontWeight).toBe('400');
  });

  it('loads joined mini-game history when the History tab is tapped from Home', async () => {
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();
    miniGameLoadHistory.calls.reset();
    miniGameLoadHistory.and.callFake(async () => {
      const history = [makeMiniGame({ id: 'joined-from-home', viewerParticipantId: 'participant-1' })];
      miniGameHistory.set(history);
      return { history, success: true, current: true };
    });

    const historyButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.player-tab')
    ).find((button) => button.textContent?.includes('History'));
    historyButton?.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(historyButton).toBeDefined();
    expect(miniGameLoadHistory).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Mini-game history"]')).not.toBeNull();
  });

  it('hides unjoined mini-game history and requests a table history fallback', async () => {
    miniGameHistory.set([makeMiniGame({ viewerParticipantId: null })]);
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(miniGameLoadHistory).toHaveBeenCalled();
    expect(compiled.querySelector('[aria-label="Mini-game history"]')).toBeNull();
    expect(selectHistoryView).toHaveBeenCalledWith('tables');
  });

  it('uses the latest winning history request when deciding the empty-history fallback', async () => {
    miniGameLoadHistory.and.resolveTo({ history: [], success: true, current: false });
    miniGameLoadLatestHistory.and.resolveTo({ history: [], success: true, current: true });
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();

    expect(miniGameLoadLatestHistory).toHaveBeenCalled();
    expect(selectHistoryView).toHaveBeenCalledWith('tables');
  });

  it('keeps mini-game history selected when loading history fails', async () => {
    miniGameLoadHistory.and.callFake(async () => {
      miniGameHistoryLoading.set(true);
      miniGameError.set('Unable to load mini-game history.');
      miniGameHistoryLoading.set(false);
      return { history: [], success: false, current: true };
    });
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load mini-game history.'
    );
    expect(selectHistoryView).not.toHaveBeenCalled();
  });

  it('keeps mini-game history available while loading before falling back on empty success', async () => {
    let resolveHistory!: (history: MiniGameSnapshot[]) => void;
    miniGameLoadHistory.and.callFake(() => {
      miniGameHistoryLoading.set(true);
      miniGameError.set(null);

      return new Promise((resolve) => {
        resolveHistory = (history) => {
          miniGameHistory.set(history);
          miniGameHistoryLoading.set(false);
          resolve({ history, success: true, current: true });
        };
      });
    });
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[aria-label="Mini-game history"]')).not.toBeNull();
    expect(selectHistoryView).not.toHaveBeenCalled();

    resolveHistory([]);
    await Promise.resolve();

    expect(selectHistoryView).toHaveBeenCalledWith('tables');
  });

  it('does not fall back for an empty success from a stale history request', async () => {
    miniGameHistoryLoading.set(true);
    miniGameLoadHistory.and.resolveTo({ history: [], success: true, current: false });
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();

    expect(selectHistoryView).not.toHaveBeenCalled();
  });

  it('does not fall back after leaving History while the history request is loading', async () => {
    const request = deferred<MiniGameHistoryLoadResult>();
    miniGameLoadHistory.and.returnValue(request.promise);
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();
    fixture.detectChanges();
    const homeButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.player-tab[aria-label="Home"]'
    );

    homeButton?.click();
    request.resolve({ history: [], success: true, current: true });
    await request.promise;
    await Promise.resolve();

    expect(homeButton).not.toBeNull();
    expect(selectHistoryView).not.toHaveBeenCalled();
  });

  it('does not fall back after the dashboard is destroyed while history is loading', async () => {
    const request = deferred<MiniGameHistoryLoadResult>();
    miniGameLoadHistory.and.returnValue(request.promise);
    const selectHistoryView = spyOn(fixture.componentInstance as any, 'selectHistoryView');

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();
    fixture.destroy();
    request.resolve({ history: [], success: true, current: true });
    await request.promise;
    await Promise.resolve();

    expect(selectHistoryView).not.toHaveBeenCalled();
  });

  it('shows the mini-game history icon and passes only joined games to the list', async () => {
    miniGameHistory.set([
      makeMiniGame({ id: 'joined', viewerParticipantId: 'participant-1' }),
      makeMiniGame({ id: 'watched', viewerParticipantId: null })
    ]);

    queryParamMap.next(convertToParamMap({ tab: 'history', view: 'mini-games' }));
    await Promise.resolve();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const historyList = fixture.debugElement.query(By.directive(MiniGameHistoryListComponent));

    expect(compiled.querySelector('[aria-label="Mini-game history"]')).not.toBeNull();
    expect(historyList).not.toBeNull();
    if (historyList) {
      expect((historyList.componentInstance as MiniGameHistoryListComponent).games().map((game) => game.id)).toEqual([
        'joined'
      ]);
    }
  });

  it('renders completed game details with the timeline before players', () => {
    sessions.set([makeSession({ status: 'COMPLETED', players: [makePlayer({ status: 'COMPLETED' })] })]);

    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    expect(detailSectionOrder(fixture)).toEqual(['timeline', 'players']);
  });

  it('shows unseated active tables before completed history and restores history when the directory clears', () => {
    playerActiveTables.set([makeActiveTable()]);
    sessions.set([makeSession({ status: 'COMPLETED', players: [makePlayer({ status: 'COMPLETED' })] })]);
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.player-active-table-card')).not.toBeNull();
    expect(compiled.querySelector('.player-active-table-name')?.textContent).toContain('Main Table');
    expect(compiled.querySelector('.player-feature-card-completed')).toBeNull();

    playerActiveTables.set([]);
    fixture.detectChanges();

    expect(compiled.querySelector('.player-feature-card-completed')).not.toBeNull();

    playerActiveTables.set([makeActiveTable()]);
    sessions.set([
      makeSession({
        players: [makePlayer({ tableId: 'table-a' })]
      })
    ]);
    fixture.detectChanges();

    expect(compiled.querySelector('.player-active-table-card')).toBeNull();
    expect(compiled.querySelector('.player-feature-card-active')).not.toBeNull();
  });

  it('renders every seated active table as a detailed card', () => {
    sessions.set([
      makeSession({
        id: 'session-new',
        name: 'Newest Seated Game',
        players: [
          makePlayer({
            id: 'seat-new',
            tableId: 'table-new',
            joinedAt: '2026-07-08T03:00:00.000Z'
          })
        ]
      }),
      makeSession({
        id: 'session-old',
        name: 'Older Seated Game',
        players: [
          makePlayer({
            id: 'seat-old',
            tableId: 'table-old',
            joinedAt: '2026-07-08T02:00:00.000Z'
          })
        ]
      })
    ]);

    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const cardTitles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.player-feature-card-active h2'
      )
    ).map((heading) => heading.textContent?.trim());

    expect(cardTitles).toEqual(['Newest Seated Game', 'Older Seated Game']);
  });

  it('renders seated detailed cards before every unseated active-table card', () => {
    sessions.set([
      makeSession({
        id: 'session-seated',
        name: 'Seated Game',
        players: [makePlayer({ tableId: 'table-seated' })]
      })
    ]);
    playerActiveTables.set([
      makeActiveTable({ tableId: 'table-unseated-1', tableName: 'Unseated One' }),
      makeActiveTable({ tableId: 'table-seated', tableName: 'Seated Table' }),
      makeActiveTable({
        tableId: 'table-unseated-2',
        tableName: 'Unseated Two',
        tableNumber: 2
      })
    ]);

    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const liveCards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.player-feature-card-active, .player-active-table-card'
      )
    );

    expect(liveCards.map((card) => card.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      jasmine.stringContaining('Seated Game'),
      jasmine.stringContaining('Unseated One'),
      jasmine.stringContaining('Unseated Two')
    ]);
  });

  it('keeps active game details with players before the timeline', () => {
    sessions.set([makeSession({ players: [makePlayer()] })]);

    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    expect(detailSectionOrder(fixture)).toEqual(['players', 'timeline']);
  });

  it('shows a completed tip-only session to a manager without linking to player details', () => {
    sessions.set([
      makeSession({
        status: 'COMPLETED',
        players: [],
        financialEntries: [makeFinancialEntry({ amount: 350 })]
      })
    ]);

    queryParamMap.next(convertToParamMap({ tab: 'history' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tipCard = compiled.querySelector<HTMLElement>('.manager-tip-session-tile');

    expect(tipCard).not.toBeNull();
    expect(tipCard?.textContent).toContain('My tips');
    expect(tipCard?.textContent).toContain('$350');
    expect(tipCard?.closest('a')).toBeNull();
  });

  it('adds the manager tip amount to a normal played-session history card', () => {
    sessions.set([
      makeSession({
        status: 'COMPLETED',
        players: [makePlayer({ status: 'COMPLETED' })],
        financialEntries: [makeFinancialEntry({ amount: 125 })]
      })
    ]);

    queryParamMap.next(convertToParamMap({ tab: 'history' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const gameCard = compiled.querySelector<HTMLElement>('a.session-tile');

    expect(gameCard?.textContent).toContain('My tips');
    expect(gameCard?.textContent).toContain('$125');
  });

  it('places the active status at the far right of the live-card heading', () => {
    sessions.set([makeSession({ players: [makePlayer()] })]);
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const heading = (fixture.nativeElement as HTMLElement).querySelector(
      '.player-feature-card-active .feature-heading'
    );

    expect(heading?.querySelector(':scope > .game-status-pill')).not.toBeNull();
  });

  it('uses the shared detail-section wrapper and actual adjacency for section spacing', () => {
    sessions.set([makeSession({ players: [makePlayer()] })]);
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const sections = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-detail-section]')
    );
    const spacingRule = findStyleRuleContaining(
      '.feature-detail-section',
      '+',
      '.feature-detail-heading'
    );

    expect(sections.length).toBe(2);
    expect(sections.every((section) => section.classList.contains('feature-detail-section'))).toBeTrue();
    expect(spacingRule).toBeDefined();
    expect(spacingRule?.style.marginTop).toBe('0.82rem');
  });
});

function detailSectionOrder(fixture: ComponentFixture<PlayerDashboardPage>): Array<string | undefined> {
  const compiled = fixture.nativeElement as HTMLElement;

  return Array.from(compiled.querySelectorAll<HTMLElement>('[data-detail-section]')).map(
    (section) => section.dataset['detailSection']
  );
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function makeMiniGame(overrides: Partial<MiniGameSnapshot> = {}): MiniGameSnapshot {
  return {
    id: 'mini-game-a',
    creatorHostId: 'host-a',
    name: 'Holdem',
    minPlayers: 2,
    maxPlayers: 6,
    status: 'COMPLETE',
    isCurrent: false,
    stateVersion: 1,
    equityVersion: 1,
    equityStatus: 'READY',
    createdAt: '2026-07-08T01:00:00.000Z',
    updatedAt: '2026-07-08T01:00:00.000Z',
    completedAt: '2026-07-08T02:00:00.000Z',
    archivedAt: null,
    activePlayerCount: 2,
    viewerParticipantId: 'participant-a',
    viewerCelebrationSeen: true,
    board: [],
    participants: [],
    winnerParticipantIds: [],
    ...overrides
  };
}

function makeSession(overrides: Partial<PokerSession> = {}): PokerSession {
  return {
    id: 'session-a',
    name: 'July 8 Game',
    sessionDate: '2026-07-08',
    status: 'ACTIVE',
    createdAt: '2026-07-08T01:00:00.000Z',
    closedAt: null,
    tables: [],
    players: [],
    transactions: [],
    timeCalls: [],
    ...overrides
  };
}

function makePlayer(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'seat-a',
    tableId: null,
    userId: 'player-1',
    name: 'Player',
    status: 'ACTIVE',
    totalBuyIn: 100,
    cashOut: 0,
    net: 0,
    joinedAt: '2026-07-08T01:00:00.000Z',
    completedAt: null,
    ...overrides
  };
}

function makeActiveTable(overrides: Partial<PlayerActiveTable> = {}): PlayerActiveTable {
  return {
    sessionId: 'session-a',
    sessionName: 'July 8 Game',
    sessionDate: '2026-07-08',
    sessionCreatedAt: '2026-07-08T01:00:00.000Z',
    tableId: 'table-a',
    tableName: 'Main Table',
    tableNumber: 1,
    tableCreatedAt: '2026-07-08T01:00:00.000Z',
    ...overrides
  };
}

function makeFinancialEntry(
  overrides: Partial<NonNullable<PokerSession['financialEntries']>[number]> = {}
): NonNullable<PokerSession['financialEntries']>[number] {
  return {
    id: 'tip-a',
    sessionId: 'session-a',
    entryType: 'TIP',
    amount: 100,
    managerUserId: 'player-1',
    managerName: 'Player',
    createdAt: '2026-07-08T01:00:00.000Z',
    createdBy: 'host-a',
    createdByName: 'Admin',
    updatedAt: '2026-07-08T01:00:00.000Z',
    updatedBy: 'host-a',
    updatedByName: 'Admin',
    revisions: [],
    ...overrides
  };
}
