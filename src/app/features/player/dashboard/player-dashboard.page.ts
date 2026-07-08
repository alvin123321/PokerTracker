import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  LucideArrowDownToLine,
  LucideBanknoteArrowDown,
  LucideCalculator,
  LucideHistory,
  LucideHouse,
  LucideRefreshCcw
} from '@lucide/angular';
import { RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PotCalculatorPage } from '../../host/tools/pot-calculator.page';
import {
  PokerSession,
  PokerStoreService,
  SessionPlayer,
  PokerTransaction,
  PokerTransactionType
} from '../../host/data/poker-store.service';

type PlayerDashboardTab = 'overview' | 'sessions' | 'calculator';

interface PlayerSessionEntry {
  session: PokerSession;
  player: SessionPlayer;
  transactions: PokerTransaction[];
  rebuyCount: number;
  lastActivityAt: string;
}

interface PlayerActivityEntry {
  id: string;
  sessionId: string;
  sessionName: string;
  type: PokerTransactionType;
  amount: number;
  createdAt: string;
}

@Component({
  selector: 'app-player-dashboard-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    LucideArrowDownToLine,
    LucideBanknoteArrowDown,
    LucideCalculator,
    LucideHistory,
    LucideHouse,
    LucideRefreshCcw,
    RouterLink,
    PotCalculatorPage
  ],
  template: `
    <section class="player-dashboard">
      <header class="player-hero">
        <div class="player-identity">
          <div class="player-chip" aria-hidden="true">{{ playerInitials() }}</div>
          <div class="player-identity-copy">
            <h1>{{ playerName() }}</h1>
            <p>{{ playerSummary() }}</p>
          </div>
        </div>

        <div class="player-net" [class.player-net-positive]="realizedNet() >= 0" [class.player-net-negative]="realizedNet() < 0">
          <span>Net</span>
          <strong>{{ realizedNet() | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
        </div>
      </header>

      <nav class="player-tabs" aria-label="Player dashboard">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            class="player-tab"
            [class.player-tab-active]="activeTab() === tab.id"
            [attr.aria-label]="tab.label"
            [attr.aria-selected]="activeTab() === tab.id"
            [title]="tab.label"
            (click)="selectTab(tab.id)"
          >
            @switch (tab.id) {
              @case ('overview') {
                <svg
                  lucideHouse
                  class="pokertrack-nav-icon"
                  [strokeWidth]="3"
                  [absoluteStrokeWidth]="true"
                  aria-hidden="true"
                ></svg>
              }
              @case ('sessions') {
                <svg
                  lucideHistory
                  class="pokertrack-nav-icon"
                  [strokeWidth]="3"
                  [absoluteStrokeWidth]="true"
                  aria-hidden="true"
                ></svg>
              }
              @case ('calculator') {
                <svg
                  lucideCalculator
                  class="pokertrack-nav-icon"
                  [strokeWidth]="3"
                  [absoluteStrokeWidth]="true"
                  aria-hidden="true"
                ></svg>
              }
            }
            <span class="sr-only">{{ tab.label }}</span>
          </button>
        }
      </nav>

      @if (store.error()) {
        <div class="player-alert player-alert-error">
          {{ store.error() }}
        </div>
      }

      @if (store.loading()) {
        <div class="player-alert">
          Updating...
        </div>
      }

      <div class="player-view-shell">
        @switch (activeTab()) {
          @case ('overview') {
            <section class="player-view player-view-overview">
              @if (featuredEntry(); as entry) {
                <article class="player-feature-card" [class.player-feature-card-active]="entry.player.status === 'ACTIVE'">
                  <div class="feature-topline">
                    <span class="feature-status" [class.feature-status-active]="entry.player.status === 'ACTIVE'">
                      {{ statusLabel(entry) }}
                    </span>
                    <span>{{ entry.session.sessionDate | date: 'MMM d, y' }}</span>
                  </div>

                  <div class="feature-heading">
                    <div>
                      <h2>{{ entry.session.name }}</h2>
                      <p>{{ entry.rebuyCount + 1 }} total buy-ins</p>
                    </div>
                    <a [routerLink]="['/player/sessions', entry.session.id]" class="feature-link">Details</a>
                  </div>

                  <div class="player-metrics">
                    <div class="metric-card metric-buyin">
                      <span>Buy-in</span>
                      <strong>{{ entry.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                    </div>
                    <div class="metric-card metric-cashout">
                      <span>Cash out</span>
                      <strong>
                        @if (entry.player.status === 'COMPLETED') {
                          {{ entry.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                        } @else {
                          -
                        }
                      </strong>
                    </div>
                    <div class="metric-card" [class.metric-net-positive]="entry.player.net >= 0" [class.metric-net-negative]="entry.player.net < 0">
                      <span>Result</span>
                      <strong>
                        @if (entry.player.status === 'COMPLETED') {
                          {{ entry.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                        } @else {
                          Open
                        }
                      </strong>
                    </div>
                  </div>
                </article>
              } @else {
                <article class="player-empty-card">
                  <h2>No sessions yet</h2>
                  <p>Ask the host to add your login before play starts.</p>
                </article>
              }

              <section class="player-ledger-panel">
                <div class="panel-heading">
                  <h2>Recent</h2>
                  <span>{{ recentActivity().length }}</span>
                </div>

                <div class="activity-list">
                  @for (activity of recentActivity(); track activity.id) {
                    <a [routerLink]="['/player/sessions', activity.sessionId]" class="activity-row">
                      <span
                        class="activity-icon"
                        [class.activity-icon-buyin]="activity.type === 'BUYIN'"
                        [class.activity-icon-rebuy]="activity.type === 'REBUY'"
                        [class.activity-icon-cashout]="activity.type === 'CASHOUT'"
                      >
                        @switch (activity.type) {
                          @case ('BUYIN') {
                            <svg
                              lucideArrowDownToLine
                              [strokeWidth]="3"
                              [absoluteStrokeWidth]="true"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('REBUY') {
                            <svg
                              lucideRefreshCcw
                              [strokeWidth]="3"
                              [absoluteStrokeWidth]="true"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('CASHOUT') {
                            <svg
                              lucideBanknoteArrowDown
                              [strokeWidth]="3"
                              [absoluteStrokeWidth]="true"
                              aria-hidden="true"
                            ></svg>
                          }
                        }
                      </span>
                      <span class="activity-copy">
                        <strong>{{ activityLabel(activity.type) }}</strong>
                        <small>{{ activity.sessionName }} - {{ activity.createdAt | date: 'shortTime' }}</small>
                      </span>
                      <span class="activity-meta">
                        <span class="activity-amount">{{ activity.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                        <small>{{ activity.createdAt | date: 'MMM d' }}</small>
                      </span>
                    </a>
                  } @empty {
                    <p class="activity-empty">No activity yet.</p>
                  }
                </div>
              </section>
            </section>
          }

          @case ('sessions') {
            <section class="player-view player-session-grid">
              @for (entry of entries(); track entry.session.id + entry.player.id) {
                <a
                  [routerLink]="['/player/sessions', entry.session.id]"
                  class="session-tile"
                  [class.session-tile-active]="entry.player.status === 'ACTIVE'"
                >
                  <div class="session-tile-top">
                    <div>
                      <h2>{{ entry.session.name }}</h2>
                      <p>{{ entry.session.sessionDate | date: 'MMM d' }}</p>
                    </div>
                    <span>{{ statusLabel(entry) }}</span>
                  </div>

                  <div class="session-tile-stats">
                    <div>
                      <span>Buy-in</span>
                      <strong>{{ entry.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                    </div>
                    <div>
                      <span>Rebuys</span>
                      <strong>{{ entry.rebuyCount }}</strong>
                    </div>
                    <div>
                      <span>Net</span>
                      <strong [class.positive]="entry.player.net >= 0" [class.negative]="entry.player.net < 0">
                        @if (entry.player.status === 'COMPLETED') {
                          {{ entry.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                        } @else {
                          Open
                        }
                      </strong>
                    </div>
                  </div>
                </a>
              } @empty {
                <article class="player-empty-card">
                  <h2>No sessions yet</h2>
                  <p>Nothing to show.</p>
                </article>
              }
            </section>
          }

          @case ('calculator') {
            <section class="player-view calculator-player-panel">
              <app-pot-calculator-page [compact]="true" />
            </section>
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      .player-dashboard {
        display: grid;
        gap: 1rem;
        padding-bottom: calc(5.85rem + env(safe-area-inset-bottom, 0px));
        font-family:
          'Aptos Display', Aptos, Inter, ui-sans-serif, system-ui, -apple-system,
          BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .player-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1.1rem;
        background:
          linear-gradient(135deg, rgb(34 197 94 / 0.15), transparent 38%),
          rgb(255 255 255 / 0.045);
        box-shadow: 0 18px 48px rgb(0 0 0 / 0.28);
        padding: 1rem;
      }

      .player-identity {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.9rem;
      }

      .player-chip {
        display: grid;
        height: 3.45rem;
        width: 3.45rem;
        flex: 0 0 auto;
        place-items: center;
        border: 2px solid rgb(34 197 94 / 0.62);
        border-radius: 999px;
        background:
          radial-gradient(circle, rgb(255 255 255 / 0.14), transparent 54%),
          rgb(3 8 7 / 0.92);
        box-shadow: 0 0 22px rgb(34 197 94 / 0.18);
        color: white;
        font-size: 1.08rem;
        font-weight: 900;
      }

      .player-identity-copy {
        min-width: 0;
      }

      .player-identity-copy h1 {
        margin: 0;
        overflow: hidden;
        color: white;
        font-size: 1.75rem;
        font-weight: 780;
        line-height: 1.04;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .player-identity-copy p,
      .feature-topline,
      .feature-heading p,
      .panel-heading span,
      .session-tile-top p,
      .activity-copy small {
        color: rgb(161 161 170);
        font-size: 0.9rem;
      }

      .player-net {
        display: grid;
        min-width: 7rem;
        justify-items: end;
        gap: 0.18rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.95rem;
        background: rgb(0 0 0 / 0.28);
        padding: 0.72rem 0.85rem;
      }

      .player-net span,
      .metric-card span,
      .session-tile-stats span {
        color: rgb(161 161 170);
        font-size: 0.72rem;
        font-weight: 760;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .player-net strong {
        font-size: 1.36rem;
        font-weight: 680;
        line-height: 1;
      }

      .player-net-positive strong {
        color: rgb(74 222 128);
      }

      .player-net-negative strong {
        color: rgb(252 165 165);
      }

      .player-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.6rem;
        position: fixed;
        z-index: 30;
        right: 0;
        bottom: 0;
        left: 0;
        width: 100%;
        border-top: 1px solid rgb(255 255 255 / 0.1);
        background:
          linear-gradient(180deg, rgb(3 8 7 / 0.56), rgb(3 8 7 / 0.96)),
          rgb(3 8 7);
        box-shadow: 0 -18px 46px rgb(0 0 0 / 0.42);
        padding: 0.68rem 0.85rem calc(0.68rem + env(safe-area-inset-bottom, 0px));
        backdrop-filter: blur(20px);
      }

      .player-tab {
        display: inline-grid;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: 0.95rem;
        color: rgb(212 212 216);
        background: rgb(255 255 255 / 0.035);
        transition: all 190ms ease;
      }

      .player-tab:hover {
        background: rgb(255 255 255 / 0.055);
        color: white;
      }

      .player-tab:active {
        transform: scale(0.985);
      }

      .player-tab-active {
        border-color: rgb(34 197 94 / 0.55);
        background:
          linear-gradient(180deg, rgb(34 197 94 / 0.22), rgb(34 197 94 / 0.09)),
          rgb(255 255 255 / 0.045);
        box-shadow: 0 0 24px rgb(34 197 94 / 0.18);
        color: rgb(220 252 231);
      }

      @media (min-width: 640px) {
        .player-dashboard {
          padding-bottom: 0;
        }

        .player-tabs {
          position: static;
          justify-self: center;
          max-width: 18rem;
          border: 1px solid rgb(255 255 255 / 0.09);
          border-radius: 1rem;
          background: rgb(0 0 0 / 0.24);
          box-shadow: none;
          padding: 0.4rem;
          backdrop-filter: none;
        }
      }

      .player-alert {
        border: 1px solid rgb(34 197 94 / 0.24);
        border-radius: 0.9rem;
        background: rgb(34 197 94 / 0.08);
        color: rgb(220 252 231);
        padding: 0.75rem 0.9rem;
        font-size: 0.9rem;
        font-weight: 700;
      }

      .player-alert-error {
        border-color: rgb(248 113 113 / 0.3);
        background: rgb(248 113 113 / 0.1);
        color: rgb(254 202 202);
      }

      .player-view-shell,
      .player-view {
        min-width: 0;
      }

      .player-view {
        animation: player-view-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .player-view-overview {
        display: grid;
        gap: 1rem;
      }

      .player-feature-card,
      .player-ledger-panel,
      .session-tile,
      .player-empty-card,
      .calculator-player-panel {
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1rem;
        background:
          linear-gradient(145deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
          rgb(3 8 7 / 0.68);
      }

      .player-feature-card {
        display: grid;
        gap: 1rem;
        overflow: hidden;
        padding: 1rem;
        position: relative;
      }

      .feature-topline,
      .feature-heading,
      .session-tile-top,
      .activity-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
      }

      .feature-status,
      .session-tile-top span {
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 999px;
        color: rgb(212 212 216);
        flex: 0 0 auto;
        font-size: 0.74rem;
        font-weight: 850;
        padding: 0.32rem 0.58rem;
      }

      .feature-status-active,
      .session-tile-active .session-tile-top span {
        border-color: rgb(34 197 94 / 0.46);
        color: rgb(74 222 128);
      }

      .feature-heading {
        align-items: flex-end;
      }

      .feature-heading h2,
      .panel-heading h2,
      .session-tile-top h2,
      .player-empty-card h2 {
        margin: 0;
        color: white;
        font-size: 1.35rem;
        font-weight: 760;
        line-height: 1.1;
      }

      .feature-link {
        border: 1px solid rgb(34 197 94 / 0.42);
        border-radius: 999px;
        background: rgb(34 197 94 / 0.14);
        color: rgb(220 252 231);
        flex: 0 0 auto;
        font-size: 0.86rem;
        font-weight: 760;
        padding: 0.62rem 0.86rem;
        text-decoration: none;
        transition: all 180ms ease;
      }

      .player-metrics,
      .session-tile-stats {
        display: grid;
        gap: 0.65rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .metric-card {
        display: grid;
        gap: 0.35rem;
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.85rem;
        background: rgb(0 0 0 / 0.23);
        padding: 0.78rem;
      }

      .metric-card strong,
      .session-tile-stats strong {
        overflow: hidden;
        color: white;
        font-size: 1.28rem;
        font-weight: 680;
        line-height: 1.05;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .metric-buyin strong {
        color: rgb(253 224 71);
      }

      .metric-cashout strong,
      .positive {
        color: rgb(74 222 128);
      }

      .metric-net-negative strong,
      .negative {
        color: rgb(252 165 165);
      }

      .metric-net-positive strong {
        color: rgb(74 222 128);
      }

      .player-ledger-panel,
      .calculator-player-panel,
      .player-empty-card {
        padding: 1rem;
      }

      .panel-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }

      .activity-list {
        display: grid;
        gap: 0.5rem;
      }

      .activity-row {
        position: relative;
        border: 1px solid rgb(255 255 255 / 0.08);
        border-radius: 0.85rem;
        background: rgb(0 0 0 / 0.22);
        color: white;
        padding: 0.72rem;
        text-decoration: none;
        transition: all 180ms ease;
        animation: activity-row-enter 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .activity-row:hover {
        border-color: rgb(34 197 94 / 0.34);
        background: rgb(255 255 255 / 0.055);
        transform: translateY(-1px);
      }

      .activity-icon {
        display: grid;
        height: 2.35rem;
        width: 2.35rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 999px;
        border: 1px solid transparent;
      }

      .activity-icon svg {
        height: 1.15rem;
        width: 1.15rem;
      }

      .activity-icon-buyin {
        border-color: #38bdf852;
        background: #0ea5e929;
        color: #7dd3fc;
      }

      .activity-icon-rebuy {
        background: #22c55e29;
        color: #4ade80;
      }

      .activity-icon-cashout {
        border-color: #fbbf2457;
        background: #f59e0b29;
        color: #fbbf24;
      }

      .activity-copy {
        display: grid;
        min-width: 0;
        margin-right: auto;
        gap: 0.1rem;
      }

      .activity-copy strong {
        color: white;
        font-size: 0.98rem;
        font-weight: 720;
      }

      .activity-copy small,
      .activity-meta small {
        overflow: hidden;
        color: rgb(161 161 170);
        font-size: 0.78rem;
        font-weight: 560;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .activity-meta {
        display: grid;
        justify-items: end;
        gap: 0.1rem;
        flex: 0 0 auto;
      }

      .activity-amount {
        color: white;
        font-size: 0.98rem;
        font-weight: 680;
      }

      .activity-amount {
        color: rgb(74 222 128);
      }

      .activity-empty,
      .player-empty-card p {
        margin: 0;
        color: rgb(161 161 170);
      }

      .player-session-grid {
        display: grid;
        gap: 0.75rem;
      }

      .session-tile {
        display: grid;
        gap: 0.9rem;
        padding: 1rem;
        text-decoration: none;
        transition: all 180ms ease;
      }

      .session-tile:hover {
        border-color: rgb(34 197 94 / 0.34);
        background: rgb(255 255 255 / 0.055);
        transform: translateY(-1px);
      }

      .session-tile-active {
        border-color: rgb(34 197 94 / 0.3);
        box-shadow: 0 0 24px rgb(34 197 94 / 0.08);
      }

      .session-tile-stats > div {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }

      .player-empty-card {
        text-align: center;
      }

      @media (min-width: 820px) {
        .player-dashboard {
          gap: 1.25rem;
        }

        .player-view-overview {
          grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
        }

        .player-session-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 560px) {
        .player-hero {
          align-items: stretch;
          padding: 0.8rem;
        }

        .player-chip {
          height: 3rem;
          width: 3rem;
        }

        .player-net {
          min-width: 5.9rem;
          padding: 0.6rem 0.65rem;
        }

        .player-net strong {
          font-size: 1.1rem;
        }

        .player-tab {
          min-height: 2.65rem;
        }

        .feature-heading {
          align-items: center;
        }

        .feature-heading h2,
        .panel-heading h2,
        .session-tile-top h2 {
          font-size: 1.08rem;
        }

        .player-metrics,
        .session-tile-stats {
          gap: 0.45rem;
        }

        .metric-card {
          padding: 0.62rem;
        }

        .metric-card span,
        .session-tile-stats span {
          font-size: 0.68rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .player-view,
        .activity-row {
          animation: none;
        }
      }

      @keyframes player-view-enter {
        from {
          opacity: 0;
          transform: translateY(0.25rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes activity-row-enter {
        from {
          opacity: 0;
          transform: translateY(0.35rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
  ]
})
export class PlayerDashboardPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  protected readonly store = inject(PokerStoreService);

  protected readonly tabs: Array<{ id: PlayerDashboardTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'calculator', label: 'Calculator' }
  ];
  protected readonly activeTab = signal<PlayerDashboardTab>('overview');
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly playerInitials = computed(() => {
    const words = this.playerName().trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');

    return initials || 'PT';
  });
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
  protected readonly featuredEntry = computed(() => this.activeEntries()[0] ?? this.entries()[0] ?? null);
  protected readonly playerSummary = computed(() => {
    const activeCount = this.activeEntries().length;
    const totalCount = this.entries().length;

    if (activeCount > 0) {
      return `${activeCount} active table${activeCount === 1 ? '' : 's'}`;
    }

    if (totalCount > 0) {
      return `${totalCount} session${totalCount === 1 ? '' : 's'}`;
    }

    return 'Ready for the next table';
  });
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
  protected readonly recentActivity = computed<PlayerActivityEntry[]>(() =>
    this.entries()
      .flatMap((entry) =>
        entry.transactions
          .filter((transaction) => !transaction.deletedAt)
          .map((transaction) => ({
            id: transaction.id,
            sessionId: entry.session.id,
            sessionName: entry.session.name,
            type: transaction.type,
            amount: transaction.amount,
            createdAt: transaction.createdAt
          }))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  );

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store surfaces the error in the page-level error block.
    }
  }

  protected selectTab(tab: PlayerDashboardTab): void {
    this.activeTab.set(tab);
  }

  protected statusLabel(entry: PlayerSessionEntry): string {
    return entry.player.status === 'ACTIVE' ? 'Active' : 'Closed';
  }

  protected activityLabel(type: PokerTransactionType): string {
    switch (type) {
      case 'BUYIN':
        return 'Buy-in';
      case 'REBUY':
        return 'Rebuy';
      case 'CASHOUT':
        return 'Cash out';
    }
  }
}
