import { computed, Injectable, signal } from '@angular/core';

export type MockSessionStatus = 'ACTIVE' | 'COMPLETED';
export type MockPlayerStatus = 'ACTIVE' | 'COMPLETED';
export type MockTransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';

export interface MockTransaction {
  id: string;
  sessionId: string;
  playerId: string;
  type: MockTransactionType;
  amount: number;
  createdAt: string;
  comment?: string;
  deletedAt?: string;
}

export interface MockSessionPlayer {
  id: string;
  name: string;
  status: MockPlayerStatus;
  totalBuyIn: number;
  cashOut: number;
  net: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface MockPokerSession {
  id: string;
  name: string;
  sessionDate: string;
  status: MockSessionStatus;
  createdAt: string;
  closedAt: string | null;
  players: MockSessionPlayer[];
  transactions: MockTransaction[];
}

export interface SessionTotals {
  totalPlayers: number;
  activePlayers: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
}

const storageKey = 'pokertrack.mockPokerStore';

@Injectable({
  providedIn: 'root'
})
export class MockPokerStoreService {
  private readonly sessionsSignal = signal<MockPokerSession[]>(this.loadSessions());

  readonly sessions = this.sessionsSignal.asReadonly();
  readonly activeSessions = computed(() =>
    this.sessionsSignal().filter((session) => session.status === 'ACTIVE')
  );
  readonly completedSessions = computed(() =>
    this.sessionsSignal().filter((session) => session.status === 'COMPLETED')
  );

  createSession(name: string, sessionDate: string): MockPokerSession {
    const session: MockPokerSession = {
      id: this.createId('session'),
      name: name.trim(),
      sessionDate,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      closedAt: null,
      players: [],
      transactions: []
    };

    this.updateSessions((sessions) => [session, ...sessions]);

    return session;
  }

  getSession(sessionId: string | null): MockPokerSession | undefined {
    return this.sessionsSignal().find((session) => session.id === sessionId);
  }

