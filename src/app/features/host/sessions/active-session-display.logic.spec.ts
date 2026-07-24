import {
  allPlayersCashedOut,
  canModifyActiveSessionRecords,
  initialExpandedTableIds
} from './active-session-display.logic';
import { ActiveSessionPage } from './active-session.page';

describe('active session table expansion', () => {
  it('opens only the first table by default', () => {
    expect(initialExpandedTableIds([{ id: 'first' }, { id: 'second' }])).toEqual(['first']);
  });

  it('only allows closing after every player has cashed out', () => {
    expect(allPlayersCashedOut([{ status: 'COMPLETED' }, { status: 'COMPLETED' }])).toBeTrue();
    expect(allPlayersCashedOut([{ status: 'COMPLETED' }, { status: 'ACTIVE' }])).toBeFalse();
    expect(
      allPlayersCashedOut([
        { status: 'COMPLETED' },
        { status: 'ACTIVE', removedAt: '2026-07-23T12:00:00Z' },
      ]),
    ).toBeTrue();
  });

  it('allows table operators to modify records only for active sessions', () => {
    expect(canModifyActiveSessionRecords('ACTIVE', true)).toBeTrue();
    expect(canModifyActiveSessionRecords('COMPLETED', true)).toBeFalse();
    expect(canModifyActiveSessionRecords('ACTIVE', false)).toBeFalse();
  });
});

describe('active session rebuy count', () => {
  it('counts only active rebuys for the selected player', () => {
    const page = {
      session: () => ({
        transactions: [
          { playerId: 'player-1', type: 'BUYIN' },
          { playerId: 'player-1', type: 'REBUY' },
          { playerId: 'player-1', type: 'REBUY', deletedAt: '2026-07-23T12:00:00Z' },
          { playerId: 'player-2', type: 'REBUY' },
        ],
      }),
    };
    const rebuyCount = (
      ActiveSessionPage.prototype as unknown as {
        rebuyCount(this: typeof page, playerId: string): number;
      }
    ).rebuyCount;

    expect(rebuyCount.call(page, 'player-1')).toBe(1);
  });
});
