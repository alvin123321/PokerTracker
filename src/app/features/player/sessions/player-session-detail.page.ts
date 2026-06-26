import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { MockPokerStoreService, MockTransaction } from '../../host/data/mock-poker-store.service';

interface PlayerLedgerRow {
  transaction: MockTransaction;
  runningBuyIn: number;
}

@Component({
  selector: 'app-player-session-detail-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    @if (player(); as currentPlayer) {
      @if (session(); as currentSession) {
        <section class="space-y-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <a routerLink="/player/dashboard" class="text-sm font-semibold text-sky-300">My Sessions</a>
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <h1 class="text-3xl font-semibold text-white">{{ currentSession.name }}</h1>
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
            <div class="rounded-lg border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100">
              Your private session detail
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-4">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p class="text-sm text-neutral-400">My buy-ins</p>
              <p class="mt-2 text-3xl font-semibold text-white">
                {{ currentPlayer.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p class="text-sm text-neutral-400">Rebuys</p>
              <p class="mt-2 text-3xl font-semibold text-white">{{ rebuyCount() }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p class="text-sm text-neutral-400">My cash out</p>
              <p class="mt-2 text-3xl font-semibold text-white">
                @if (currentPlayer.status === 'COMPLETED') {
                  {{ currentPlayer.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                } @else {
                  Pending
                }
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p class="text-sm text-neutral-400">My net</p>
              <p
                class="mt-2 text-3xl font-semibold"
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
                class="grid gap-3 border-b border-white/5 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr_1.2fr] md:items-center"
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
                <div class="grid grid-cols-2 gap-3 md:block">
                  <span class="text-neutral-500 md:hidden">Running buy-in</span>
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
export class PlayerSessionDetailPage {
  private readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MockPokerStoreService);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId');

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
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
}
