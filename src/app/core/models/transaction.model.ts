export type TransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';

export interface Transaction {
  id: string;
  sessionId: string;
  playerId: string;
  sessionPlayerId: string;
  type: TransactionType;
  amount: number;
  createdAt: string;
  createdBy: string;
}
