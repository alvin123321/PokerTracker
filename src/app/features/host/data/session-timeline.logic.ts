import type {
  PokerTransaction,
  PokerTransactionType
} from './poker-store.service';

export type GameTimelineEntryState = 'ACTIVE' | 'EDITED' | 'DELETED';

export interface GameTimelineEntry {
  id: string;
  transactionId: string;
  type: PokerTransactionType;
  amount: number;
  comment?: string;
  createdAt: string;
  state: GameTimelineEntryState;
  actionAt?: string;
  actionByName?: string;
}

export function gameTimelineTransactions(transactions: PokerTransaction[]): PokerTransaction[] {
  return transactions
    .filter((transaction) => !transaction.deletedAt)
    .filter((transaction) =>
      transaction.type === 'BUYIN' ||
      transaction.type === 'REBUY' ||
      transaction.type === 'CASHOUT'
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export function gameTimelineEntries(transactions: PokerTransaction[]): GameTimelineEntry[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.type === 'BUYIN' ||
        transaction.type === 'REBUY' ||
        transaction.type === 'CASHOUT'
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .flatMap((transaction) => [
      {
        id: transaction.id,
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        ...(transaction.comment ? { comment: transaction.comment } : {}),
        createdAt: transaction.createdAt,
        state: transaction.deletedAt ? 'DELETED' as const : 'ACTIVE' as const,
        ...(transaction.deletedAt ? { actionAt: transaction.deletedAt } : {}),
        ...(transaction.deletedByName ? { actionByName: transaction.deletedByName } : {})
      },
      ...(transaction.revisions ?? [])
        .slice()
        .sort((first, second) => second.actionAt.localeCompare(first.actionAt))
        .map((revision) => ({
          id: revision.id,
          transactionId: transaction.id,
          type: transaction.type,
          amount: revision.amount,
          ...(revision.comment ? { comment: revision.comment } : {}),
          createdAt: revision.originalCreatedAt,
          state: 'EDITED' as const,
          actionAt: revision.actionAt,
          actionByName: revision.actionByName
        }))
    ]);
}
