import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';

import {
  CALL_TIME_DURATION_SECONDS,
  PokerStoreService,
  TimeCall
} from '../data/poker-store.service';
import { sessionOverviewRefreshIntervalMs } from '../data/realtime.logic';

@Component({
  selector: 'app-session-overview-page',
  imports: [DatePipe],
  template: `
    <section
      class="session-overview-page space-y-5"
      [class.session-overview-page-ready]="overviewReady()"
    >
      @if (overviewLoaderVisible()) {
        <section
          class="session-overview-loader"
          [class.session-overview-loader-exit]="overviewLoaderLeaving()"
          aria-live="polite"
        >
          <div class="overview-deck-shuffle" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Loading sessions</p>
        </section>
      }

      <header class="session-overview-hero">
        <div class="session-overview-hero-copy">
          <p>Shared screen</p>
          <h1>Session Overview</h1>
        </div>
        <div class="session-overview-hero-meter" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </header>

      @if (!store.timeCallSchemaReady()) {
        <div class="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-semibold text-amber-100">
          Call Time database setup is missing. Apply the call-time migration, then refresh.
        </div>
      }

      @if (store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ store.error() }}
        </div>
      }

      @if (store.activeSessions().length > 0) {
        <div class="grid gap-5">
          @for (session of store.activeSessions(); track session.id) {
            @let totals = store.totalsFor(session);
            @let activeCall = store.activeTimeCallForSession(session);
            <section
              class="session-overview-table-card"
              [class.session-overview-table-card-live]="activeCall"
            >
              <div class="session-overview-table-header">
                <div class="session-overview-table-title">
                  <span class="session-overview-table-token" aria-hidden="true">&spades;</span>
                  <div class="min-w-0">
                    <h2>{{ session.name }}</h2>
                    <p>{{ session.sessionDate | date: 'fullDate' }}</p>
                  </div>
                </div>

                <div class="session-overview-table-stats">
                  <div class="session-overview-stat">
                    <span>Active</span>
                    <strong>{{ totals.activePlayers }}</strong>
                  </div>
                  <div class="session-overview-stat">
                    <span>Cashed Out</span>
                    <strong>{{ totals.cashedOutPlayers }}</strong>
                  </div>
                </div>
              </div>

              <div class="session-overview-table-layout">
                <div class="session-overview-clock-panel">
                  <div
                    class="call-time-stage-ring"
                    [class.call-time-stage-ring-active]="activeCall"
                    [class.call-time-stage-ring-starting]="activeCall && store.isTimeCallStarting(activeCall)"
                    [class.call-time-stage-ring-running]="activeCall && !store.isTimeCallStarting(activeCall)"
                    [style.--clock-elapsed-angle]="clockElapsedAngle(activeCall)"
                  >
                    <div class="call-time-ring-visual" aria-hidden="true">
                      <span class="call-time-ring-sweep"></span>
                    </div>
                    <div class="call-time-ring-face">
                      @if (activeCall && store.isTimeCallStarting(activeCall)) {
                        <strong>{{ store.timeCallStartsInSecondsFor(activeCall) }}</strong>
                      } @else if (activeCall) {
                        <strong>{{ store.secondsRemainingFor(activeCall) }}</strong>
                      } @else {
                        <strong>{{ callTimeDuration }}</strong>
                        <span>seconds</span>
                      }
                    </div>
                  </div>

                  @if (!activeCall) {
                    <div class="session-overview-clock-copy">
                      <p>Ready</p>
                      <strong>No active clock</strong>
                      <span>Waiting for a player call time.</span>
                    </div>
                  }
                </div>

                <aside class="session-overview-roster">
                  <div class="session-overview-roster-header">
                    <h3>Players</h3>
                    <span>{{ totals.totalPlayers }} seats</span>
                  </div>

                  <div class="grid gap-2.5">
                    @for (player of store.sortedPlayersForActiveSession(session); track player.id) {
                      <div class="session-overview-player">
                        <span class="session-overview-player-avatar" aria-hidden="true">
                          {{ initials(player.name) }}
                        </span>
                        <div class="min-w-0">
                          <p class="truncate">{{ player.name }}</p>
                        </div>
                        <strong
                          [class.text-emerald-300]="player.status === 'ACTIVE'"
                          [class.text-neutral-500]="player.status === 'COMPLETED'"
                        >
                          {{ player.status === 'ACTIVE' ? 'Active' : 'Cashed Out' }}
                        </strong>
                      </div>
                    } @empty {
                      <div class="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">
                        No players added yet.
                      </div>
                    }
                  </div>
                </aside>
              </div>
            </section>
          }
        </div>
      } @else {
        <section class="session-overview-empty">
          <h1>No active session</h1>
          <p>Start a table to use the shared overview screen.</p>
        </section>
      }
    </section>
  `
})
export class SessionOverviewPage implements OnInit, OnDestroy {
  protected readonly store = inject(PokerStoreService);
  protected readonly callTimeDuration = CALL_TIME_DURATION_SECONDS;
  protected readonly overviewReady = signal(false);
  protected readonly overviewLoaderVisible = signal(true);
  protected readonly overviewLoaderLeaving = signal(false);
  private overviewRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private overviewLoaderTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    this.startOverviewRefresh();

    await this.refreshOverviewSessions();
    this.revealOverview();
  }

  ngOnDestroy(): void {
    if (this.overviewRefreshTimer) {
      clearInterval(this.overviewRefreshTimer);
      this.overviewRefreshTimer = null;
    }

    if (this.overviewLoaderTimer) {
      clearTimeout(this.overviewLoaderTimer);
      this.overviewLoaderTimer = null;
    }
  }

  private startOverviewRefresh(): void {
    if (typeof window === 'undefined' || this.overviewRefreshTimer) {
      return;
    }

    this.overviewRefreshTimer = window.setInterval(() => {
      void this.refreshOverviewSessions();
    }, sessionOverviewRefreshIntervalMs);
  }

  private async refreshOverviewSessions(): Promise<void> {
    try {
      await this.store.refreshSessions({ showLoading: false });
    } catch {
      // The store exposes the error state.
    }
  }

  private revealOverview(): void {
    this.overviewReady.set(true);
    this.overviewLoaderLeaving.set(true);

    if (typeof window === 'undefined') {
      this.overviewLoaderVisible.set(false);
      return;
    }

    if (this.overviewLoaderTimer) {
      clearTimeout(this.overviewLoaderTimer);
    }

    this.overviewLoaderTimer = window.setTimeout(() => {
      this.overviewLoaderVisible.set(false);
      this.overviewLoaderTimer = null;
    }, 420);
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return '?';
    }

    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected clockElapsedAngle(timeCall: TimeCall | undefined): string {
    const elapsed = timeCall ? 1 - this.store.timeCallProgressFor(timeCall) : 0;

    return `${Math.max(0, Math.min(1, elapsed)) * 360}deg`;
  }

}
