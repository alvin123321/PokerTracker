import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { MiniGamePanelComponent } from './mini-game-panel.component';
import { MiniGameActionName, MiniGameSnapshot } from './mini-game.models';

describe('MiniGamePanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiniGamePanelComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it('uses one three-option overflow menu for creator controls', () => {
    const fixture = render(makeSnapshot(), true);
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector<HTMLButtonElement>('.mini-overflow-button');

    expect(trigger).not.toBeNull();
    trigger?.click();
    fixture.detectChanges();

    const menuLabels = Array.from(
      document.querySelectorAll<HTMLElement>('.mini-game-menu [mat-menu-item]'),
    ).map((item) => item.textContent?.trim().replace(/\s+/g, ' '));

    expect(menuLabels).toEqual(['Edit game', 'Reshuffle cards', 'Delete game']);
    expect(fixture.nativeElement.querySelector('.mini-tool-row')).toBeNull();

    const item = document.querySelector<HTMLElement>('.mini-game-menu .mat-mdc-menu-item');
    const content = item?.querySelector<HTMLElement>('.mat-mdc-menu-item-text');
    const contentStyles = getComputedStyle(content!);
    expect(contentStyles.fontFamily).toContain('Aptos');
    expect(contentStyles.fontSize).toBe('12px');
    expect(contentStyles.display).toBe('flex');
    expect(contentStyles.alignItems).toBe('center');
  });

  it('shows stored normalized equity instead of deriving a pure win rate', () => {
    const fixture = render(makeSnapshot());
    const compiled = fixture.nativeElement as HTMLElement;
    const winRate = compiled.querySelector<HTMLElement>('.participant-win-rate');

    expect(compiled.querySelector('.participant-position')).toBeNull();
    expect(compiled.textContent).not.toContain('Seat 1');
    expect(winRate?.textContent).not.toContain('Win');
    expect(winRate?.textContent).toContain('100.0%');
    expect(winRate?.getAttribute('aria-label')).toBe('Equity percentage 100.0%');
  });

  it('splits tied equity equally and keeps the displayed total at 100.0%', () => {
    const snapshot = makeSnapshot();
    const first = snapshot.participants[0];
    snapshot.participants = [
      {
        ...first,
        equity: { ...first.equity!, share: 2, percentage: 50, wins: 0, ties: 4 },
      },
      {
        ...first,
        id: 'participant-b',
        userId: 'user-b',
        displayName: 'Ben',
        joinPosition: 2,
        equity: { ...first.equity!, share: 2, percentage: 50, wins: 0, ties: 4 },
      },
    ];

    const fixture = render(snapshot);
    const displayed = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.participant-win-rate strong',
      ),
    ).map((element) => Number.parseFloat(element.textContent ?? ''));

    expect(displayed).toEqual([50, 50]);
    expect(displayed.reduce((total, percentage) => total + percentage, 0)).toBe(100);
  });

  it('sorts players from highest to lowest stored equity', () => {
    const snapshot = makeSnapshot();
    const first = snapshot.participants[0];
    snapshot.participants = [
      {
        ...first,
        displayName: 'Ada',
        equity: { ...first.equity!, percentage: 35, wins: 3, totalOutcomes: 4 },
      },
      {
        ...first,
        id: 'participant-b',
        userId: 'user-b',
        displayName: 'Ben',
        joinPosition: 2,
        equity: { ...first.equity!, percentage: 65, wins: 1, totalOutcomes: 4 },
      },
    ];

    const fixture = render(snapshot);
    const names = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.participant-name-line strong',
      ),
    ).map((element) => element.textContent?.trim());

    expect(names).toEqual(['Ben', 'Ada']);
  });

  it('does not show a percentage from a stale calculation', () => {
    const snapshot = makeSnapshot();
    snapshot.participants[0] = {
      ...snapshot.participants[0],
      equity: {
        ...snapshot.participants[0].equity!,
        stateVersion: snapshot.stateVersion - 1,
      },
    };
    const fixture = render(snapshot);
    const winRate = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.participant-win-rate',
    );

    expect(winRate?.textContent).toContain('--');
    expect(winRate?.textContent).not.toContain('100.0%');
  });

  it('does not show a percentage while the calculation is pending', () => {
    const fixture = render(makeSnapshot({ equityStatus: 'PENDING' }));
    const winRate = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.participant-win-rate',
    );

    expect(winRate?.textContent).toContain('--');
    expect(winRate?.textContent).not.toContain('100.0%');
  });

  for (const stage of [
    { status: 'OPEN', board: [] },
    { status: 'FLOP', board: ['As', 'Ks', 'Qs'] },
    { status: 'TURN', board: ['As', 'Ks', 'Qs', 'Js'] },
    { status: 'COMPLETE', board: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  ] as const) {
    it(`shows equity at the ${stage.status.toLowerCase()} stage`, () => {
      const snapshot = makeSnapshot({
        status: stage.status,
        board: stage.board.map((code, index) => ({ position: index + 1, code })),
      });
      const first = snapshot.participants[0];
      snapshot.participants = [
        {
          ...first,
          equity: {
            ...first.equity!,
            share: 1.5,
            percentage: 75,
            wins: 1,
            ties: 1,
            totalOutcomes: 2,
          },
        },
        {
          ...first,
          id: 'participant-b',
          userId: 'user-b',
          displayName: 'Ben',
          joinPosition: 2,
          equity: {
            ...first.equity!,
            share: 0.5,
            percentage: 25,
            wins: 0,
            ties: 1,
            totalOutcomes: 2,
          },
        },
      ];

      const fixture = render(snapshot);
      const displayed = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '.participant-win-rate strong',
        ),
      ).map((element) => Number.parseFloat(element.textContent ?? ''));

      expect(displayed).toEqual([75, 25]);
      expect(displayed.reduce((total, percentage) => total + percentage, 0)).toBe(100);
    });
  }

  it('marks the final winner and offers a complete mini-game action to the creator', () => {
    const fixture = render(
      makeSnapshot({
        status: 'COMPLETE',
        board: ['As', 'Ks', 'Qs', 'Js', 'Ts'].map((code, index) => ({
          position: index + 1,
          code,
        })),
        winnerParticipantIds: ['participant-a'],
      }),
      true,
    );
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.participant-row-winner')).not.toBeNull();
    expect(
      compiled.querySelector<HTMLButtonElement>('.mini-complete-action')?.textContent,
    ).toContain('Complete mini-game');
    expect(compiled.textContent).not.toContain('Delete result');
  });

  it('keeps the participant remove control in place while an action is loading', () => {
    const fixture = render(makeSnapshot(), true, 'start');
    const compiled = fixture.nativeElement as HTMLElement;
    const removeButton = compiled.querySelector<HTMLButtonElement>(
      '.participant-remove',
    );

    expect(removeButton).not.toBeNull();
    expect(removeButton?.disabled).toBeTrue();
  });

  for (const state of [
    { status: 'OPEN', action: 'join', label: 'Dealing cards...' },
    { status: 'OPEN', action: 'start', label: 'Dealing flop...' },
    { status: 'FLOP', action: 'reveal-turn', label: 'Dealing turn...' },
    { status: 'TURN', action: 'reveal-river', label: 'Dealing river...' },
    { status: 'COMPLETE', action: 'archive', label: 'Completing...' },
  ] as const) {
    it(`shows stable ${state.action} progress copy`, () => {
      const boardByStatus = {
        OPEN: [],
        FLOP: ['As', 'Ks', 'Qs'],
        TURN: ['As', 'Ks', 'Qs', 'Js'],
        COMPLETE: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
      } as const;
      const fixture = render(
        makeSnapshot({
          status: state.status,
          board: boardByStatus[state.status].map((code, index) => ({
            position: index + 1,
            code,
          })),
          viewerParticipantId: state.action === 'join' ? null : 'participant-a',
          winnerParticipantIds: state.status === 'COMPLETE' ? ['participant-a'] : [],
        }),
        true,
        state.action,
      );

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(state.label);
      expect(fixture.nativeElement.querySelector('.mini-action-spinner')).not.toBeNull();
    });
  }

  function render(
    snapshot: MiniGameSnapshot,
    canManage = false,
    activeAction: MiniGameActionName | null = null,
  ) {
    const fixture = TestBed.createComponent(MiniGamePanelComponent);
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.componentRef.setInput('activeAction', activeAction);
    fixture.detectChanges();
    return fixture;
  }
});

