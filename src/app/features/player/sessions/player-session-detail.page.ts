import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerStoreService,
  PokerTransaction,
  RecordedHand,
  RecordedHandActionType,
  RecordedHandBoardCard,
  RecordedHandStreet,
  SaveRecordedHandInput
} from '../../host/data/poker-store.service';
import {
  RecordHandDialogComponent,
  RecordHandDialogData
} from '../../recorded-hands/record-hand-dialog.component';

interface PlayerLedgerRow {
  transaction: PokerTransaction;
  runningBuyIn: number;
}

@Component({
  selector: 'app-player-session-detail-page',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, RouterLink],
  template: `
    @if (player(); as currentPlayer) {
      @if (session(); as currentSession) {
        <section class="space-y-5 sm:space-y-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <a routerLink="/player/dashboard" class="text-sm font-semibold text-sky-300">My Sessions</a>
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <h1 class="text-2xl font-semibold text-white sm:text-3xl">{{ currentSession.name }}</h1>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  [class.bg-sky-300]="currentPlayer.status === 'ACTIVE'"
                  [class.text-neutral-950]="currentPlayer.status === 'ACTIVE'"
                  [class.bg-white]="currentPlayer.status === 'COMPLETED'"
                  [class.text-neutral-950]="currentPlayer.status === 'COMPLETED'"
                >
                  {{ currentPlayer.status }}
                </span>
              </div>
              <p class="mt-2 text-sm text-neutral-400">
                {{ currentSession.sessionDate | date: 'mediumDate' }} · Player {{ playerName() }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                [disabled]="isSavingHand() || currentSession.players.length === 0"
                class="rounded-lg border border-sky-300/30 bg-sky-300/10 px-5 py-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-800 disabled:text-neutral-500"
                (click)="openRecordHandDialog()"
              >
                {{ isSavingHand() ? 'Saving hand...' : 'Record Hand' }}
              </button>
              <div class="rounded-lg border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100">
                Your private session detail
              </div>
            </div>
          </div>

          @if (actionError() || store.error()) {
            <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {{ actionError() ?? store.error() }}
            </div>
          }

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">My buy-ins</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
                {{ currentPlayer.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">Rebuys</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ rebuyCount() }}</p>
            </div>
            <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:block sm:p-5">
              <p class="text-sm text-neutral-400">My cash out</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
                @if (currentPlayer.status === 'COMPLETED') {
                  {{ currentPlayer.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                } @else {
                  Pending
                }
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">My net</p>
              <p
                class="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl"
                [class.text-emerald-300]="currentPlayer.net >= 0"
                [class.text-red-300]="currentPlayer.net < 0"
                [class.text-neutral-400]="currentPlayer.status !== 'COMPLETED'"
              >
                @if (currentPlayer.status === 'COMPLETED') {
                  {{ currentPlayer.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                } @else {
                  Pending
                }
              </p>
            </div>
          </div>

          @if (currentPlayer.status === 'ACTIVE') {
            <div class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
              Cash out has not been recorded yet, so net result remains pending.
            </div>
          }

          @if (recordedHands().length > 0) {
            <section class="rounded-lg border border-white/10 bg-white/[0.04]">
              <div class="flex flex-col gap-1 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 class="text-lg font-semibold text-white">Table hands</h2>
                <p class="text-sm text-neutral-500">{{ recordedHands().length }} hand(s)</p>
              </div>
              <div class="grid gap-3 p-3 lg:grid-cols-2">
                @for (hand of recordedHands(); track hand.id) {
                  <article class="rounded-lg border border-white/10 bg-neutral-950 p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="flex flex-wrap gap-2">
                        @for (tag of hand.tags; track tag) {
                          <span class="rounded-full bg-sky-300 px-2.5 py-1 text-xs font-bold text-neutral-950">
                            {{ tag }}
                          </span>
                        } @empty {
                          <span class="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-neutral-400">
                            Recorded hand
                          </span>
                        }
                      </div>
                      <span class="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-neutral-300">
                        {{ hand.createdAt | date: 'shortTime' }}
                      </span>
                    </div>
                    <p class="mt-3 text-sm text-neutral-300">
                      <span class="text-neutral-500">Players:</span> {{ handPlayerNames(hand) }}
                    </p>
                    <p class="mt-1 text-sm text-neutral-300">
                      <span class="text-neutral-500">Board:</span> {{ handBoardLabel(hand.board) }}
                    </p>
                    @if (hand.comment) {
                      <p class="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-neutral-300">
                        {{ hand.comment }}
                      </p>
                    }
                    @if (hand.actions.length > 0) {
                      <p class="mt-3 text-xs font-semibold uppercase text-neutral-500">
                        {{ handActionsPreview(hand) }}
                      </p>
                    }
                  </article>
                }
              </div>
            </section>
          }

          <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="flex flex-col gap-1 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-lg font-semibold text-white">My transaction ledger</h2>
              <p class="text-sm text-neutral-500">{{ ledgerRows().length }} transaction(s)</p>
            </div>

            <div class="hidden grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr_1.2fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 md:grid">
              <span>Type</span>
              <span>Time</span>
              <span>Amount</span>
              <span>Running buy-in</span>
              <span>Comment</span>
            </div>

            @for (row of ledgerRows(); track row.transaction.id) {
              <div
                class="grid gap-3 border-b border-white/5 px-3 py-4 text-sm last:border-b-0 sm:px-4 md:grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr_1.2fr] md:items-center"
                [class.opacity-60]="row.transaction.deletedAt"
              >
                <span
                  class="text-xs font-semibold uppercase"
                  [class.text-sky-300]="row.transaction.type !== 'CASHOUT'"
                  [class.text-emerald-300]="row.transaction.type === 'CASHOUT'"
                  [class.text-neutral-500]="row.transaction.deletedAt"
                  [class.line-through]="row.transaction.deletedAt"
                >
                  {{ row.transaction.type }}
                  @if (row.transaction.deletedAt) {
                    <span class="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-neutral-500">
                      Deleted
                    </span>
                  }
                </span>
                <div class="grid grid-cols-2 gap-3 md:block">
                  <span class="text-neutral-500 md:hidden">Time</span>
                  <span
                    class="text-neutral-300"
                    [class.text-neutral-500]="row.transaction.deletedAt"
                    [class.line-through]="row.transaction.deletedAt"
                  >
                    {{ row.transaction.createdAt | date: 'shortTime' }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-3 md:block">
                  <span class="text-neutral-500 md:hidden">Amount</span>
                  <span
                    class="font-semibold text-white"
                    [class.text-neutral-500]="row.transaction.deletedAt"
                    [class.line-through]="row.transaction.deletedAt"
                  >
                    {{ row.transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </span>
                </div>
                <div class="hidden grid-cols-2 gap-3 sm:grid md:block">
                  <span class="text-neutral-500 md:hidden">Running</span>
                  <span
                    class="text-neutral-300"
                    [class.text-neutral-500]="row.transaction.deletedAt"
                    [class.line-through]="row.transaction.deletedAt"
                  >
                    {{ row.runningBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-3 md:block">
                  <span class="text-neutral-500 md:hidden">Comment</span>
                  <span
                    class="text-neutral-400"
                    [class.text-neutral-500]="row.transaction.deletedAt"
                    [class.line-through]="row.transaction.deletedAt"
                  >
                    @if (row.transaction.comment) {
                      {{ row.transaction.comment }}
                    } @else {
                      <span class="text-neutral-600">No comment</span>
                    }
                  </span>
                </div>
              </div>
            } @empty {
              <div class="px-4 py-8 text-center text-sm text-neutral-500">
                No transactions have been recorded for you in this session.
              </div>
            }
          </div>
        </section>
      }
    } @else if (store.loading()) {
      <section class="rounded-lg border border-sky-300/20 bg-sky-300/10 p-8 text-center">
        <h1 class="text-2xl font-semibold text-white">Loading session</h1>
        <p class="mt-2 text-sky-100">Checking your private player records...</p>
      </section>
    } @else {
      <section class="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 class="text-2xl font-semibold text-white">Session not found</h1>
        <p class="mt-2 text-neutral-400">This player account does not have access to that session.</p>
        <a
          routerLink="/player/dashboard"
          class="mt-5 inline-flex rounded-lg bg-sky-300 px-5 py-3 text-sm font-semibold text-neutral-950"
        >
          Back to my sessions
        </a>
      </section>
    }
  `
})
export class PlayerSessionDetailPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(PokerStoreService);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId');
  protected readonly actionError = signal<string | null>(null);
  protected readonly isSavingHand = signal(false);

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly recordedHands = computed(() => this.store.recordedHandsForSession(this.session()));
  protected readonly player = computed(() => {
    const userId = this.authState.user()?.id ?? null;
    const targetName = this.playerName().trim().toLowerCase();

    return this.session()?.players.find(
      (player) =>
        userId ? player.userId === userId : player.name.trim().toLowerCase() === targetName
    );
  });
  protected readonly transactions = computed(() => {
    const player = this.player();

    if (!player) {
      return [];
    }

    return [...(this.session()?.transactions ?? [])]
      .filter((transaction) => transaction.playerId === player.id)
      .sort((a, b) => {
        if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
          return a.deletedAt ? 1 : -1;
        }

        return a.createdAt.localeCompare(b.createdAt);
      });
  });
  protected readonly rebuyCount = computed(
    () =>
      this.transactions().filter(
        (transaction) => transaction.type === 'REBUY' && !transaction.deletedAt
      ).length
  );
  protected readonly ledgerRows = computed<PlayerLedgerRow[]>(() => {
    let runningBuyIn = 0;

    return this.transactions().map((transaction) => {
      if (
        !transaction.deletedAt &&
        (transaction.type === 'BUYIN' || transaction.type === 'REBUY')
      ) {
        runningBuyIn += transaction.amount;
      }

      return {
        transaction,
        runningBuyIn
      };
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store exposes the error state; keep the page render path simple.
    }
  }

  protected openRecordHandDialog(): void {
    if (this.isSavingHand()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession || !this.player()) {
      return;
    }

    const dialogRef = this.dialog.open<
      RecordHandDialogComponent,
      RecordHandDialogData,
      SaveRecordedHandInput
    >(RecordHandDialogComponent, {
      autoFocus: false,
      data: { session: currentSession, accent: 'sky' },
      width: '96vw',
      maxWidth: '98vw',
      maxHeight: '96vh',
      panelClass: 'pokertrack-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(async (result?: SaveRecordedHandInput) => {
      if (!result) {
        return;
      }

      this.isSavingHand.set(true);
      this.actionError.set(null);

      try {
        await this.store.saveRecordedHand(result);
      } catch (error) {
        this.actionError.set(error instanceof Error ? error.message : 'Unable to save hand.');
      } finally {
        this.isSavingHand.set(false);
      }
    });
  }

  protected handPlayerNames(hand: RecordedHand): string {
    return (
      hand.playerIds
        .map(
          (playerId) =>
            this.session()?.players.find((player) => player.id === playerId)?.name ?? 'Unknown'
        )
        .join(', ') || 'No players selected'
    );
  }

  protected handBoardLabel(board: RecordedHandBoardCard[]): string {
    return board.map((card) => `${card.rank}${this.suitSymbol(card.suit)}`).join(' ') || 'No board';
  }

  protected handActionsPreview(hand: RecordedHand): string {
    return hand.actions
      .slice(0, 4)
      .map(
        (action) =>
          `${this.streetLabel(action.street)}: ${action.playerName} ${this.actionLabel(
            action.actionType
          )}${action.amount === null ? '' : ` $${action.amount}`}`
      )
      .join(' · ');
  }

  protected streetLabel(street: RecordedHandStreet): string {
    return street.charAt(0) + street.slice(1).toLowerCase();
  }

  protected actionLabel(action: RecordedHandActionType): string {
    return action === 'ALL_IN' ? 'All In' : action.charAt(0) + action.slice(1).toLowerCase();
  }

  protected suitSymbol(suit: RecordedHandBoardCard['suit']): string {
    return {
      HEART: '♥',
      DIAMOND: '♦',
      CLUB: '♣',
      SPADE: '♠'
    }[suit];
  }
}
