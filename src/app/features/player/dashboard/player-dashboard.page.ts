import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerSession,
  PokerStoreService,
  SessionPlayer,
  PokerTransaction
} from '../../host/data/poker-store.service';

interface PlayerSessionEntry {
  session: PokerSession;
  player: SessionPlayer;
  transactions: PokerTransaction[];
  rebuyCount: number;
  lastActivityAt: string;
}

@Component({
  selector: 'app-player-dashboard-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="space-y-6 sm:space-y-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-medium uppercase text-sky-300">Player</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">My Sessions</h1>
          <p class="mt-2 text-sm text-neutral-400">
            Signed in as {{ playerName() }}. Only your own buy-ins, cash-outs, and results are shown.
          </p>
        </div>
        <div class="rounded-lg border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100">
          Private player view
        </div>
      </div>

      @if (store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ store.error() }}
        </div>
      }

      @if (store.loading()) {
        <div class="rounded-lg border border-sky-300/20 bg-sky-300/10 p-3 text-sm font-semibold text-sky-50">
          Loading your latest sessions...
        </div>
      }

      <div class="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
          <p class="text-sm text-neutral-400">Sessions</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ entries().length }}</p>
        </div>
        <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5 md:block">
          <p class="text-sm text-neutral-400">Active</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">{{ activeEntries().length }}</p>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
          <p class="text-sm text-neutral-400">My buy-ins</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
            {{ totalBuyIn() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </p>
        </div>
        <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5 md:block">
          <p class="text-sm text-neutral-400">My cash outs</p>
          <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
            {{ totalCashOut() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </p>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-5">
          <p class="text-sm text-neutral-400">Realized net</p>
          <p
            class="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl"
            [class.text-emerald-300]="realizedNet() >= 0"
            [class.text-red-300]="realizedNet() < 0"
          >
            {{ realizedNet() | currency: 'USD' : 'symbol' : '1.0-0' }}
          </p>
        </div>
      </div>

      @if (entries().length === 0) {
        <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <p class="text-lg font-semibold text-white">No player sessions found</p>
          <p class="mt-2 text-sm text-neutral-400">
            Ask the host to add this login to a session before play starts.
          </p>
        </div>
      } @else {
        <div class="grid gap-4">
          @for (entry of entries(); track entry.session.id + entry.player.id) {
            <a
              [routerLink]="['/player/sessions', entry.session.id]"
              class="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-sky-300/50 hover:bg-white/[0.07] sm:p-5"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-lg font-semibold text-white">{{ entry.session.name }}</h2>
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      [class.bg-sky-300]="entry.player.status === 'ACTIVE'"
                      [class.text-neutral-950]="entry.player.status === 'ACTIVE'"
                      [class.bg-white]="entry.player.status === 'COMPLETED'"
                      [class.text-neutral-950]="entry.player.status === 'COMPLETED'"
                    >
                      {{ entry.player.status }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-neutral-400">
                    {{ entry.session.sessionDate | date: 'mediumDate' }} · Last activity
                    {{ entry.lastActivityAt | date: 'shortTime' }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 md:min-w-[34rem]">
                  <div>
                    <p class="text-neutral-500">Buy-in</p>
                    <p class="mt-1 font-semibold text-white">
                      {{ entry.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>
                  <div class="hidden sm:block">
                    <p class="text-neutral-500">Cash out</p>
                    <p class="mt-1 font-semibold text-white">
                      @if (entry.player.status === 'COMPLETED') {
                        {{ entry.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                      } @else {
                        Pending
                      }
                    </p>
                  </div>
                  <div>
                    <p class="text-neutral-500">Rebuys</p>
                    <p class="mt-1 font-semibold text-white">{{ entry.rebuyCount }}</p>
                  </div>
                  <div>
                    <p class="text-neutral-500">Net</p>
                    @if (entry.player.status === 'COMPLETED') {
                      <p
                        class="mt-1 font-semibold"
                        [class.text-emerald-300]="entry.player.net >= 0"
                        [class.text-red-300]="entry.player.net < 0"
                      >
                        {{ entry.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </p>
                    } @else {
                      <p class="mt-1 font-semibold text-neutral-500">Pending</p>
                    }
                  </div>
                </div>
              </div>
            </a>
          }
        </div>
      }
    </section>
  `
})
export class PlayerDashboardPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  protected readonly store = inject(PokerStoreService);

  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly entries = computed<PlayerSessionEntry[]>(() => {
    const userId = this.authState.user()?.id ?? null;
    const targetName = this.playerName().trim().toLowerCase();

    return this.store
      .sessions()
      .flatMap((session) =>
        session.players
          .filter((player) =>
            userId ? player.userId === userId : player.name.trim().toLowerCase() === targetName
          )
          .map((player) => {
            const transactions = session.transactions
              .filter((transaction) => transaction.playerId === player.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const lastActivityAt =
              transactions[transactions.length - 1]?.createdAt ?? player.joinedAt ?? session.createdAt;

            return {
              session,
              player,
              transactions,
              rebuyCount: transactions.filter(
                (transaction) => transaction.type === 'REBUY' && !transaction.deletedAt
              ).length,
              lastActivityAt
            };
          })
      )
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  });
  protected readonly activeEntries = computed(() =>
    this.entries().filter((entry) => entry.player.status === 'ACTIVE')
  );
  protected readonly totalBuyIn = computed(() =>
    this.entries().reduce((sum, entry) => sum + entry.player.totalBuyIn, 0)
  );
  protected readonly totalCashOut = computed(() =>
    this.entries().reduce((sum, entry) => sum + entry.player.cashOut, 0)
  );
  protected readonly realizedNet = computed(() =>
    this.entries()
      .filter((entry) => entry.player.status === 'COMPLETED')
      .reduce((sum, entry) => sum + entry.player.net, 0)
  );

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store surfaces the error in the page-level error block.
    }
  }
}
