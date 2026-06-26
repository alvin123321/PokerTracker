import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockPokerStoreService } from '../data/mock-poker-store.service';

@Component({
  selector: 'app-host-dashboard-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="space-y-6 sm:space-y-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-medium uppercase text-emerald-300">Host</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Dashboard</h1>
        </div>

        <a
          routerLink="/host/sessions/new"
          class="inline-flex items-center justify-center rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
        >
          New Session
        </a>
      </div>

      @if (store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ store.error() }}
        </div>
      }

      @if (store.loading()) {
        <div class="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-50">
          Loading latest sessions...
        </div>
      }

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
          <p class="text-sm text-neutral-400">Active sessions</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ store.activeSessions().length }}</p>
        </div>
        <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5 md:block">
          <p class="text-sm text-neutral-400">Total players today</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ todaysPlayerCount() }}</p>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
          <p class="text-sm text-neutral-400">Open buy-ins</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
            {{ openBuyIns() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </p>
        </div>
      </div>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Active tables</h2>
          <a routerLink="/host/sessions/history" class="text-sm font-semibold text-emerald-300">
            History
          </a>
        </div>

        @if (store.activeSessions().length === 0) {
          <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <p class="text-lg font-semibold text-white">No active session</p>
            <p class="mt-2 text-sm text-neutral-400">Start a table when the first player arrives.</p>
            <a
              routerLink="/host/sessions/new"
              class="mt-5 inline-flex rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
            >
              Create session
            </a>
          </div>
        } @else {
          <div class="grid gap-4 lg:grid-cols-2">
            @for (session of store.activeSessions(); track session.id) {
              @let totals = store.totalsFor(session);
              <a
                [routerLink]="['/host/sessions', session.id]"
                class="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/50 hover:bg-white/[0.07] sm:p-5"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-white">{{ session.name }}</h3>
                    <p class="mt-1 text-sm text-neutral-400">
                      {{ session.sessionDate | date: 'mediumDate' }}
                    </p>
                  </div>
                  <span class="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-neutral-950">
                    Active
                  </span>
                </div>

                <div class="mt-5 grid grid-cols-3 gap-3 text-sm">
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
                  <div>
                    <p class="text-neutral-500">Open</p>
                    <p class="mt-1 font-semibold text-white">{{ totals.activePlayers }}</p>
                  </div>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </section>
  `
})
export class HostDashboardPage {
  protected readonly store = inject(MockPokerStoreService);
  protected readonly todaysPlayerCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);

    return this.store
      .sessions()
      .filter((session) => session.sessionDate === today)
      .reduce((sum, session) => sum + session.players.length, 0);
  });
  protected readonly openBuyIns = computed(() =>
    this.store
      .activeSessions()
      .reduce((sum, session) => sum + this.store.totalsFor(session).totalBuyIn, 0)
  );
}
