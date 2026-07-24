import type { SessionFinancialEntry } from './poker-store.service';

export interface SessionAccountingTotals {
  tipTotal: number;
  rakeTotal: number;
}

export interface ManagerTipTotal {
  managerUserId: string;
  managerName: string;
  amount: number;
}

export function sessionAccountingTotals(
  entries: SessionFinancialEntry[]
): SessionAccountingTotals {
  return entries.reduce<SessionAccountingTotals>(
    (totals, entry) => {
      if (entry.deletedAt) {
        return totals;
      }

      if (entry.entryType === 'TIP') {
        totals.tipTotal += entry.amount;
      } else {
        totals.rakeTotal += entry.amount;
      }

      return totals;
    },
    { tipTotal: 0, rakeTotal: 0 }
  );
}

export function managerTipTotals(entries: SessionFinancialEntry[]): ManagerTipTotal[] {
  const totalsByManager = new Map<string, ManagerTipTotal>();

  for (const entry of entries) {
    if (entry.entryType !== 'TIP' || entry.deletedAt || !entry.managerUserId) {
      continue;
    }

    const existing = totalsByManager.get(entry.managerUserId);

    totalsByManager.set(entry.managerUserId, {
      managerUserId: entry.managerUserId,
      managerName: entry.managerName ?? existing?.managerName ?? 'Unknown manager',
      amount: (existing?.amount ?? 0) + entry.amount
    });
  }

  return [...totalsByManager.values()].sort((a, b) =>
    a.managerName.localeCompare(b.managerName)
  );
}

export function visibleSessionFinancialEntries(
  entries: SessionFinancialEntry[],
  role: 'HOST' | 'MANAGER' | 'PLAYER' | null,
  userId: string | null
): SessionFinancialEntry[] {
  const visibleEntries =
    role === 'HOST'
      ? entries
      : role === 'MANAGER' && userId
        ? entries.filter(
            (entry) =>
              (entry.entryType === 'TIP' && entry.managerUserId === userId) ||
              (entry.entryType === 'RAKE' && entry.createdBy === userId)
          )
        : [];

  return [...visibleEntries].sort((a, b) => {
    if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
      return a.deletedAt ? 1 : -1;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
}
