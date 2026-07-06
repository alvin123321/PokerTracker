import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { PokerStoreService, ResolvedTimeCallStatus } from '../data/poker-store.service';

@Component({
  selector: 'app-session-overview-page',
  imports: [DatePipe],
  template: `
    <section class="session-overview-page space-y-5">
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

      @if (actionError() || store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ actionError() || store.error() }}
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
                  >
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle class="call-time-ring-track" cx="110" cy="110" r="92"></circle>
                      <circle
                        class="call-time-ring-progress"
                        [class.call-time-ring-progress-idle]="!activeCall"
                        cx="110"
                        cy="110"
                        r="92"
                        pathLength="1"
                        [attr.stroke-dashoffset]="activeCall ? 1 - store.timeCallProgressFor(activeCall) : 0.08"
                      ></circle>
                    </svg>
                    <div>
                      <strong>{{ activeCall ? store.secondsRemainingFor(activeCall) : 30 }}</strong>
                      <span>seconds</span>
                    </div>
                  </div>

                  @if (activeCall) {
                    <div class="session-overview-clock-copy">
                      <p>{{ store.playerNameForTimeCall(session, activeCall) }}</p>
                      <strong>Called Time</strong>
                      <span>
                        Calls left
                        {{ store.remainingTimeCallsForPlayer(session, activeCall.sessionPlayerId) }} / 3
                      </span>
                    </div>

                    <div class="session-overview-controls">
                      <button
                        type="button"
                        class="session-overview-action"
                        [disabled]="isResolving() || !store.timeCallSchemaReady()"
                        (click)="resolveTimeCall(activeCall.id, 'FINISHED')"
                      >
                        Finish
                      </button>
                      <button
                        type="button"
                        class="session-overview-action session-overview-action-muted"
                        [disabled]="isResolving() || !store.timeCallSchemaReady()"
                        (click)="resolveTimeCall(activeCall.id, 'CANCELLED')"
                      >
                        Cancel
                      </button>
                    </div>
                  } @else {
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
                      <div
                        class="session-overview-player"
                        [class.session-overview-player-calling]="activeCall?.sessionPlayerId === player.id"
                      >
                        <span class="session-overview-player-avatar" aria-hidden="true">
                          {{ initials(player.name) }}
                        </span>
                        <div class="min-w-0">
                          <p class="truncate">{{ player.name }}</p>
                          <span>Calls {{ store.remainingTimeCallsForPlayer(session, player.id) }} / 3</span>
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
export class SessionOverviewPage implements OnInit {
  protected readonly store = inject(PokerStoreService);
  protected readonly resolvingTimeCallId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store exposes the error state.
    }
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

  protected isResolving(): boolean {
    return Boolean(this.resolvingTimeCallId());
  }

  protected async resolveTimeCall(timeCallId: string, status: ResolvedTimeCallStatus): Promise<void> {
    if (this.resolvingTimeCallId()) {
      return;
    }

    this.resolvingTimeCallId.set(timeCallId);
    this.actionError.set(null);

    try {
      await this.store.resolveTimeCall(timeCallId, status);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Unable to update table clock.');
    } finally {
      this.resolvingTimeCallId.set(null);
    }
  }
}
