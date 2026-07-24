import {
  managerTipTotals,
  sessionAccountingTotals,
  visibleSessionFinancialEntries
} from './session-accounting.logic';

import type { SessionFinancialEntry } from './poker-store.service';

describe('session accounting logic', () => {
  const entries: SessionFinancialEntry[] = [
    makeEntry({
      id: 'tip-manager-one',
      entryType: 'TIP',
      amount: 40,
      managerUserId: 'manager-one',
      managerName: 'Manager One',
      createdBy: 'host'
    }),
    makeEntry({
      id: 'tip-manager-two',
      entryType: 'TIP',
      amount: 60,
      managerUserId: 'manager-two',
      managerName: 'Manager Two',
      createdBy: 'manager-two'
    }),
    makeEntry({
      id: 'rake-manager-one',
      entryType: 'RAKE',
      amount: 100,
      createdBy: 'manager-one'
    }),
    makeEntry({
      id: 'deleted-rake',
      entryType: 'RAKE',
      amount: 50,
      createdBy: 'manager-one',
      deletedAt: '2026-07-23T02:00:00.000Z'
    })
  ];

  it('excludes deleted entries from session totals', () => {
    expect(sessionAccountingTotals(entries)).toEqual({
      tipTotal: 100,
      rakeTotal: 100
    });
  });

  it('groups active tips by manager and excludes deleted tips', () => {
    expect(
      managerTipTotals([
        ...entries,
        makeEntry({
          id: 'second-tip-manager-one',
          entryType: 'TIP',
          amount: 160,
          managerUserId: 'manager-one',
          managerName: 'Manager One'
        }),
        makeEntry({
          id: 'deleted-tip-manager-one',
          entryType: 'TIP',
          amount: 500,
          managerUserId: 'manager-one',
          managerName: 'Manager One',
          deletedAt: '2026-07-23T03:00:00.000Z'
        })
      ])
    ).toEqual([
      {
        managerUserId: 'manager-one',
        managerName: 'Manager One',
        amount: 200
      },
      {
        managerUserId: 'manager-two',
        managerName: 'Manager Two',
        amount: 60
      }
    ]);
  });

  it('shows managers only their tips and rake entries they recorded', () => {
    expect(
      visibleSessionFinancialEntries(entries, 'MANAGER', 'manager-one').map((entry) => entry.id)
    ).toEqual(['tip-manager-one', 'rake-manager-one', 'deleted-rake']);
  });

  it('shows hosts the complete accounting log', () => {
    expect(visibleSessionFinancialEntries(entries, 'HOST', 'host')).toEqual(entries);
  });

  it('sorts active entries newest first and keeps deleted entries at the bottom', () => {
    const orderedEntries = visibleSessionFinancialEntries(
      [
        makeEntry({
          id: 'deleted-older',
          createdAt: '2026-07-23T02:00:00.000Z',
          deletedAt: '2026-07-23T06:00:00.000Z'
        }),
        makeEntry({
          id: 'active-older',
          createdAt: '2026-07-23T03:00:00.000Z'
        }),
        makeEntry({
          id: 'deleted-newer',
          createdAt: '2026-07-23T05:00:00.000Z',
          deletedAt: '2026-07-23T07:00:00.000Z'
        }),
        makeEntry({
          id: 'active-newer',
          createdAt: '2026-07-23T04:00:00.000Z'
        })
      ],
      'HOST',
      'host'
    );

    expect(orderedEntries.map((entry) => entry.id)).toEqual([
      'active-newer',
      'active-older',
      'deleted-newer',
      'deleted-older'
    ]);
  });
});

function makeEntry(overrides: Partial<SessionFinancialEntry>): SessionFinancialEntry {
  return {
    id: 'entry',
    sessionId: 'session',
    entryType: 'TIP',
    amount: 20,
    managerUserId: 'manager-one',
    managerName: 'Manager One',
    createdAt: '2026-07-23T01:00:00.000Z',
    createdBy: 'manager-one',
    createdByName: 'Manager One',
    updatedAt: '2026-07-23T01:00:00.000Z',
    updatedBy: 'manager-one',
    updatedByName: 'Manager One',
    revisions: [],
    ...overrides
  };
}
