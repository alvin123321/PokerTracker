export type SessionStatus = 'ACTIVE' | 'COMPLETED';

export interface PokerSession {
  id: string;
  hostId: string;
  name: string;
  sessionDate: string;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
}
