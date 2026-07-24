import { CurrencyPipe, DOCUMENT, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideChevronDown, LucideCrown } from '@lucide/angular';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PokerStoreService, SessionPlayer } from '../../host/data/poker-store.service';
import {
  managerSessionTipTotal,
  playerTableDetailRoster
} from '../dashboard/player-dashboard.logic';

@Component({
  selector: 'app-player-session-detail-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    LucideChevronDown,
    LucideCrown,
    RouterLink
  ],
  template: `
    @if (player(); as currentPlayer) {
      @if (session(); as currentSession) {
        <section class="space-y-5 sm:space-y-6">
          <div class="player-session-heading flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold text-white sm:text-3xl">{{ currentSession.name }}</h1>
              <p class="mt-2 text-sm text-neutral-400">
                {{ currentSession.sessionDate | date: 'mediumDate' }} · Player {{ playerName() }}
              </p>
            </div>
            <span
              class="player-status-sign player-status-sign--detail shrink-0 px-2 py-0.5 text-sm font-semibold"
              [class.player-status-neon]="currentPlayer.status === 'ACTIVE'"
              [class.player-status-complete]="currentPlayer.status === 'COMPLETED'"
            >
              {{ currentPlayer.status }}
            </span>
          </div>

          @if (store.error()) {
            <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {{ store.error() }}
            </div>
          }

          <div class="player-session-stats grid grid-cols-2 gap-3 md:max-w-3xl md:gap-4">
            <div class="player-session-stat player-session-stat--buyin rounded-lg p-3 sm:p-5">
              <p class="player-session-stat-label text-sm">My total buy in</p>
              <p class="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-3xl">
                {{ currentPlayer.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="player-session-stat player-session-stat--rebuy rounded-lg p-3 sm:p-5">
              <p class="player-session-stat-label text-sm">Rebuys</p>
              <p class="mt-1 text-2xl font-semibold text-sky-100 sm:mt-2 sm:text-3xl">{{ rebuyCount() }}</p>
            </div>
            <div class="player-session-stat player-session-stat--cashout rounded-lg p-3 sm:p-5">
              <p class="player-session-stat-label text-sm">Cashed out</p>
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
            <div class="player-session-stat player-session-stat--net rounded-lg p-3 sm:p-5">
              <p class="player-session-stat-label text-sm">Net</p>
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
            @if (managerTipTotal() > 0) {
              <div class="player-session-stat player-session-stat--tips col-span-2 rounded-lg p-3 sm:p-5">
                <p class="player-session-stat-label text-sm">My tips</p>
                <p class="mt-1 text-2xl font-semibold text-emerald-200 sm:mt-2 sm:text-3xl">
                  {{ managerTipTotal() | currency: 'USD' : 'symbol' : '1.0-0' }}
                </p>
              </div>
            }
          </div>

          <div class="player-detail-section player-detail-section--timeline overflow-hidden rounded-lg">
            <div class="player-detail-section-heading px-4 py-3">
              <h2 class="text-lg font-semibold text-white">Buy-in timeline</h2>
            </div>

            <div class="space-y-2 p-3 sm:p-4">
              @for (transaction of transactions(); track transaction.id) {
                <div
                  class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-neutral-950 p-3"
                  [class.opacity-60]="transaction.deletedAt"
                >
                  <span
                    class="h-3 w-3 rounded-full"
                    [class.bg-emerald-300]="transaction.type === 'BUYIN' && !transaction.deletedAt"
                    [class.bg-sky-300]="transaction.type === 'REBUY' && !transaction.deletedAt"
                    [class.bg-amber-300]="transaction.type === 'CASHOUT' && !transaction.deletedAt"
                    [class.bg-neutral-700]="transaction.deletedAt"
                    aria-hidden="true"
                  ></span>
                  <span class="min-w-0">
                    <span
                      class="text-sm font-semibold uppercase"
                      [class.text-emerald-200]="transaction.type === 'BUYIN' && !transaction.deletedAt"
                      [class.text-sky-200]="transaction.type === 'REBUY' && !transaction.deletedAt"
                      [class.text-amber-200]="transaction.type === 'CASHOUT' && !transaction.deletedAt"
                      [class.text-neutral-500]="transaction.deletedAt"
                      [class.line-through]="transaction.deletedAt"
                    >
                      {{ transaction.type }}
                    </span>
                    <span
                      class="mt-1 block text-xs text-neutral-500"
                      [class.line-through]="transaction.deletedAt"
                    >
                      {{ transaction.createdAt | date: 'short' }}
                    </span>
                  </span>
                  <span
                    class="text-center text-lg font-semibold text-white"
                    [class.text-neutral-500]="transaction.deletedAt"
                    [class.line-through]="transaction.deletedAt"
                  >
                    {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </span>
                </div>
              } @empty {
                <div class="rounded-lg border border-dashed border-white/10 p-4 text-sm text-neutral-500">
                  No buy-in activity has been recorded for you in this session.
                </div>
              }
            </div>
          </div>

          <section class="player-table-roster overflow-hidden rounded-lg">
            <button
              type="button"
              class="player-table-roster-toggle flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left"
              [attr.aria-expanded]="tablePlayersExpanded()"
              aria-controls="player-table-roster-panel"
              (click)="toggleTablePlayers()"
            >
              <strong class="min-w-0 text-lg font-semibold text-white">Table players</strong>
              <span class="flex shrink-0 items-center gap-2 text-sm font-semibold text-neutral-300">
                {{ tablePlayers().length }}
                <svg
                  lucideChevronDown
                  class="player-table-roster-chevron h-5 w-5"
                  [strokeWidth]="2"
                  [absoluteStrokeWidth]="true"
                  aria-hidden="true"
                ></svg>
              </span>
            </button>

            <div
              id="player-table-roster-panel"
              class="player-table-roster-panel"
              [class.is-open]="tablePlayersExpanded()"
              [attr.aria-hidden]="!tablePlayersExpanded()"
            >
              <div class="player-table-roster-panel-inner">
                <div class="grid gap-2 border-t border-white/10 p-3 sm:p-4">
                  @for (tablePlayer of tablePlayers(); track tablePlayer.sessionPlayerId) {
                    <div
                      class="player-table-player-row relative flex min-h-11 min-w-0 items-center rounded-lg border bg-neutral-950 px-3 py-2.5 pr-12"
                      [class.player-table-player--leader]="tablePlayer.isNetLeader"
                    >
                      <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white">
                        {{ tablePlayer.name }}
                      </strong>
                      @if (tablePlayer.isNetLeader) {
                        <span
                          class="player-table-crown absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center text-amber-200"
                          aria-label="Highest net"
                          title="Highest net"
                        >
                          <svg lucideCrown class="h-4 w-4" [strokeWidth]="2.2" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                        </span>
                      }
                    </div>
                  } @empty {
                    <div class="rounded-lg border border-dashed border-white/10 p-4 text-sm text-neutral-500">
                      No table players are available.
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>

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
  `,
  styles: [
    `
      .player-status-sign {
        display: inline-flex;
        align-items: center;
        min-height: 1.75rem;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        line-height: 1;
        letter-spacing: 0;
      }

      .player-status-sign--detail {
        min-height: 1.5rem;
      }

      .player-status-neon {
        border-color: rgba(74, 222, 128, 0.72);
        background: rgba(3, 20, 13, 0.9);
        color: #86efac;
        font-family: 'Share Tech Mono', ui-monospace, monospace;
        text-shadow: 0 0 5px rgba(134, 239, 172, 0.92), 0 0 10px rgba(74, 222, 128, 0.62);
        box-shadow:
          inset 0 0 0 2px rgba(74, 222, 128, 0.08),
          inset 0 0 9px rgba(74, 222, 128, 0.14),
          0 0 7px rgba(74, 222, 128, 0.42),
          0 0 15px rgba(74, 222, 128, 0.2);
        animation: player-status-neon-pulse 2.8s ease-in-out infinite;
      }

      .player-status-complete {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: #f5f5f5;
      }

      .player-session-stat {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
      }

      .player-session-stat::before {
        position: absolute;
        inset: 0 0 auto;
        height: 2px;
        content: '';
      }

      .player-session-stat-label {
        color: #a3a3a3;
      }

      .player-session-stat--buyin {
        border-color: rgba(110, 231, 183, 0.2);
        background: rgba(52, 211, 153, 0.06);
      }

      .player-session-stat--buyin::before {
        background: rgba(110, 231, 183, 0.8);
      }

      .player-session-stat--buyin .player-session-stat-label {
        color: #a7f3d0;
      }

      .player-session-stat--rebuy {
        border-color: rgba(125, 211, 252, 0.2);
        background: rgba(56, 189, 248, 0.06);
      }

      .player-session-stat--rebuy::before {
        background: rgba(125, 211, 252, 0.8);
      }

      .player-session-stat--rebuy .player-session-stat-label {
        color: #bae6fd;
      }

      .player-session-stat--cashout {
        border-color: rgba(252, 211, 77, 0.2);
        background: rgba(251, 191, 36, 0.05);
      }

      .player-session-stat--cashout::before {
        background: rgba(252, 211, 77, 0.76);
      }

      .player-session-stat--cashout .player-session-stat-label {
        color: #fde68a;
      }

      .player-session-stat--net::before {
        background: rgba(212, 212, 216, 0.48);
      }

      .player-session-stat--tips {
        border-color: rgba(74, 222, 128, 0.24);
        background: rgba(34, 197, 94, 0.065);
      }

      .player-session-stat--tips::before {
        background: rgba(74, 222, 128, 0.82);
      }

      .player-session-stat--tips .player-session-stat-label {
        color: #bbf7d0;
      }

      .player-detail-section {
        border: 1px solid rgba(110, 231, 183, 0.2);
        background: rgba(255, 255, 255, 0.035);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
      }

      .player-detail-section-heading {
        border-bottom: 1px solid rgba(110, 231, 183, 0.18);
        background: rgba(52, 211, 153, 0.055);
        box-shadow: inset 3px 0 0 rgba(110, 231, 183, 0.7);
      }

      .player-detail-section-heading h2 {
        color: #d1fae5;
      }

      .player-table-roster {
        border: 1px solid rgba(125, 211, 252, 0.22);
        background: rgba(255, 255, 255, 0.035);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
      }

      .player-table-roster-toggle {
        border: 0;
        background: rgba(56, 189, 248, 0.055);
        box-shadow: inset 3px 0 0 rgba(125, 211, 252, 0.7);
      }

      .player-table-roster-toggle:hover {
        background: rgba(56, 189, 248, 0.09);
      }

      .player-table-roster-toggle:focus-visible {
        outline: 2px solid rgba(125, 211, 252, 0.72);
        outline-offset: -3px;
      }

      .player-table-roster-panel {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        pointer-events: none;
        transition:
          grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 180ms ease-out;
      }

      .player-table-roster-panel.is-open {
        grid-template-rows: 1fr;
        opacity: 1;
        pointer-events: auto;
      }

      .player-table-roster-panel-inner {
        min-height: 0;
        overflow: hidden;
      }

      .player-table-roster-chevron {
        transition: transform 240ms ease;
      }

      .player-table-roster-toggle[aria-expanded='true'] .player-table-roster-chevron {
        transform: rotate(180deg);
      }

      .player-table-player-row {
        border-color: rgba(255, 255, 255, 0.1);
      }

      .player-table-player--leader {
        border-color: rgba(252, 211, 77, 0.58);
        background: rgba(251, 191, 36, 0.075);
        box-shadow:
          inset 0 0 0 1px rgba(252, 211, 77, 0.12),
          0 0 9px rgba(251, 191, 36, 0.28),
          0 0 18px rgba(251, 191, 36, 0.1);
      }

      .player-table-crown {
        filter: drop-shadow(0 0 3px rgba(253, 224, 71, 0.95))
          drop-shadow(0 0 7px rgba(251, 191, 36, 0.62));
      }

      @keyframes player-status-neon-pulse {
        0%,
        100% {
          opacity: 0.88;
        }

        50% {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .player-status-neon {
          animation: none;
        }

        .player-table-roster-panel,
        .player-table-roster-chevron {
          transition: none;
        }
      }
    `
  ]
})
export class PlayerSessionDetailPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(PokerStoreService);
  private readonly document = inject(DOCUMENT);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId');

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly managerTipTotal = computed(() => {
    const session = this.session();

    return session
      ? managerSessionTipTotal(session, this.authState.user()?.id ?? null)
      : 0;
  });
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
  protected readonly tablePlayersExpanded = signal(false);
  protected readonly tablePlayers = computed(() => {
    const session = this.session();
    const player = this.player();

    return session && player
      ? playerTableDetailRoster(session, player, this.store.playerPublicTableRoster())
      : [];
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store exposes the error state; keep the page render path simple.
    }
  }

  protected toggleTablePlayers(): void {
    this.tablePlayersExpanded.update((expanded) => !expanded);
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
