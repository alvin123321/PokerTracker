import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import type { PokerSession, SessionPlayer } from '../../host/data/poker-store.service';
import { PokerStoreService } from '../../host/data/poker-store.service';
import { PlayerSessionDetailPage } from './player-session-detail.page';

describe('PlayerSessionDetailPage', () => {
  let fixture: ComponentFixture<PlayerSessionDetailPage>;
  let session: ReturnType<typeof makeSession>;
  let sessionState: ReturnType<typeof signal<ReturnType<typeof makeSession>>>;

  beforeEach(async () => {
    const currentPlayer = makePlayer();
    session = makeSession({
      players: [currentPlayer, makePlayer({ id: 'leader', userId: null, name: 'Leader', net: 200 })]
    });
    sessionState = signal(session);

    await TestBed.configureTestingModule({
      imports: [PlayerSessionDetailPage, RouterTestingModule],
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            profile: signal({ displayName: 'Player' }),
            user: signal({ id: 'player-1' })
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ sessionId: session.id })
            }
          }
        },
        {
          provide: PokerStoreService,
          useValue: {
            error: signal<string | null>(null),
            loading: signal(false),
            getSession: () => sessionState(),
            playerPublicTableRoster: signal([]),
            refreshSessions: jasmine.createSpy('refreshSessions').and.resolveTo()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerSessionDetailPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('renders the approved stat order and neon active-status treatment', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(
      compiled.querySelectorAll<HTMLElement>('.player-session-stat-label')
    ).map((label) => label.textContent?.trim());

    expect(labels).toEqual(['My total buy in', 'Rebuys', 'Cashed out', 'Net']);
    expect(compiled.querySelector('.player-status-neon')).not.toBeNull();
  });

  it('toggles the table-player panel with accessible expanded state', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>(
      'button[aria-controls="player-table-roster-panel"]'
    );

    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('#player-table-roster-panel')?.classList).toContain('is-open');
  });

  it('does not render a crown while the session is active', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[aria-label="Highest net"]')).toBeNull();
  });

  it('places the compact active sign at the far right of the detail heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('.player-session-heading');
    const activeSign = compiled.querySelector('.player-status-neon');

    expect(heading).not.toBeNull();
    expect(heading?.lastElementChild).toBe(activeSign);
    expect(activeSign?.classList).toContain('player-status-sign--detail');
  });

  it('leaves persistent bottom navigation to the player shell', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const navigation = compiled.querySelector<HTMLElement>(
      'nav[aria-label="Player dashboard"]'
    );

    expect(navigation).toBeNull();
    expect(compiled.textContent).not.toContain('Back to history');
  });

  it('shows assigned manager tips when the manager also played in the session', () => {
    sessionState.set({
      ...session,
      financialEntries: [makeFinancialEntry({ amount: 275 })]
    });
    fixture.detectChanges();

    const tipsStat = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.player-session-stat--tips'
    );

    expect(tipsStat?.textContent).toContain('My tips');
    expect(tipsStat?.textContent).toContain('$275');
  });
});

function makeSession(overrides: Partial<PokerSession> = {}): PokerSession {
  return {
    id: 'session-a',
    name: 'July Game',
    sessionDate: '2026-07-17',
    status: 'ACTIVE',
    createdAt: '2026-07-17T01:00:00.000Z',
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
    id: 'player-a',
    tableId: 'table-a',
    userId: 'player-1',
    name: 'Player',
    status: 'ACTIVE',
    totalBuyIn: 500,
    cashOut: 0,
    net: -500,
    joinedAt: '2026-07-17T01:00:00.000Z',
    completedAt: null,
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
    createdAt: '2026-07-17T01:00:00.000Z',
    createdBy: 'host-a',
    createdByName: 'Admin',
    updatedAt: '2026-07-17T01:00:00.000Z',
    updatedBy: 'host-a',
    updatedByName: 'Admin',
    revisions: [],
    ...overrides
  };
}
