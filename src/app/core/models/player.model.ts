export type SessionPlayerStatus = 'ACTIVE' | 'COMPLETED';

export interface Player {
  id: string;
  userId: string | null;
  hostId: string;
  name: string;
  createdAt: string;
}

export interface SessionPlayer {
  id: string;
  sessionId: string;
  playerId: string;
  status: SessionPlayerStatus;
  totalBuyIn: number;
  cashOut: number;
  net: number;
  joinedAt: string;
  completedAt: string | null;
}
