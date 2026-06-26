import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MockPokerStoreService } from '../data/mock-poker-store.service';

@Component({
  selector: 'app-session-summary-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    @if (session(); as currentSession) {
      @let totals = store.totalsFor(currentSession);
      <section class="space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">Dashboard</a>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h1 class="text-3xl font-semibold text-white">Session Summary</h1>
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
            <p class="mt-2 text-neutral-400">
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

        <div class="grid gap-4 md:grid-cols-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Total players</p>
            <p class="mt-2 text-2xl font-semibold text-white">{{ totals.totalPlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-2 text-2xl font-semibold text-white">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Total cash out</p>
            <p class="mt-2 text-2xl font-semibold text-white">
              {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Net total</p>
            <p
              class="mt-2 text-2xl font-semibold"
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

        <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          <div class="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 md:grid">
            <span>Player</span>
            <span>Buy In</span>
            <span>Cash Out</span>
            <span>Net</span>
          </div>
          @for (player of sortedPlayers(); track player.id) {
            <div class="grid gap-3 border-b border-white/5 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center">
              <div>
                <span class="font-semibold text-white">{{ player.name }}</span>
                @if (player.status === 'ACTIVE') {
                  <span class="ml-2 rounded-full bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100">
                    Pending
                  </span>
                }
              </div>
              <div class="grid grid-cols-2 gap-3 md:block">
                <span class="text-neutral-500 md:hidden">Buy In</span>
                <span class="text-neutral-200">{{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
              </div>
              <div class="grid grid-cols-2 gap-3 md:block">
                <span class="text-neutral-500 md:hidden">Cash Out</span>
                @if (player.status === 'COMPLETED') {
                  <span class="text-neutral-200">{{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                } @else {
                  <span class="text-neutral-500">Pending</span>
                }
              </div>
              <div class="grid grid-cols-2 gap-3 md:block">
                <span class="text-neutral-500 md:hidden">Net</span>
                @if (player.status === 'COMPLETED') {
                  <span
                    class="font-semibold"
                    [class.text-emerald-300]="player.net >= 0"
                    [class.text-red-300]="player.net < 0"
                  >
                    {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </span>
                } @else {
                  <span class="font-semibold text-neutral-500">Pending</span>
                }
              </div>
            </div>
          } @empty {
            <div class="px-4 py-8 text-center text-sm text-neutral-500">
              No players were added to this session.
            </div>
          }
        </div>
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
  protected readonly store = inject(MockPokerStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly sortedPlayers = computed(() => this.store.sortedPlayersByNet(this.session()));
}
