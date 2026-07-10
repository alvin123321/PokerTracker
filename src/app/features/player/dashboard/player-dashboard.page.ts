import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LucideArrowDownToLine,
  LucideBanknoteArrowDown,
  LucideCalculator,
  LucideBadgeCheck,
  LucideChevronRight,
  LucideCircleDollarSign,
  LucideCoins,
  LucideHistory,
  LucideHouse,
  LucideAlarmClock,
  LucideRefreshCcw,
  LucideUsersRound
} from '@lucide/angular';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PotCalculatorPage } from '../../host/tools/pot-calculator.page';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../../host/shared/confirmation-dialog.component';
import {
  CALL_TIME_LIMIT,
  CALL_TIME_DURATION_SECONDS,
  PokerSession,
  PokerStoreService,
  SessionPlayer,
  TimeCall,
  PokerTransaction,
  PokerTransactionType
} from '../../host/data/poker-store.service';
import {
  playerCallTimeDisplayState,
  playerGameTimeline,
  playerGameStatMode,
  playerGameStatusKind,
  totalActivePlayerChips,
  totalActivePlayers,
  PlayerCallTimeDisplayState,
  PlayerGameStatMode,
  PlayerGameStatusKind
} from './player-dashboard.logic';

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
    MatDialogModule,
    LucideArrowDownToLine,
    LucideBanknoteArrowDown,
    LucideBadgeCheck,
    LucideCalculator,
    LucideChevronRight,
    LucideCircleDollarSign,
    LucideCoins,
    LucideHistory,
    LucideHouse,
    LucideAlarmClock,
    LucideRefreshCcw,
    LucideUsersRound,
    RouterLink,
    PotCalculatorPage
  ],
  template: `
    <section class="player-dashboard">
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
            <span class="player-tab-label">{{ tab.label }}</span>
          </button>
        }
      </nav>

      @if (actionError() || store.error()) {
        <div class="player-alert player-alert-error">
          {{ actionError() || store.error() }}
        </div>
      }

      <div class="player-view-shell">
        @switch (activeTab()) {
          @case ('overview') {
            <section class="player-view player-view-overview">
              @if (featuredEntry(); as entry) {
                <article
                  class="player-feature-card"
                  [class.player-feature-card-active]="entry.player.status === 'ACTIVE'"
                  [class.player-feature-card-open]="isFeaturedExpanded(entry)"
                  [class.player-feature-card-time-starting]="store.isTimeCallStarting(store.activeTimeCallForSession(entry.session))"
                  [class.player-feature-card-time-running]="store.activeTimeCallForSession(entry.session) && !store.isTimeCallStarting(store.activeTimeCallForSession(entry.session))"
                  [attr.aria-expanded]="isFeaturedExpanded(entry)"
                  (click)="toggleFeaturedDetails(entry)"
                >
                  @let activeCall = store.activeTimeCallForSession(entry.session);
                  @let remainingCalls = store.remainingTimeCallsForPlayer(entry.session, entry.player.id);
                  @let isMyClock = store.isTimeCallRunningForPlayer(entry.session, entry.player.id);
                  @let callTimeState = callTimeDisplayState(entry, activeCall);
                  @let statMode = gameStatMode(entry);
                  <div class="feature-heading">
                    <div>
                      <div class="feature-title-row">
                        <h2>{{ entry.session.name }}</h2>
                        <span
                          class="game-status-pill"
                          [class.game-status-pill-active]="gameStatusKind(entry) === 'ACTIVE'"
                          [class.game-status-pill-completed]="gameStatusKind(entry) === 'COMPLETED'"
                        >
                          @if (gameStatusKind(entry) === 'ACTIVE') {
                            <span class="status-live-dot" aria-hidden="true"></span>
                          } @else {
                            <svg lucideBadgeCheck [strokeWidth]="2.6" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          }
                          {{ gameStatusKind(entry) === 'ACTIVE' ? 'Active' : 'Complete' }}
                        </span>
                      </div>
                    </div>
                    <div class="feature-heading-actions">
                      <a
                        [routerLink]="['/player/sessions', entry.session.id]"
                        class="feature-toggle-label"
                        aria-label="View game detail"
                        title="View game detail"
                        (click)="$event.stopPropagation()"
                      >
                        <svg lucideChevronRight [strokeWidth]="3" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                      </a>
                    </div>
                  </div>

                  @if (callTimeState !== 'NONE') {
                    <div class="player-call-time-stage" (click)="$event.stopPropagation()">
                      @if (callTimeState === 'CLOCK' && activeCall) {
                        <div class="player-call-time-live">
                          <div
                            class="call-time-mini-ring call-time-mini-ring-hero"
                            [class.call-time-mini-ring-active]="isMyClock"
                            [class.call-time-mini-ring-starting]="store.isTimeCallStarting(activeCall)"
                            [class.call-time-mini-ring-running]="!store.isTimeCallStarting(activeCall)"
                          >
                            <svg viewBox="0 0 44 44" aria-hidden="true">
                              <defs>
                                <linearGradient id="player-call-time-progress-gradient" x1="6" y1="6" x2="38" y2="38">
                                  <stop offset="0%" stop-color="rgb(187 247 208)"></stop>
                                  <stop offset="38%" stop-color="rgb(74 222 128)"></stop>
                                  <stop offset="72%" stop-color="rgb(34 197 94)"></stop>
                                  <stop offset="100%" stop-color="rgb(5 150 105)"></stop>
                                </linearGradient>
                              </defs>
                              <circle class="call-time-ring-track" cx="22" cy="22" r="18"></circle>
                              <circle
                                class="call-time-ring-progress-underlay"
                                cx="22"
                                cy="22"
                                r="18"
                                pathLength="1"
                                [attr.stroke-dashoffset]="1 - store.timeCallProgressFor(activeCall)"
                              ></circle>
                              <circle
                                class="call-time-ring-progress"
                                cx="22"
                                cy="22"
                                r="18"
                                pathLength="1"
                                [attr.stroke-dashoffset]="1 - store.timeCallProgressFor(activeCall)"
                              ></circle>
                            </svg>
                            <span>
                              {{
                                store.isTimeCallStarting(activeCall)
                                  ? store.timeCallStartsInSecondsFor(activeCall)
                                  : store.secondsRemainingFor(activeCall)
                              }}
                            </span>
                          </div>
                        </div>
                      } @else if (callTimeState === 'BUTTON') {
                        <button
                          type="button"
                          class="player-call-time-orb player-call-time-orb-hero"
                          [class.player-call-time-orb-loading]="isRequesting(entry.player.id)"
                          [disabled]="isRequesting(entry.player.id) || !store.canRequestTimeCall(entry.session, entry.player)"
                          aria-label="Call time"
                          title="Call time"
                          (click)="requestTimeCall(entry); $event.stopPropagation()"
                        >
                          <svg
                            lucideAlarmClock
                            [strokeWidth]="3"
                            [absoluteStrokeWidth]="true"
                            aria-hidden="true"
                          ></svg>
                          <strong>{{ remainingCalls }}/{{ callTimeLimit }}</strong>
                        </button>
                      }
                    </div>
                  }

                  @if (!store.timeCallSchemaReady()) {
                    <p class="player-clock-warning">Clock setup needed</p>
                  }

                  <div class="player-metrics">
                    <div class="metric-card metric-buyin">
                      <span class="metric-label">
                        <svg lucideCircleDollarSign [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                        Total buy in
                      </span>
                      <strong>{{ entry.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                    </div>
                    <div class="metric-card" [class.metric-active-players]="statMode === 'ACTIVE_GAME'" [class.metric-cashout]="statMode === 'COMPLETED_GAME'">
                      <span class="metric-label">
                        @if (statMode === 'ACTIVE_GAME') {
                          <svg lucideUsersRound [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Active players
                        } @else {
                          <svg lucideBanknoteArrowDown [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Cashed out
                        }
                      </span>
                      <strong>
                        @if (statMode === 'ACTIVE_GAME') {
                          {{ activePlayerCount(entry.session) }}
                        } @else {
                          {{ entry.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                        }
                      </strong>
                    </div>
                    <div
                      class="metric-card"
                      [class.metric-total-chips]="statMode === 'ACTIVE_GAME'"
                      [class.metric-net-positive]="statMode === 'COMPLETED_GAME' && entry.player.net >= 0"
                      [class.metric-net-negative]="statMode === 'COMPLETED_GAME' && entry.player.net < 0"
                    >
                      <span class="metric-label">
                        @if (statMode === 'ACTIVE_GAME') {
                          <svg lucideCoins [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Player chips
                        } @else {
                          <svg lucideBadgeCheck [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Net
                        }
                      </span>
                      <strong>
                        @if (statMode === 'ACTIVE_GAME') {
                          {{ activePlayerChips(entry.session) | currency: 'USD' : 'symbol' : '1.0-0' }}
                        } @else {
                          {{ entry.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                        }
                      </strong>
                    </div>
                  </div>

                  <div class="feature-detail-panel" [attr.aria-hidden]="!isFeaturedExpanded(entry)">
                    <div class="feature-detail-panel-inner">
                      <div class="feature-detail-heading">
                        <span>Game timeline</span>
                      </div>
                      <div class="feature-buyin-list">
                        @for (transaction of gameTimelineRows(entry); track transaction.id) {
                          <div
                            class="feature-buyin-row"
                            [class.feature-buyin-row-buyin]="transaction.type === 'BUYIN'"
                            [class.feature-buyin-row-rebuy]="transaction.type === 'REBUY'"
                            [class.feature-buyin-row-cashout]="transaction.type === 'CASHOUT'"
                          >
                            <span class="feature-buyin-type">{{ activityLabel(transaction.type) }}</span>
                            <span class="feature-buyin-time">{{ transaction.createdAt | date: 'shortTime' }}</span>
                            <strong>{{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                          </div>
                        } @empty {
                          <p class="activity-empty">No game timeline yet.</p>
                        }
                      </div>
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
                        <span
                          class="activity-amount"
                          [class.activity-amount-buyin]="activity.type === 'BUYIN'"
                          [class.activity-amount-rebuy]="activity.type === 'REBUY'"
                          [class.activity-amount-cashout]="activity.type === 'CASHOUT'"
                        >
                          {{ activity.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
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
                    <span
                      class="game-status-pill"
                      [class.game-status-pill-active]="gameStatusKind(entry) === 'ACTIVE'"
                      [class.game-status-pill-completed]="gameStatusKind(entry) === 'COMPLETED'"
                    >
                      @if (gameStatusKind(entry) === 'ACTIVE') {
                        <span class="status-live-dot" aria-hidden="true"></span>
                      } @else {
                        <svg lucideBadgeCheck [strokeWidth]="2.5" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                      }
                      {{ gameStatusKind(entry) === 'ACTIVE' ? 'Active' : 'Complete' }}
                    </span>
                  </div>

                  <div class="session-tile-stats">
                    @let statMode = gameStatMode(entry);
                    <div class="session-stat session-stat-buyin">
                      <span class="metric-label">
                        <svg lucideCircleDollarSign [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                        Total buy in
                      </span>
                      <strong>{{ entry.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                    </div>
                    <div class="session-stat" [class.session-stat-active]="statMode === 'ACTIVE_GAME'" [class.session-stat-cashout]="statMode === 'COMPLETED_GAME'">
                      <span class="metric-label">
                        @if (statMode === 'ACTIVE_GAME') {
                          <svg lucideUsersRound [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Active
                        } @else {
                          <svg lucideBanknoteArrowDown [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Cashed out
                        }
                      </span>
                      <strong>
                        @if (statMode === 'ACTIVE_GAME') {
                          {{ activePlayerCount(entry.session) }}
                        } @else {
                          {{ entry.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                        }
                      </strong>
                    </div>
                    <div
                      class="session-stat"
                      [class.session-stat-chips]="statMode === 'ACTIVE_GAME'"
                      [class.session-stat-net-positive]="statMode === 'COMPLETED_GAME' && entry.player.net >= 0"
                      [class.session-stat-net-negative]="statMode === 'COMPLETED_GAME' && entry.player.net < 0"
                    >
                      <span class="metric-label">
                        @if (statMode === 'ACTIVE_GAME') {
                          <svg lucideCoins [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Chips
                        } @else {
                          <svg lucideBadgeCheck [strokeWidth]="2.8" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                          Net
                        }
                      </span>
                      <strong [class.positive]="entry.player.net >= 0" [class.negative]="entry.player.net < 0">
                        @if (statMode === 'ACTIVE_GAME') {
                          {{ activePlayerChips(entry.session) | currency: 'USD' : 'symbol' : '1.0-0' }}
                        } @else {
                          {{ entry.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
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

      .panel-heading span,
      .session-tile-top p,
      .activity-copy small {
        color: rgb(161 161 170);
        font-size: 0.9rem;
      }

      .metric-card span,
      .session-tile-stats span {
        color: rgb(161 161 170);
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0;
        text-transform: none;
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

      .player-tab-label {
        display: none;
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

        .player-tab {
          min-height: 2.8rem;
          padding: 0 1rem;
          font-size: 0.96rem;
          font-weight: 760;
        }

        .player-tabs .pokertrack-nav-icon {
          display: none;
        }

        .player-tab-label {
          display: inline;
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
        isolation: isolate;
        overflow: hidden;
        padding: 1rem;
        position: relative;
        cursor: pointer;
        transition: all 190ms ease;
      }

      .player-feature-card > * {
        position: relative;
        z-index: 1;
      }

      .player-feature-card-time-starting,
      .player-feature-card-time-running {
        border-color: rgb(52 211 153 / 0.62);
        box-shadow:
          inset 0 1px 0 rgb(255 255 255 / 0.07),
          0 20px 52px rgb(0 0 0 / 0.3),
          0 0 42px rgb(34 197 94 / 0.2);
      }

      .player-feature-card-time-starting {
        animation: calltime-card-sync-glow 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
      }

      .player-feature-card-time-running {
        animation: calltime-card-running-glow 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
      }

      .feature-heading,
      .session-tile-top,
      .activity-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
      }

      .game-status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 999px;
        color: rgb(212 212 216);
        flex: 0 0 auto;
        font-size: 0.74rem;
        font-weight: 850;
        padding: 0.32rem 0.58rem;
      }

      .game-status-pill svg {
        width: 0.88rem;
        height: 0.88rem;
      }

      .game-status-pill-active {
        border-color: rgb(34 197 94 / 0.46);
        background: rgb(34 197 94 / 0.1);
        color: rgb(74 222 128);
      }

      .game-status-pill-completed {
        border-color: rgb(74 222 128 / 0.28);
        background: rgb(20 83 45 / 0.16);
        color: rgb(187 247 208);
      }

      .status-live-dot {
        width: 0.46rem;
        height: 0.46rem;
        border-radius: 999px;
        background: rgb(34 197 94);
      }

      .feature-title-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .feature-heading {
        align-items: flex-end;
      }

      .feature-heading-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex: 0 0 auto;
      }

      .player-clock-warning {
        margin: 0;
        border-radius: 0.85rem;
        padding: 0.65rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 760;
      }

      .player-clock-warning {
        border: 1px solid rgb(245 158 11 / 0.2);
        background: rgb(245 158 11 / 0.09);
        color: rgb(254 243 199);
      }

      .player-feature-card:hover {
        border-color: rgb(34 197 94 / 0.34);
        transform: translateY(-1px);
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

      .feature-toggle-label {
        display: inline-grid;
        place-items: center;
        width: 1.8rem;
        height: 1.8rem;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: rgb(212 212 216);
        flex: 0 0 auto;
        padding: 0;
        text-decoration: none;
        transition: all 180ms ease;
      }

      .feature-toggle-label svg {
        width: 1rem;
        height: 1rem;
      }

      .feature-toggle-label:hover {
        color: rgb(134 239 172);
      }

      .player-feature-card-open .feature-toggle-label {
        color: rgb(134 239 172);
        transform: rotate(90deg);
      }

      .feature-detail-panel {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transform: translateY(-0.25rem);
        transition: all 420ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .player-feature-card-open .feature-detail-panel {
        grid-template-rows: 1fr;
        opacity: 1;
        transform: translateY(0);
      }

      .feature-detail-panel-inner {
        min-height: 0;
        overflow: hidden;
      }

      .feature-detail-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid rgb(255 255 255 / 0.09);
        padding-top: 0.9rem;
      }

      .feature-buyin-list {
        display: grid;
        gap: 0.48rem;
        margin-top: 0.65rem;
      }

      .feature-buyin-row {
        display: grid;
        grid-template-columns: minmax(4.9rem, 0.8fr) minmax(4.2rem, 0.7fr) minmax(4rem, 0.65fr);
        align-items: center;
        gap: 0.55rem;
        border: 1px solid rgb(34 197 94 / 0.26);
        border-radius: 0.78rem;
        background: rgb(34 197 94 / 0.11);
        padding: 0.64rem 0.7rem;
      }

      .feature-buyin-row-buyin {
        border-color: rgb(34 197 94 / 0.28);
        background: rgb(34 197 94 / 0.1);
      }

      .feature-buyin-row-rebuy {
        border-color: rgb(56 189 248 / 0.26);
        background: rgb(14 165 233 / 0.11);
      }

      .feature-buyin-row-cashout {
        border-color: rgb(251 191 36 / 0.3);
        background: rgb(245 158 11 / 0.12);
      }

      .feature-buyin-type {
        color: rgb(134 239 172);
        font-size: 0.78rem;
        font-weight: 820;
      }

      .feature-buyin-row-rebuy .feature-buyin-type {
        color: rgb(186 230 253);
      }

      .feature-buyin-row-cashout .feature-buyin-type {
        color: rgb(253 230 138);
      }

      .feature-buyin-time {
        color: rgb(161 161 170);
        font-size: 0.78rem;
        text-align: center;
      }

      .feature-buyin-row strong {
        text-align: right;
      }

      .player-metrics,
      .session-tile-stats {
        display: grid;
        align-items: start;
        gap: 0.42rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .metric-card {
        display: grid;
        justify-items: center;
        gap: 0.28rem;
        min-width: 0;
        padding: 0.15rem 0.1rem;
        text-align: center;
      }

      .metric-card:first-child,
      .session-tile-stats > div:first-child {
        justify-items: start;
        text-align: left;
      }

      .metric-card:last-child,
      .session-tile-stats > div:last-child {
        justify-items: end;
        text-align: right;
      }

      .metric-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.22rem;
        max-width: 100%;
        white-space: nowrap;
      }

      .metric-label svg {
        width: 0.82rem;
        height: 0.82rem;
        flex: 0 0 auto;
      }

      .metric-card strong,
      .session-tile-stats strong {
        overflow: hidden;
        color: white;
        font-size: 1.16rem;
        font-weight: 560;
        line-height: 1.05;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .metric-buyin strong {
        color: rgb(125 211 252);
      }

      .metric-buyin .metric-label {
        color: rgb(125 211 252);
      }

      .metric-active-players .metric-label {
        color: rgb(110 231 183);
      }

      .metric-active-players strong {
        color: rgb(74 222 128);
      }

      .metric-cashout .metric-label,
      .metric-cashout strong {
        color: rgb(251 191 36);
      }

      .metric-total-chips .metric-label,
      .metric-total-chips strong {
        color: rgb(125 211 252);
      }

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

      .metric-net-positive {
        color: rgb(74 222 128);
      }

      .metric-net-positive .metric-label {
        color: rgb(134 239 172);
      }

      .metric-net-negative .metric-label {
        color: rgb(252 165 165);
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
        border-color: #22c55e57;
        background: #22c55e24;
        color: #4ade80;
      }

      .activity-icon-rebuy {
        border-color: #38bdf852;
        background: #0ea5e929;
        color: #7dd3fc;
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

      .activity-amount-buyin {
        color: rgb(74 222 128);
      }

      .activity-amount-rebuy {
        color: rgb(125 211 252);
      }

      .activity-amount-cashout {
        color: rgb(251 191 36);
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
        gap: 0.72rem;
        padding: 0.95rem 1rem;
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
        justify-items: center;
        gap: 0.28rem;
        min-width: 0;
        text-align: center;
      }

      .session-stat {
        padding: 0.1rem 0;
      }

      .session-stat-buyin .metric-label,
      .session-stat-buyin strong {
        color: rgb(125 211 252);
      }

      .session-stat-active .metric-label,
      .session-stat-active strong {
        color: rgb(110 231 183);
      }

      .session-stat-chips .metric-label,
      .session-stat-chips strong {
        color: rgb(125 211 252);
      }

      .session-stat-cashout .metric-label,
      .session-stat-cashout strong {
        color: rgb(251 191 36);
      }

      .session-stat-net-positive .metric-label {
        color: rgb(134 239 172);
      }

      .session-stat-net-negative .metric-label {
        color: rgb(252 165 165);
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
          gap: 0.28rem;
        }

        .metric-card span,
        .session-tile-stats span {
          font-size: 0.64rem;
        }

      }

      @media (prefers-reduced-motion: reduce) {
        .player-view,
        .activity-row,
        .player-feature-card-time-starting,
        .player-feature-card-time-running,
        .player-feature-card-time-starting::before,
        .player-feature-card-time-running::before {
          animation: none;
        }

        .player-feature-card,
        .feature-detail-panel {
          transition: none;
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

      @keyframes calltime-card-sync-glow {
        from {
          border-color: rgb(52 211 153 / 0.42);
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.05),
            0 18px 46px rgb(0 0 0 / 0.28),
            0 0 18px rgb(34 197 94 / 0.08);
        }

        to {
          border-color: rgb(187 247 208 / 0.76);
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.08),
            0 20px 52px rgb(0 0 0 / 0.32),
            0 0 34px rgb(34 197 94 / 0.18);
        }
      }

      @keyframes calltime-card-running-glow {
        from {
          border-color: rgb(52 211 153 / 0.34);
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.05),
            0 18px 46px rgb(0 0 0 / 0.28),
            0 0 14px rgb(34 197 94 / 0.06);
        }

        to {
          border-color: rgb(52 211 153 / 0.58);
          box-shadow:
            inset 0 1px 0 rgb(255 255 255 / 0.07),
            0 20px 50px rgb(0 0 0 / 0.3),
            0 0 24px rgb(34 197 94 / 0.12);
        }
      }

    `
  ]
})
export class PlayerDashboardPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  protected readonly store = inject(PokerStoreService);
  protected readonly callTimeLimit = CALL_TIME_LIMIT;
  protected readonly pendingTimeCallPlayerId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly tabs: Array<{ id: PlayerDashboardTab; label: string }> = [
    { id: 'calculator', label: 'Calculator' },
    { id: 'overview', label: 'Home' },
    { id: 'sessions', label: 'History' }
  ];
  protected readonly activeTab = signal<PlayerDashboardTab>('overview');
  protected readonly expandedFeatureKey = signal<string | null>(null);
  protected readonly playerName = computed(() => this.authState.profile()?.displayName ?? 'Player');
  protected readonly entries = computed<PlayerSessionEntry[]>(() => {
    const userId = this.authState.user()?.id ?? null;
    const targetName = this.playerName().trim().toLowerCase();

    return this.store
      .sessions()
      .flatMap((session) =>
        session.players
          .filter((player) => this.playerMatchesLogin(player, userId, targetName))
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
    this.applyInitialTab();

    try {
      await this.store.refreshSessions();
    } catch {
      // The store surfaces the error in the page-level error block.
    }
  }

  protected selectTab(tab: PlayerDashboardTab): void {
    this.activeTab.set(tab);
  }

  protected callTimeDisplayState(
    entry: PlayerSessionEntry,
    activeCall: TimeCall | undefined
  ): PlayerCallTimeDisplayState {
    return playerCallTimeDisplayState(entry.session, entry.player, activeCall);
  }

  private playerMatchesLogin(player: SessionPlayer, userId: string | null, targetName: string): boolean {
    if (player.userId) {
      return player.userId === userId;
    }

    return player.name.trim().toLowerCase() === targetName;
  }

  private applyInitialTab(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');

    if (tab === 'history' || tab === 'sessions') {
      this.activeTab.set('sessions');
      return;
    }

    if (tab === 'calculator') {
      this.activeTab.set('calculator');
    }
  }

  protected isFeaturedExpanded(entry: PlayerSessionEntry): boolean {
    return this.expandedFeatureKey() === this.entryKey(entry);
  }

  protected toggleFeaturedDetails(entry: PlayerSessionEntry): void {
    const key = this.entryKey(entry);
    this.expandedFeatureKey.set(this.expandedFeatureKey() === key ? null : key);
  }

  protected isRequesting(sessionPlayerId: string): boolean {
    return this.pendingTimeCallPlayerId() === sessionPlayerId;
  }

  protected async requestTimeCall(entry: PlayerSessionEntry): Promise<void> {
    if (this.pendingTimeCallPlayerId()) {
      return;
    }

    const confirmed = await this.confirmTimeCall(entry);

    if (!confirmed) {
      return;
    }

    this.actionError.set(null);
    this.pendingTimeCallPlayerId.set(entry.player.id);

    try {
      await this.store.requestTimeCall(entry.session.id, entry.player.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to call time.';
      this.actionError.set(message);
    } finally {
      this.pendingTimeCallPlayerId.set(null);
    }
  }

  private async confirmTimeCall(entry: PlayerSessionEntry): Promise<boolean> {
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        data: {
          title: 'Call time?',
          message: `Start a ${CALL_TIME_DURATION_SECONDS} second clock for ${entry.session.name}.`,
          confirmLabel: 'Start Clock',
          cancelLabel: 'Cancel',
          tone: 'primary',
          details: [
            `You have ${this.store.remainingTimeCallsForPlayer(entry.session, entry.player.id)} of ${this.callTimeLimit} calls left.`
          ]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    return Boolean(await firstValueFrom(dialogRef.afterClosed()));
  }

  protected gameTimelineRows(entry: PlayerSessionEntry): PokerTransaction[] {
    return playerGameTimeline(entry.transactions);
  }

  protected gameStatusKind(entry: PlayerSessionEntry): PlayerGameStatusKind {
    return playerGameStatusKind(entry.session, entry.player);
  }

  protected gameStatMode(entry: PlayerSessionEntry): PlayerGameStatMode {
    return playerGameStatMode(entry.session, entry.player);
  }

  protected activePlayerCount(session: PokerSession): number {
    return totalActivePlayers(session);
  }

  protected activePlayerChips(session: PokerSession): number {
    return totalActivePlayerChips(session);
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

  private entryKey(entry: PlayerSessionEntry): string {
    return `${entry.session.id}:${entry.player.id}`;
  }
}