  addPlayer(sessionId: string, name: string, buyIn: number, comment = ''): void {
    const joinedAt = new Date().toISOString();
    const playerId = this.createId('player');
    const cleanBuyIn = this.normalizeAmount(buyIn);
    const player: MockSessionPlayer = {
      id: playerId,
      name: name.trim(),
      status: 'ACTIVE',
      totalBuyIn: cleanBuyIn,
      cashOut: 0,
      net: 0 - cleanBuyIn,
      joinedAt,
      completedAt: null
    };

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: [...session.players, player],
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, playerId, 'BUYIN', cleanBuyIn, joinedAt, comment)
      ]
    }));
  }

  recordRebuy(sessionId: string, playerId: string, amount: number, comment = ''): void {
    const createdAt = new Date().toISOString();
    const rebuyAmount = this.normalizeAmount(amount);

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: session.players.map((player) => {
        if (player.id !== playerId || player.status === 'COMPLETED') {
          return player;
        }

        const totalBuyIn = player.totalBuyIn + rebuyAmount;

        return {
          ...player,
          totalBuyIn,
          net: player.cashOut - totalBuyIn
        };
      }),
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, playerId, 'REBUY', rebuyAmount, createdAt, comment)
      ]
    }));
  }

  recordCashOut(sessionId: string, playerId: string, amount: number): void {
    const completedAt = new Date().toISOString();
    const cashOut = this.normalizeAmount(amount);

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: session.players.map((player) => {
        if (player.id !== playerId) {
          return player;
        }

        return {
          ...player,
          status: 'COMPLETED',
          cashOut,
          net: cashOut - player.totalBuyIn,
          completedAt
        };
      }),
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, playerId, 'CASHOUT', cashOut, completedAt)
      ]
    }));
  }

  updateBuyInTransaction(
    sessionId: string,
    transactionId: string,
    amount: number,
    comment = ''
  ): void {
    const updatedAmount = this.normalizeAmount(amount);
    const cleanComment = comment.trim();

    this.updateSession(sessionId, (session) => {
      const transaction = session.transactions.find((item) => item.id === transactionId);

      if (!transaction || (transaction.type !== 'BUYIN' && transaction.type !== 'REBUY')) {
        return session;
      }

      const transactions = session.transactions.map((item) =>
        item.id === transactionId
          ? { ...item, amount: updatedAmount, comment: cleanComment || undefined }
          : item
      );

      return {
        ...session,
        players: this.recalculatePlayerBuyIn(session.players, transactions, transaction.playerId),
        transactions
      };
    });
  }

  deleteBuyInTransaction(sessionId: string, transactionId: string): void {
    const deletedAt = new Date().toISOString();

    this.updateSession(sessionId, (session) => {
      const transaction = session.transactions.find((item) => item.id === transactionId);

      if (!transaction || (transaction.type !== 'BUYIN' && transaction.type !== 'REBUY')) {
        return session;
      }

      const transactions = session.transactions.map((item) =>
        item.id === transactionId ? { ...item, deletedAt } : item
      );

      return {
        ...session,
        players: this.recalculatePlayerBuyIn(session.players, transactions, transaction.playerId),
        transactions
      };
    });
  }

  closeSession(sessionId: string): void {
    this.updateSession(sessionId, (session) => ({
      ...session,
      status: 'COMPLETED',
      closedAt: new Date().toISOString()
    }));
  }

  totalsFor(session: MockPokerSession | undefined): SessionTotals {
    const players = session?.players ?? [];

    return {
      totalPlayers: players.length,
      activePlayers: players.filter((player) => player.status === 'ACTIVE').length,
      totalBuyIn: players.reduce((sum, player) => sum + player.totalBuyIn, 0),
      totalCashOut: players.reduce((sum, player) => sum + player.cashOut, 0),
      totalNet: players.reduce((sum, player) => sum + player.net, 0)
    };
  }

  sortedPlayersByNet(session: MockPokerSession | undefined): MockSessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => b.net - a.net);
  }

  sortedPlayersForActiveSession(session: MockPokerSession | undefined): MockSessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ACTIVE' ? -1 : 1;
      }

      if (a.status === 'COMPLETED') {
        return b.cashOut - a.cashOut;
      }

      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }

  buyInTransactionsForPlayer(
    session: MockPokerSession | undefined,
    playerId: string
  ): MockTransaction[] {
    return [...(session?.transactions ?? [])]
      .filter(
        (transaction) =>
          transaction.playerId === playerId &&
          (transaction.type === 'BUYIN' || transaction.type === 'REBUY')
      )
      .sort((a, b) => {
        if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
          return a.deletedAt ? 1 : -1;
        }

        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  private updateSession(
    sessionId: string,
    updater: (session: MockPokerSession) => MockPokerSession
  ): void {
    this.updateSessions((sessions) =>
      sessions.map((session) => (session.id === sessionId ? updater(session) : session))
    );
  }

  private updateSessions(updater: (sessions: MockPokerSession[]) => MockPokerSession[]): void {
    const sessions = updater(this.sessionsSignal());
    this.sessionsSignal.set(sessions);
    this.saveSessions(sessions);
  }

  private createTransaction(
    sessionId: string,
    playerId: string,
    type: MockTransactionType,
    amount: number,
    createdAt: string,
    comment = ''
  ): MockTransaction {
    const cleanComment = comment.trim();

    return {
      id: this.createId('transaction'),
      sessionId,
      playerId,
      type,
      amount,
      createdAt,
      ...(cleanComment ? { comment: cleanComment } : {})
    };
  }

  private recalculatePlayerBuyIn(
    players: MockSessionPlayer[],
    transactions: MockTransaction[],
    playerId: string
  ): MockSessionPlayer[] {
    const totalBuyIn = transactions
      .filter(
        (item) =>
          item.playerId === playerId &&
          !item.deletedAt &&
          (item.type === 'BUYIN' || item.type === 'REBUY')
      )
      .reduce((sum, item) => sum + item.amount, 0);

    return players.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      return {
        ...player,
        totalBuyIn,
        net: player.cashOut - totalBuyIn
      };
    });
  }

  private normalizeAmount(amount: number): number {
    return Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private loadSessions(): MockPokerSession[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as MockPokerSession[];
    } catch {
      localStorage.removeItem(storageKey);
      return [];
    }
  }

  private saveSessions(sessions: MockPokerSession[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }
}
