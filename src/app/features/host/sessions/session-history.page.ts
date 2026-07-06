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
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Session History</h1>
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
              class="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/50 hover:bg-white/[0.07] sm:p-5"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-lg font-semibold text-white">{{ session.name }}</h2>
                    @if (session.status === 'ACTIVE') {
                      <span class="session-state session-state-active" aria-label="Active session"></span>
                    } @else {
                      <span class="session-state session-state-complete" aria-label="Completed session">
                        <span aria-hidden="true">&check;</span>
                      </span>
                    }
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
  ,
  styles: [
    `
      .session-state {
        display: inline-grid;
        width: 1.35rem;
        height: 1.35rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 9999px;
      }

      .session-state-active {
        background: rgb(52 211 153);
        box-shadow:
          0 0 0 0.28rem rgb(52 211 153 / 0.13),
          0 0 1.1rem rgb(52 211 153 / 0.55);
      }

      .session-state-complete {
        border: 1px solid rgb(255 255 255 / 0.16);
        background: rgb(255 255 255 / 0.9);
        color: rgb(10 10 10);
        font-size: 0.78rem;
        font-weight: 900;
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
