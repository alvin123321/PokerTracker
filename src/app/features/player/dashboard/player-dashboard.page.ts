import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  imports: [CurrencyPipe, DatePipe, RouterLink, PotCalculatorPage],
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
            [attr.aria-selected]="activeTab() === tab.id"
            (click)="selectTab(tab.id)"
          >
            <span class="player-tab-icon" aria-hidden="true">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
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
                      <span class="activity-icon" [class.activity-icon-cashout]="activity.type === 'CASHOUT'">
                        {{ activityIcon(activity.type) }}
                      </span>
                      <span class="activity-copy">
                        <strong>{{ activityLabel(activity.type) }}</strong>
                        <small>{{ activity.sessionName }}</small>
                      </span>
                      <span class="activity-amount">{{ activity.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
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
        animation: player-page-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
        box-shadow:
          0 18px 48px rgb(0 0 0 / 0.28),
          inset 0 1px 0 rgb(255 255 255 / 0.06);
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
        box-shadow: 0 0 28px rgb(34 197 94 / 0.22);
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
        font-size: clamp(1.55rem, 8vw, 2.45rem);
        font-weight: 850;
        letter-spacing: 0;
        line-height: 1;
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
        min-width: 7.3rem;
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
        font-size: 0.76rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .player-net strong {
        font-size: 1.45rem;
        font-weight: 750;
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
        gap: 0.5rem;
        border: 1px solid rgb(255 255 255 / 0.09);
        border-radius: 999px;
        background: rgb(0 0 0 / 0.24);
        padding: 0.35rem;
      }

      .player-tab {
        display: inline-flex;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        border: 1px solid transparent;
        border-radius: 999px;
        color: rgb(212 212 216);
        font-size: 0.9rem;
        font-weight: 760;
        transition:
          border-color 190ms ease,
          background-color 190ms ease,
          color 190ms ease,
          box-shadow 190ms ease,
          transform 190ms ease;
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

      .player-tab-icon {
        display: inline-grid;
        height: 1.55rem;
        width: 1.55rem;
        place-items: center;
        border-radius: 999px;
        background: rgb(255 255 255 / 0.08);
        font-size: 0.78rem;
        font-weight: 900;
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
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
      }

      .player-feature-card {
        display: grid;
        gap: 1rem;
        overflow: hidden;
        padding: 1rem;
        position: relative;
      }

      .player-feature-card::before {
        background: linear-gradient(90deg, rgb(34 197 94), transparent);
        content: '';
        height: 2px;
        inset: 0 0 auto 0;
        opacity: 0.55;
        position: absolute;
      }

      .player-feature-card-active {
        border-color: rgb(34 197 94 / 0.32);
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
        font-weight: 820;
        line-height: 1.1;
      }

      .feature-link {
        border: 1px solid rgb(34 197 94 / 0.42);
        border-radius: 999px;
        background: rgb(34 197 94 / 0.14);
        color: rgb(220 252 231);
        flex: 0 0 auto;
        font-size: 0.86rem;
        font-weight: 800;
        padding: 0.62rem 0.86rem;
        text-decoration: none;
        transition:
          background-color 180ms ease,
          border-color 180ms ease,
          transform 180ms ease;
      }

      .feature-link:hover {
        border-color: rgb(34 197 94 / 0.7);
        background: rgb(34 197 94 / 0.22);
        transform: translateY(-1px);
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
        font-size: clamp(1rem, 4.5vw, 1.42rem);
        font-weight: 760;
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
        border: 1px solid rgb(255 255 255 / 0.08);
        border-radius: 0.85rem;
        background: rgb(0 0 0 / 0.22);
        color: white;
        padding: 0.72rem;
        text-decoration: none;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          transform 180ms ease;
      }

      .activity-row:hover {
        border-color: rgb(34 197 94 / 0.34);
        background: rgb(255 255 255 / 0.055);
        transform: translateY(-1px);
      }

      .activity-icon {
        display: grid;
        height: 2.15rem;
        width: 2.15rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 999px;
        background: rgb(34 197 94 / 0.16);
        color: rgb(74 222 128);
        font-size: 0.82rem;
        font-weight: 900;
      }

      .activity-icon-cashout {
        background: rgb(245 158 11 / 0.16);
        color: rgb(251 191 36);
      }

      .activity-copy {
        display: grid;
        min-width: 0;
        margin-right: auto;
      }

      .activity-copy strong,
      .activity-amount {
        color: white;
        font-size: 0.95rem;
        font-weight: 760;
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
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
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

        .player-feature-card,
        .player-ledger-panel,
        .calculator-player-panel,
        .player-empty-card,
        .session-tile {
          border-radius: 1.15rem;
          padding: 1.25rem;
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
          gap: 0.28rem;
          min-height: 2.55rem;
          font-size: 0.78rem;
        }

        .player-tab-icon {
          height: 1.32rem;
          width: 1.32rem;
          font-size: 0.68rem;
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

      @media (max-width: 360px) {
        .player-identity {
          gap: 0.65rem;
        }

        .player-chip {
          height: 2.7rem;
          width: 2.7rem;
          font-size: 0.96rem;
        }

        .player-identity-copy p {
          display: none;
        }

        .player-net {
          min-width: 5.1rem;
        }

        .player-tab span:last-child {
          font-size: 0.72rem;
        }
      }

      @keyframes player-page-enter {
        from {
          opacity: 0;
          transform: translateY(0.45rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
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
    `
  ]
})
export class PlayerDashboardPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  protected readonly store = inject(PokerStoreService);

  protected readonly tabs: Array<{ id: PlayerDashboardTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'OV' },
    { id: 'sessions', label: 'Sessions', icon: 'SE' },
    { id: 'calculator', label: 'Calc', icon: '$' }
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

  protected activityIcon(type: PokerTransactionType): string {
    switch (type) {
      case 'BUYIN':
        return 'BI';
      case 'REBUY':
        return 'RB';
      case 'CASHOUT':
        return 'CO';
    }
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
