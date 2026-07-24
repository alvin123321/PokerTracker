import { gameTimelineEntries } from './session-timeline.logic';

import type { PokerTransaction } from './poker-store.service';

describe('session timeline logic', () => {
  it('places edited revisions directly below the active transaction', () => {
    const transaction = makeTransaction({
      revisions: [
        {
          id: 'revision-1',
          transactionId: 'transaction-1',
          amount: 100,
          comment: 'Original',
          originalCreatedAt: '2026-07-23T01:00:00.000Z',
          actionAt: '2026-07-23T01:05:00.000Z',
          actionBy: 'manager-1',
          actionByName: 'Manager One'
        }
      ]
    });

    const entries = gameTimelineEntries([transaction]);

    expect(entries.map((entry) => [entry.state, entry.amount])).toEqual([
      ['ACTIVE', 150],
      ['EDITED', 100]
    ]);
    expect(entries[1].actionByName).toBe('Manager One');
  });

  it('keeps deleted transactions as crossed audit entries', () => {
    const entries = gameTimelineEntries([
      makeTransaction({
        deletedAt: '2026-07-23T01:10:00.000Z',
        deletedByName: 'Manager One'
      })
    ]);

    expect(entries).toHaveSize(1);
    expect(entries[0].state).toBe('DELETED');
    expect(entries[0].actionByName).toBe('Manager One');
  });
});

function makeTransaction(overrides: Partial<PokerTransaction> = {}): PokerTransaction {
  return {
    id: 'transaction-1',
    sessionId: 'session-1',
    tableId: 'table-1',
    playerId: 'seat-1',
    type: 'BUYIN',
    amount: 150,
    createdAt: '2026-07-23T01:00:00.000Z',
    revisions: [],
    ...overrides
  };
}
