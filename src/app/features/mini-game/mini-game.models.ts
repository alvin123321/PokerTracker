export type MiniGameStatus = 'OPEN' | 'FLOP' | 'TURN' | 'COMPLETE';
export type MiniGameEquityStatus = 'PENDING' | 'READY' | 'ERROR';
export type MiniGameViewerRole = 'HOST' | 'MANAGER' | 'PLAYER';
export type MiniGameHistoryView = 'tables' | 'mini-games';

export interface MiniGameCard {
  position: number;
  code: string;
}

export interface MiniGameEquity {
  stateVersion: number;
  share: number;
  percentage: number;
  wins: number;
  ties: number;
  totalOutcomes: number;
  finalHandLabel: string | null;
  calculatedAt: string;
}

export interface MiniGameParticipant {
  id: string;
  userId: string;
  displayName: string;
  joinPosition: number;
  joinedAt: string;
  cards: MiniGameCard[];
  equity: MiniGameEquity | null;
}

export interface MiniGameSnapshot {
  id: string;
  creatorHostId: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  status: MiniGameStatus;
  isCurrent: boolean;
  stateVersion: number;
  equityVersion: number;
  equityStatus: MiniGameEquityStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  activePlayerCount: number;
  viewerParticipantId: string | null;
  viewerCelebrationSeen: boolean;
  board: MiniGameCard[];
  participants: MiniGameParticipant[];
  winnerParticipantIds: string[];
}

export interface MiniGameBoardSlot {
  position: number;
  card: MiniGameCard | null;
}

export type MiniGameActionRequest =
  | { action: 'create'; name: string; minPlayers: number; maxPlayers: number }
  | {
      action: 'update';
      gameId: string;
      name: string;
      minPlayers: number;
      maxPlayers: number;
    }
  | { action: 'join'; gameId: string }
  | { action: 'remove'; gameId: string; participantId: string }
  | { action: 'reshuffle'; gameId: string }
  | { action: 'start'; gameId: string }
  | { action: 'reveal-turn'; gameId: string }
  | { action: 'reveal-river'; gameId: string }
  | { action: 'archive'; gameId: string }
  | { action: 'delete'; gameId: string }
  | { action: 'recalculate'; gameId: string };

export interface MiniGameActionSuccess {
  ok: true;
  gameId: string;
  stateVersion: number;
  equityStatus: MiniGameEquityStatus;
  snapshot?: MiniGameSnapshot | null;
  warning?: string;
}

export interface MiniGameActionFailure {
  ok: false;
  error: string;
}

export type MiniGameActionResponse = MiniGameActionSuccess | MiniGameActionFailure;

export type MiniGameActionName = MiniGameActionRequest['action'];
