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
          <h1 class="text-2xl font-semibold text-white sm:text-3xl">Session History</h1>
        </div>
      </div>

      @if (store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ store.error() }}
        </div>
      }

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
              [queryParams]="session.status === 'ACTIVE' ? { from: 'history' } : null"
              class="session-history-card rounded-lg border bg-white/[0.04] p-4 transition hover:border-emerald-300/50 hover:bg-white/[0.07] sm:p-5"
              [class.session-history-card-active]="session.status === 'ACTIVE'"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-lg font-semibold text-white">{{ session.name }}</h2>
                    @if (session.status === 'ACTIVE') {
                      <span
                        class="rounded-md border border-emerald-300/40 px-2 py-1 text-xs font-semibold text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.16)]"
                      >
                        Active
                      </span>
                    } @else {
                      <span class="text-lg font-bold leading-none text-emerald-300" aria-label="Completed session">&check;</span>
                    }
                  </div>
                  <p class="mt-1 text-sm text-neutral-400">
                    {{ session.sessionDate | date: 'mediumDate' }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 md:min-w-96">
                  <div>
                    <p class="text-neutral-500">Players</p>
                    <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p class="font-semibold text-white">{{ totals.totalPlayers }}</p>
                      <p class="text-xs font-semibold text-emerald-300">
                        {{ totals.cashedOutPlayers }} cashed out
                      </p>
                    </div>
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
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .session-history-card {
        border-color: rgb(255 255 255 / 0.1);
      }

      .session-history-card-active {
        border-color: rgb(52 211 153 / 0.45);
        box-shadow: 0 0 24px rgb(52 211 153 / 0.12);
      }
    `
  ]
})
export class SessionHistoryPage {
  protected readonly store = inject(PokerStoreService);
  protected readonly sortedSessions = computed(() =>
    [...this.store.sessions()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}
