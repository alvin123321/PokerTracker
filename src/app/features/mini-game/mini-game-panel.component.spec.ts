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

  it('uses one four-option overflow menu for creator controls', () => {
    const fixture = render(makeSnapshot(), true);
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector<HTMLButtonElement>('.mini-overflow-button');

    expect(trigger).not.toBeNull();
    trigger?.click();
    fixture.detectChanges();

    const menuLabels = Array.from(
      document.querySelectorAll<HTMLElement>('.mini-game-menu [mat-menu-item]'),
    ).map((item) => item.textContent?.trim().replace(/\s+/g, ' '));

    expect(menuLabels).toEqual(['Open game', 'Edit game', 'Reshuffle cards', 'Delete game']);
    expect(fixture.nativeElement.querySelector('.mini-tool-row')).toBeNull();

    const item = document.querySelector<HTMLElement>('.mini-game-menu .mat-mdc-menu-item');
    const content = item?.querySelector<HTMLElement>('.mat-mdc-menu-item-text');
    const contentStyles = getComputedStyle(content!);
    expect(contentStyles.fontFamily).toContain('Aptos');
    expect(contentStyles.fontSize).toBe('12px');
    expect(contentStyles.display).toBe('flex');
    expect(contentStyles.alignItems).toBe('center');
  });

  it('removes join positions, seat copy, and displayed equity from participant rows', () => {
    const fixture = render(makeSnapshot());
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.participant-position')).toBeNull();
    expect(compiled.querySelector('.participant-equity')).toBeNull();
    expect(compiled.textContent).not.toContain('Seat 1');
    expect(compiled.textContent).not.toContain('Equity');
    expect(compiled.textContent).not.toContain('100.0%');
  });

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
          wins: 1,
          ties: 0,
          totalOutcomes: 1,
          finalHandLabel: 'Straight Flush',
          calculatedAt: '2026-07-14T12:05:00.000Z',
        },
      },
    ],
    winnerParticipantIds: [],
    ...overrides,
  };
}
