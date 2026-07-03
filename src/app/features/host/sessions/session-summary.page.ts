import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PokerStoreService, PokerTransaction } from '../data/poker-store.service';

@Component({
  selector: 'app-session-summary-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    @if (session(); as currentSession) {
      @let totals = store.totalsFor(currentSession);
      <section class="space-y-5 sm:space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">Dashboard</a>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-semibold text-white sm:text-3xl">Session Summary</h1>
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                [class.bg-emerald-300]="currentSession.status === 'ACTIVE'"
                [class.text-neutral-950]="currentSession.status === 'ACTIVE'"
                [class.bg-white]="currentSession.status === 'COMPLETED'"
                [class.text-neutral-950]="currentSession.status === 'COMPLETED'"
              >
                {{ currentSession.status }}
              </span>
            </div>
            <p class="mt-2 text-sm text-neutral-400 sm:text-base">
              {{ currentSession.name }} · {{ currentSession.sessionDate | date: 'mediumDate' }}
              @if (currentSession.closedAt) {
                · Closed {{ currentSession.closedAt | date: 'shortTime' }}
              }
            </p>
          </div>
          <a
            routerLink="/host/sessions/history"
            class="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            View History
          </a>
        </div>

        @if (store.error()) {
          <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ store.error() }}
          </div>
        }

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <p class="text-sm text-neutral-400">Total players</p>
            <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">{{ totals.totalPlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:block sm:p-4">
            <p class="text-sm text-neutral-400">Total cash out</p>
            <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">
              {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <p class="text-sm text-neutral-400">Net total</p>
            <p
              class="mt-1 text-2xl font-semibold sm:mt-2"
              [class.text-emerald-300]="totals.totalNet >= 0"
              [class.text-red-300]="totals.totalNet < 0"
            >
              {{ totals.totalNet | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
        </div>

        @if (totals.activePlayers > 0) {
          <div class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            {{ totals.activePlayers }} player(s) still have pending cash out values in this session.
          </div>
        }

        <section class="rounded-lg border border-white/10 bg-white/[0.04]">
          <div class="border-b border-white/10 px-4 py-3">
            <h2 class="text-sm font-semibold uppercase text-neutral-500">Player detail</h2>
          </div>
          <div class="space-y-3 p-3 sm:p-4">
          @for (player of sortedPlayers(); track player.id) {
            <article class="rounded-lg border border-white/10 bg-neutral-950 p-3 sm:p-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate font-semibold text-white">{{ player.name }}</h3>
                    @if (player.status === 'ACTIVE') {
                      <span class="rounded-full bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100">
                        Pending
                      </span>
                    } @else {
                      <span class="rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-950">
                        Cashed out
                      </span>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-sm lg:min-w-96">
                  <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                    <span class="block text-xs text-neutral-500">Buy-in</span>
                    <span class="mt-1 block text-base font-semibold text-white">
                      {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </span>
                  </span>
                  <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                    <span class="block text-xs text-neutral-500">Cash</span>
                    @if (player.status === 'COMPLETED') {
                      <span class="mt-1 block text-base font-semibold text-white">
                        {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    } @else {
                      <span class="mt-1 block text-base font-semibold text-neutral-500">Pending</span>
                    }
                  </span>
                  <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                    <span class="block text-xs text-neutral-500">Net</span>
                    @if (player.status === 'COMPLETED') {
                      <span
                        class="mt-1 block text-base font-semibold"
                        [class.text-emerald-300]="player.net >= 0"
                        [class.text-red-300]="player.net < 0"
                      >
                        {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    } @else {
                      <span class="mt-1 block text-base font-semibold text-neutral-500">Pending</span>
                    }
                  </span>
                </div>
              </div>

              <div class="mt-3 space-y-2">
                @for (transaction of transactionsForPlayer(player.id); track transaction.id) {
                  <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <span
                      class="h-3 w-3 rounded-full"
                      [class.bg-emerald-300]="transaction.type === 'BUYIN'"
                      [class.bg-sky-300]="transaction.type === 'REBUY'"
                      [class.bg-amber-300]="transaction.type === 'CASHOUT'"
                    ></span>
                    <span class="min-w-0">
                      <span
                        class="text-sm font-semibold uppercase"
                        [class.text-emerald-200]="transaction.type === 'BUYIN'"
                        [class.text-sky-200]="transaction.type === 'REBUY'"
                        [class.text-amber-200]="transaction.type === 'CASHOUT'"
                      >
                        {{ transaction.type }}
                      </span>
                      <span class="mt-1 block text-xs text-neutral-500">
                        {{ transaction.createdAt | date: 'short' }}
                      </span>
                    </span>
                    <span class="text-center text-lg font-semibold text-white">
                      {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </span>
                  </div>
                }
              </div>
            </article>
          } @empty {
            <div class="px-4 py-8 text-center text-sm text-neutral-500">
              No players were added to this session.
            </div>
          }
          </div>
        </section>
      </section>
    } @else {
      <section class="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 class="text-2xl font-semibold text-white">Summary not found</h1>
        <a
          routerLink="/host/dashboard"
          class="mt-5 inline-flex rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
        >
          Go to dashboard
        </a>
      </section>
    }
  `
})
export class SessionSummaryPage {
  protected readonly store = inject(PokerStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly sortedPlayers = computed(() => this.store.sortedPlayersByNet(this.session()));

  protected transactionsForPlayer(playerId: string): PokerTransaction[] {
    return (
      this.session()
        ?.transactions.filter((transaction) => transaction.playerId === playerId && !transaction.deletedAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)) ?? []
    );
  }
}
