import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PokerStoreService } from '../data/poker-store.service';

@Component({
  selector: 'app-session-history-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="space-y-5 sm:space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">&larr; Dashboard</a>
          <p class="text-sm font-medium uppercase text-emerald-300">History</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Session History</h1>
        </div>
        <a
          routerLink="/host/sessions/new"
          class="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
        >
          New Session
        </a>
      </div>

      @if (store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ store.error() }}
        </div>
      }

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
          <p class="text-sm text-neutral-400">Total sessions</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">{{ store.sessions().length }}</p>
        </div>
        <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4 md:block">
          <p class="text-sm text-neutral-400">Completed</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">{{ store.completedSessions().length }}</p>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
          <p class="text-sm text-neutral-400">Tracked buy-ins</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">
            {{ allTimeBuyIns() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </p>
        </div>
      </div>

      @if (store.sessions().length === 0) {
        <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <p class="text-lg font-semibold text-white">No sessions yet</p>
          <p class="mt-2 text-sm text-neutral-400">Completed and active sessions will appear here.</p>
        </div>
      } @else {
        <div class="grid gap-4">
          @for (session of sortedSessions(); track session.id) {
            @let totals = store.totalsFor(session);
            <a
              [routerLink]="
                session.status === 'COMPLETED'
                  ? ['/host/sessions', session.id, 'summary']
                  : ['/host/sessions', session.id]
              "
              class="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/50 hover:bg-white/[0.07] sm:p-5"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-lg font-semibold text-white">{{ session.name }}</h2>
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      [class.bg-emerald-300]="session.status === 'ACTIVE'"
                      [class.text-neutral-950]="session.status === 'ACTIVE'"
                      [class.bg-white]="session.status === 'COMPLETED'"
                      [class.text-neutral-950]="session.status === 'COMPLETED'"
                    >
                      {{ session.status }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-neutral-400">
                    {{ session.sessionDate | date: 'mediumDate' }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 md:min-w-96">
                  <div>
                    <p class="text-neutral-500">Players</p>
                    <p class="mt-1 font-semibold text-white">{{ totals.totalPlayers }}</p>
                  </div>
                  <div>
                    <p class="text-neutral-500">Buy-in</p>
                    <p class="mt-1 font-semibold text-white">
                      {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>
                  <div class="hidden sm:block">
                    <p class="text-neutral-500">Cash out</p>
                    <p class="mt-1 font-semibold text-white">
                      {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>
                </div>
              </div>
              @if (totals.activePlayers > 0) {
                <p class="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
                  {{ totals.activePlayers }} pending cash out
                </p>
              }
            </a>
          }
        </div>
      }
    </section>
  `
})
export class SessionHistoryPage {
  protected readonly store = inject(PokerStoreService);
  protected readonly sortedSessions = computed(() =>
    [...this.store.sessions()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
  protected readonly allTimeBuyIns = computed(() =>
    this.store
      .sessions()
      .reduce((sum, session) => sum + this.store.totalsFor(session).totalBuyIn, 0)
  );
}
