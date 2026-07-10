import type { PokerTransaction } from './poker-store.service';

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