function makeSnapshot(overrides: Partial<MiniGameSnapshot> = {}): MiniGameSnapshot {
  return {
    id: 'game-a',
    creatorHostId: 'host-a',
    name: 'Friday Draw',
    minPlayers: 2,
    maxPlayers: 10,
    status: 'OPEN',
    isCurrent: true,
    stateVersion: 4,
    equityVersion: 4,
    equityStatus: 'READY',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:05:00.000Z',
    completedAt: null,
    archivedAt: null,
    activePlayerCount: 2,
    viewerParticipantId: 'participant-a',
    viewerCelebrationSeen: false,
    board: [],
    participants: [
      {
        id: 'participant-a',
        userId: 'user-a',
        displayName: 'Ada',
        joinPosition: 1,
        joinedAt: '2026-07-14T12:01:00.000Z',
        cards: [
          { position: 1, code: '2c' },
          { position: 2, code: '3d' },
        ],
        equity: {
          stateVersion: 4,
          share: 1,
          percentage: 100,
          wins: 3,
          ties: 1,
          totalOutcomes: 4,
          finalHandLabel: 'Straight Flush',
          calculatedAt: '2026-07-14T12:05:00.000Z',
        },
      },
    ],
    winnerParticipantIds: [],
    ...overrides,
  };
}
