import { CurrencyPipe, DOCUMENT, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PokerStoreService, PokerTransaction, SessionPlayer } from '../../host/data/poker-store.service';

interface PlayerLedgerRow {
  transaction: PokerTransaction;
  runningBuyIn: number;
}

@Component({
  selector: 'app-player-session-detail-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    @if (player(); as currentPlayer) {
      @if (session(); as currentSession) {
        <section class="space-y-5 pb-24 sm:space-y-6 sm:pb-0">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3">
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
          </div>

          @if (store.error()) {
            <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {{ store.error() }}
            </div>
          }

          <div class="grid grid-cols-2 gap-3 md:max-w-3xl md:gap-4">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">My total buy in</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
                {{ currentPlayer.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">Cashed out</p>
              <p
                class="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl"
                [class.text-emerald-300]="currentPlayer.status === 'COMPLETED'"
                [class.text-neutral-400]="currentPlayer.status !== 'COMPLETED'"
              >
                @if (currentPlayer.status === 'COMPLETED') {
                  {{ currentPlayer.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                } @else {
                  Pending
                }
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">Rebuys</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ rebuyCount() }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
              <p class="text-sm text-neutral-400">Net</p>
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

          <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="border-b border-white/10 px-4 py-3">
              <h2 class="text-lg font-semibold text-white">Game history</h2>
            </div>

            <div class="hidden grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 md:grid">
              <span>Type</span>
              <span>Time</span>
              <span>Amount</span>
              <span>Running buy-in</span>
            </div>

            @for (row of ledgerRows(); track row.transaction.id) {
              <div
                class="grid gap-3 border-b border-white/5 px-3 py-4 text-sm last:border-b-0 sm:px-4 md:grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr] md:items-center"
                [class.opacity-60]="row.transaction.deletedAt"
              >
                <span
                  class="text-xs font-semibold uppercase"
                  [class.text-sky-300]="row.transaction.type === 'BUYIN'"
                  [class.text-amber-300]="row.transaction.type === 'REBUY'"
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
                @if (row.transaction.comment) {
                  <div class="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 md:col-span-4">
                    <span class="text-neutral-500">Note</span>
                    <span
                      class="text-neutral-400"
                      [class.text-neutral-500]="row.transaction.deletedAt"
                      [class.line-through]="row.transaction.deletedAt"
                    >
                      {{ row.transaction.comment }}
                    </span>
                  </div>
                }
              </div>
            } @empty {
              <div class="px-4 py-8 text-center text-sm text-neutral-500">
                No transactions have been recorded for you in this session.
              </div>
            }
          </div>

          <div class="hidden sm:flex">
            <a
              routerLink="/player/dashboard"
              [queryParams]="{ tab: 'history' }"
              class="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-neutral-100 transition duration-200 ease-out hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
              (click)="preparePlayerRouteTransition('back')"
            >
              Back to history
            </a>
          </div>

          <div class="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] backdrop-blur sm:hidden">
            <a
              routerLink="/player/dashboard"
              [queryParams]="{ tab: 'history' }"
              class="flex min-h-12 w-full items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-300/10 text-base font-semibold text-emerald-100 transition duration-200 ease-out active:scale-[0.98] active:bg-emerald-300/20"
              (click)="preparePlayerRouteTransition('back')"
            >
              Back to history
            </a>
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
          (click)="preparePlayerRouteTransition('back')"
        >
          Back to my sessions
        </a>
      </section>
    }
  `
})
export class PlayerSessionDetailPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(PokerStoreService);
  private readonly document = inject(DOCUMENT);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId');

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly player = computed(() => {
    const userId = this.authState.user()?.id ?? null;
    const targetName = this.playerName().trim().toLowerCase();

    return this.session()?.players.find((player) =>
      this.playerMatchesLogin(player, userId, targetName)
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

  protected preparePlayerRouteTransition(direction: 'forward' | 'back'): void {
    if (!this.document.defaultView?.matchMedia('(max-width: 639px)').matches) {
      return;
    }

    this.document.documentElement.dataset['playerRouteTransition'] = direction;
    this.document.defaultView.setTimeout(() => {
      delete this.document.documentElement.dataset['playerRouteTransition'];
    }, 700);
  }

  private playerMatchesLogin(
    player: SessionPlayer,
    userId: string | null,
    targetName: string
  ): boolean {
    if (player.userId) {
      return player.userId === userId;
    }

    return player.name.trim().toLowerCase() === targetName;
  }
}
