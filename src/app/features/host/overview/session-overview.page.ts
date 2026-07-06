import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import {
  PokerSession,
  PokerStoreService,
  ResolvedTimeCallStatus
} from '../data/poker-store.service';

const selectedSessionStorageKey = 'pokertrack.sessionOverview.selectedSessionId';

@Component({
  selector: 'app-session-overview-page',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <section class="session-overview-page space-y-4">
      <header class="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Live table</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-4xl">Session Overview</h1>
        </div>

        @if (store.activeSessions().length > 1) {
          <label class="grid gap-1.5 text-sm text-neutral-400">
            <span>Table</span>
            <select
              class="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-300"
              [value]="selectedSession()?.id ?? ''"
              (change)="selectSession($any($event.target).value)"
            >
              @for (session of store.activeSessions(); track session.id) {
                <option [value]="session.id">{{ session.name }}</option>
              }
            </select>
          </label>
        }
      </header>

      @if (actionError() || store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ actionError() || store.error() }}
        </div>
      }

      @if (selectedSession(); as session) {
        @let totals = store.totalsFor(session);
        @let activeCall = store.activeTimeCallForSession(session);
        <section class="session-overview-stage rounded-2xl border border-emerald-300/15 bg-neutral-950/80 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:p-6">
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div class="grid min-h-[28rem] gap-5">
              <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h2 class="text-3xl font-semibold text-white sm:text-5xl">{{ session.name }}</h2>
                  <p class="mt-2 text-sm text-neutral-400 sm:text-base">
                    {{ session.sessionDate | date: 'fullDate' }}
                  </p>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="session-overview-stat">
                    <span>Players</span>
                    <strong>{{ totals.totalPlayers }}</strong>
                  </div>
                  <div class="session-overview-stat">
                    <span>Cashed</span>
                    <strong>{{ totals.cashedOutPlayers }}</strong>
                  </div>
                  <div class="session-overview-stat">
                    <span>Buy-in</span>
                    <strong>{{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                  </div>
                </div>
              </div>

              <div class="session-overview-clock-panel">
                @if (activeCall) {
                  <div class="call-time-stage-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle class="call-time-ring-track" cx="110" cy="110" r="92"></circle>
                      <circle
                        class="call-time-ring-progress"
                        cx="110"
                        cy="110"
                        r="92"
                        pathLength="1"
                        [attr.stroke-dashoffset]="1 - store.timeCallProgressFor(activeCall)"
                      ></circle>
                    </svg>
                    <div>
                      <strong>{{ store.secondsRemainingFor(activeCall) }}</strong>
                      <span>seconds</span>
                    </div>
                  </div>

                  <div class="text-center">
                    <p class="text-2xl font-semibold text-white sm:text-4xl">
                      {{ store.playerNameForTimeCall(session, activeCall) }} Called Time
                    </p>
                    <p class="mt-2 text-sm text-neutral-400">
                      Remaining calls:
                      {{ store.remainingTimeCallsForPlayer(session, activeCall.sessionPlayerId) }} / 3
                    </p>
                    <div class="mt-5 flex justify-center gap-3">
                      <button
                        type="button"
                        class="session-overview-action"
                        [disabled]="isResolving()"
                        (click)="resolveTimeCall(activeCall.id, 'FINISHED')"
                      >
                        Finish
                      </button>
                      <button
                        type="button"
                        class="session-overview-action session-overview-action-muted"
                        [disabled]="isResolving()"
                        (click)="resolveTimeCall(activeCall.id, 'CANCELLED')"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="text-center">
                    <div class="session-overview-idle-clock" aria-hidden="true">30</div>
                    <p class="mt-5 text-2xl font-semibold text-white">No active clock</p>
                    <p class="mt-2 text-sm text-neutral-400">Player call-time requests will appear here.</p>
                  </div>
                }
              </div>
            </div>

            <aside class="rounded-xl border border-white/10 bg-black/20 p-4">
              <div class="mb-4 flex items-center justify-between gap-3">
                <h3 class="text-lg font-semibold text-white">Players</h3>
                <span class="text-sm text-neutral-500">{{ totals.activePlayers }} active</span>
              </div>

              <div class="grid gap-2">
                @for (player of store.sortedPlayersForActiveSession(session); track player.id) {
                  <div
                    class="session-overview-player"
                    [class.session-overview-player-calling]="activeCall?.sessionPlayerId === player.id"
                  >
                    <div class="min-w-0">
                      <p class="truncate font-semibold text-white">{{ player.name }}</p>
                      <p class="text-xs text-neutral-500">
                        Calls {{ store.remainingTimeCallsForPlayer(session, player.id) }} / 3
                      </p>
                    </div>
                    <span
                      class="text-sm font-semibold"
                      [class.text-emerald-300]="player.status === 'ACTIVE'"
                      [class.text-neutral-500]="player.status === 'COMPLETED'"
                    >
                      {{ player.status === 'ACTIVE' ? 'In' : 'Out' }}
                    </span>
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
      } @else {
        <section class="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
          <h1 class="text-2xl font-semibold text-white">No active session</h1>
          <p class="mt-2 text-neutral-400">Start a table to use the shared overview screen.</p>
        </section>
      }
    </section>
  `
})
export class SessionOverviewPage implements OnInit {
  protected readonly store = inject(PokerStoreService);
  protected readonly selectedSessionId = signal(this.loadSelectedSessionId());
  protected readonly resolvingTimeCallId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly selectedSession = computed<PokerSession | undefined>(() => {
    const activeSessions = this.store.activeSessions();
    const selectedId = this.selectedSessionId();

    return activeSessions.find((session) => session.id === selectedId) ?? activeSessions[0];
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.refreshSessions();
    } catch {
      // The store exposes the error state.
    }
  }

  protected selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    localStorage.setItem(selectedSessionStorageKey, sessionId);
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

  private loadSelectedSessionId(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(selectedSessionStorageKey);
  }
}
