import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PokerStoreService } from '../data/poker-store.service';

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

        @if (authState.isHostAdmin()) {
          <a
            routerLink="/host/sessions/new"
            class="inline-flex items-center justify-center rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
          >
            New Session
          </a>
        }
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

      <section class="space-y-4">
        <div class="flex items-center">
          <h2 class="text-xl font-semibold text-white">Active tables</h2>
        </div>

        @if (store.activeSessions().length === 0) {
          <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <p class="text-lg font-semibold text-white">No active session</p>
            <p class="mt-2 text-sm text-neutral-400">Start a table when the first player arrives.</p>
            @if (authState.isHostAdmin()) {
              <a
                routerLink="/host/sessions/new"
                class="mt-5 inline-flex rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
              >
                Create session
              </a>
            }
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

                <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p class="text-neutral-500">Players</p>
                    <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p class="font-semibold text-white">{{ totals.totalPlayers }}</p>
                      <p class="text-xs font-semibold text-emerald-300">
                        {{ totals.cashedOutPlayers }} Cashed-Out
                      </p>
                    </div>
                  </div>
                  <div>
                    <p class="text-neutral-500">Buy-in</p>
                    <p class="mt-1 font-semibold text-white">
                      {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
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
  protected readonly store = inject(PokerStoreService);
  protected readonly authState = inject(AuthStateService);
}
