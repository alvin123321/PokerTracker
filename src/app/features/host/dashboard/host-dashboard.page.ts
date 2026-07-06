import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PokerSession, PokerStoreService, SessionPlayer } from '../data/poker-store.service';
import {
  AddPlayerDialogComponent,
  AddPlayerDialogData,
  AddPlayerDialogResult
} from '../players/add-player-dialog.component';
import {
  CashOutDialogComponent,
  CashOutDialogData
} from '../transactions/cash-out-dialog.component';
import {
  RebuyDialogComponent,
  RebuyDialogData,
  RebuyDialogResult
} from '../transactions/rebuy-dialog.component';

@Component({
  selector: 'app-host-dashboard-page',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, RouterLink],
  template: `
    <section class="space-y-6 sm:space-y-8">
      <div>
        <h1 class="hidden text-2xl font-semibold text-white sm:block sm:text-3xl">Dashboard</h1>
      </div>

      @if (actionError() || store.error()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ actionError() || store.error() }}
        </div>
      }

      @if (pendingAction()) {
        <div class="pokertrack-sync-overlay fixed inset-0 z-40 grid place-items-center bg-neutral-950/50 px-6 backdrop-blur-sm">
          <div class="rounded-xl border border-emerald-300/20 bg-neutral-950/90 px-6 py-5 text-center shadow-2xl shadow-black/50">
            <div class="deck-shuffle mx-auto mb-4" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p class="text-base font-semibold text-white">{{ loadingMessage() }}</p>
            <p class="mt-1 text-sm text-neutral-400">Syncing the table before controls unlock.</p>
          </div>
        </div>
      }

      <section class="rounded-xl border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span class="dashboard-table-icon" aria-hidden="true"></span>
            <h2 class="truncate text-xl font-semibold text-white">Active Tables</h2>
          </div>

          @if (authState.isHostAdmin()) {
            <a
              routerLink="/host/sessions/new"
              class="dashboard-new-session-icon"
              aria-label="New session"
              title="New session"
            >
              <span aria-hidden="true">+</span>
            </a>
          }
        </div>
        @if (store.activeSessions().length === 0) {
          <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <p class="text-lg font-semibold text-white">No active session</p>
            <p class="mt-2 text-sm text-neutral-400">Start a table when the first player arrives.</p>
          </div>
        } @else {
          <div class="grid gap-3">
            @for (session of store.activeSessions(); track session.id) {
              @let totals = store.totalsFor(session);
              <article
                class="overflow-hidden rounded-lg border border-white/10 bg-neutral-950/55 shadow-[0_0_28px_rgba(0,0,0,0.25)] transition hover:border-emerald-300/35"
              >
                <div
                  role="button"
                  tabindex="0"
                  class="w-full px-4 py-4 text-left transition hover:bg-white/[0.035] sm:px-5"
                  [attr.aria-expanded]="isSessionExpanded(session)"
                  (click)="toggleSession(session.id)"
                  (keydown.enter)="toggleSession(session.id)"
                  (keydown.space)="$event.preventDefault(); toggleSession(session.id)"
                >
                  <div class="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                    <div class="hidden items-center gap-4 sm:flex">
                      <span class="dashboard-chip-mark dashboard-mobile-hidden" aria-hidden="true">
                        <span>&spades;</span>
                      </span>
                      <span
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-300/10 text-sm font-bold text-emerald-200 transition-transform duration-300 ease-in-out"
                        [style.transform]="isSessionExpanded(session) ? 'rotate(90deg)' : 'rotate(0deg)'"
                      >
                        >
                      </span>
                    </div>

                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-3">
                        <h3 class="truncate text-2xl font-semibold text-white">{{ session.name }}</h3>
                        <span class="rounded-full border border-emerald-300/45 px-3 py-1 text-xs font-semibold uppercase text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.12)]">
                          Active
                        </span>
                      </div>
                      <p class="mt-2 hidden items-center gap-2 text-sm text-neutral-400 sm:flex">
                        <span class="dashboard-date-icon" aria-hidden="true">▣</span>
                        <span>{{ session.sessionDate | date: 'mediumDate' }}</span>
                      </p>

                      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-2xl">
                        <div class="dashboard-stat">
                          <span class="dashboard-stat-icon dashboard-stat-icon-players" aria-hidden="true"></span>
                          <span class="dashboard-stat-copy">
                            <span class="dashboard-stat-value">{{ totals.totalPlayers }}</span>
                            <span class="dashboard-stat-label">Players</span>
                          </span>
                        </div>
                        <div class="dashboard-stat">
                          <span class="dashboard-stat-icon dashboard-stat-icon-cashed" aria-hidden="true"></span>
                          <span class="dashboard-stat-copy">
                            <span class="dashboard-stat-value">{{ totals.cashedOutPlayers }}</span>
                            <span class="dashboard-stat-label">Cashed-Out</span>
                          </span>
                        </div>
                        <div class="dashboard-stat dashboard-mobile-hidden">
                          <span class="dashboard-stat-icon dashboard-stat-icon-buyin" aria-hidden="true"></span>
                          <span class="dashboard-stat-copy">
                            <span
                              class="dashboard-stat-value"
                              [class.dashboard-number-shuffle]="isRecentRebuySession(session.id)"
                            >
                              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                            </span>
                            <span class="dashboard-stat-label">Buy-in</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:min-w-[24rem]">
                      <a
                        [routerLink]="['/host/sessions', session.id]"
                        class="dashboard-session-button dashboard-session-button-outline dashboard-mobile-hidden"
                        [attr.tabindex]="isSessionExpanded(session) ? null : 0"
                        (click)="$event.stopPropagation()"
                      >
                        <span aria-hidden="true">♤</span>
                        Open Session
                      </a>
                      <a
                        [routerLink]="['/host/sessions', session.id]"
                        class="dashboard-session-button dashboard-session-button-outline dashboard-mobile-only"
                        (click)="$event.stopPropagation()"
                      >
                        Detail
                      </a>
                      <button
                        type="button"
                        [disabled]="isBusy()"
                        class="dashboard-session-button dashboard-session-button-primary"
                        (click)="openAddPlayerDialog(session.id); $event.stopPropagation()"
                      >
                        <span aria-hidden="true">+</span>
                        @if (isPending('add-player')) {
                          Adding...
                        } @else {
                          Add Player
                        }
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
                  [style.grid-template-rows]="isSessionExpanded(session) ? '1fr' : '0fr'"
                  [style.pointer-events]="isSessionExpanded(session) ? 'auto' : 'none'"
                >
                  <div class="min-h-0">
                    <div
                      class="border-t border-white/10 px-4 py-4 opacity-0 transition-opacity duration-300 ease-in-out sm:px-5"
                      [class.opacity-100]="isSessionExpanded(session)"
                    >
                      @for (player of store.sortedPlayersForActiveSession(session); track player.id) {
                        <div
                          class="grid gap-3 border border-white/10 border-b-0 bg-black/20 p-3 first:rounded-t-lg last:rounded-b-lg last:border-b md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                          [class.dashboard-rebuy-glow]="isRecentRebuyPlayer(player.id)"
                        >
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <p class="truncate font-semibold text-white">{{ player.name }}</p>
                              <span
                                class="dashboard-player-buyin-mobile ml-auto sm:hidden"
                                [class.dashboard-number-shuffle]="isRecentRebuyPlayer(player.id)"
                              >
                                {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                              </span>
                              @if (player.status === 'COMPLETED') {
                                <span class="text-sm font-bold leading-none text-emerald-300">&check;</span>
                              }
                            </div>
                            <p class="mt-1 hidden text-xs text-neutral-500 md:block">
                              Joined {{ player.joinedAt | date: 'shortTime' }}
                            </p>
                          </div>

                          <div class="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-3 md:min-w-96">
                            <span class="hidden rounded-lg bg-white/[0.04] px-3 py-2 md:col-span-1 md:block">
                              <span class="block text-xs text-neutral-500">Buy-in</span>
                              <span
                                class="mt-1 block font-semibold text-white"
                                [class.dashboard-number-shuffle]="isRecentRebuyPlayer(player.id)"
                              >
                                {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                              </span>
                            </span>
                            @if (player.status === 'ACTIVE') {
                              <button
                                type="button"
                                [disabled]="isBusy()"
                                class="dashboard-player-action"
                                (click)="openRebuyDialog(session.id, player); $event.stopPropagation()"
                              >
                                @if (isPending(playerAction('rebuy', player.id))) {
                                  Saving...
                                } @else {
                                  Rebuy
                                }
                              </button>
                              <button
                                type="button"
                                [disabled]="isBusy()"
                                class="dashboard-player-action dashboard-player-action-cashout"
                                (click)="openCashOutDialog(session.id, player); $event.stopPropagation()"
                              >
                                @if (isPending(playerAction('cash-out', player.id))) {
                                  Saving...
                                } @else {
                                  Cashout
                                }
                              </button>
                            } @else {
                              <span class="dashboard-player-action dashboard-player-action-disabled" aria-disabled="true">
                                Rebuy
                              </span>
                              <span
                                class="dashboard-player-action dashboard-player-action-cashout dashboard-player-action-disabled"
                                aria-disabled="true"
                              >
                                Cashout
                              </span>
                            }
                          </div>
                        </div>
                      } @empty {
                        <div class="rounded-lg border border-dashed border-white/10 p-4 text-sm text-neutral-500">
                          No players added yet.
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </section>

      @if (store.completedSessions().length > 0) {
        <section class="space-y-4">
          <h2 class="text-xl font-semibold text-white">Completed sessions</h2>

          <div class="grid gap-3">
            @for (session of store.completedSessions(); track session.id) {
              @let totals = store.totalsFor(session);
              <a
                [routerLink]="['/host/sessions', session.id, 'summary']"
                class="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-300/40 hover:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="shrink-0 text-lg font-bold leading-none text-emerald-300">
                    &check;
                  </span>
                  <div class="min-w-0">
                    <h3 class="truncate text-base font-semibold text-white">{{ session.name }}</h3>
                    <p class="mt-1 text-sm text-neutral-400">
                      {{ session.sessionDate | date: 'mediumDate' }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-80">
                  <div class="rounded-lg bg-black/20 px-3 py-2">
                    <p class="text-xs uppercase text-neutral-500">Players</p>
                    <p class="mt-1 font-semibold text-white">{{ totals.totalPlayers }}</p>
                  </div>
                  <div class="rounded-lg bg-black/20 px-3 py-2">
                    <p class="text-xs uppercase text-neutral-500">Buy-in</p>
                    <p class="mt-1 font-semibold text-white">
                      {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-black/20 px-3 py-2">
                    <p class="text-xs uppercase text-neutral-500">Net</p>
                    <p
                      class="mt-1 font-semibold"
                      [class.text-emerald-300]="totals.totalNet >= 0"
                      [class.text-red-300]="totals.totalNet < 0"
                    >
                      {{ totals.totalNet | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>
                </div>
              </a>
            }
          </div>
        </section>
      }
    </section>
  `
})
export class HostDashboardPage implements OnDestroy {
  protected readonly store = inject(PokerStoreService);
  protected readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  protected readonly expandedSessionId = signal<string | null | undefined>(undefined);
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly recentRebuyPlayerId = signal<string | null>(null);
  protected readonly recentRebuySessionId = signal<string | null>(null);
  private rebuyAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.clearRebuyAnimation();
  }

  protected isSessionExpanded(session: PokerSession): boolean {
    const expandedSessionId = this.expandedSessionId();

    if (expandedSessionId === undefined) {
      return this.store.activeSessions()[0]?.id === session.id;
    }

    return expandedSessionId === session.id;
  }

  protected toggleSession(sessionId: string): void {
    const expandedSessionId = this.expandedSessionId();
    const isDefaultOpen = expandedSessionId === undefined && this.store.activeSessions()[0]?.id === sessionId;
    const isCurrentlyOpen = expandedSessionId === sessionId || isDefaultOpen;

    this.expandedSessionId.set(isCurrentlyOpen ? null : sessionId);
  }

  protected async openAddPlayerDialog(sessionId: string): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    let registeredPlayers: AddPlayerDialogData['registeredPlayers'] = [];

    try {
      this.actionError.set(null);
      registeredPlayers = await this.store.listRegisteredPlayers();
    } catch (error) {
      this.actionError.set(this.toMessage(error));
      return;
    }

    const dialogRef = this.dialog.open<
      AddPlayerDialogComponent,
      AddPlayerDialogData,
      AddPlayerDialogResult
    >(AddPlayerDialogComponent, {
      autoFocus: 'first-tabbable',
      data: { registeredPlayers },
      panelClass: 'pokertrack-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(async (result?: AddPlayerDialogResult) => {
      if (!result || !result.name) {
        return;
      }

      await this.runAction('add-player', () =>
        this.store.addPlayer(
          sessionId,
          result.name,
          result.buyIn,
          result.comment,
          result.playerUserId,
          result.createRegisteredPlayer
        )
      );
    });
  }

  protected openRebuyDialog(sessionId: string, player: SessionPlayer): void {
    if (this.isBusy()) {
      return;
    }

    const dialogRef = this.dialog.open<RebuyDialogComponent, RebuyDialogData, RebuyDialogResult>(
      RebuyDialogComponent,
      {
        autoFocus: false,
        data: { player },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (result?: RebuyDialogResult) => {
      if (result && result.amount > 0) {
        const succeeded = await this.runAction(this.playerAction('rebuy', player.id), () =>
          this.store.recordRebuy(sessionId, player.id, result.amount, result.comment)
        );

        if (succeeded) {
          this.playRebuyAnimation(sessionId, player.id);
        }
      }
    });
  }

  protected openCashOutDialog(sessionId: string, player: SessionPlayer): void {
    if (this.isBusy()) {
      return;
    }

    const dialogRef = this.dialog.open<CashOutDialogComponent, CashOutDialogData, number>(
      CashOutDialogComponent,
      {
        autoFocus: 'first-tabbable',
        data: { player, mode: player.status === 'COMPLETED' ? 'edit' : 'record' },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (amount?: number) => {
      if (amount !== undefined && amount >= 0) {
        await this.runAction(this.playerAction('cash-out', player.id), () =>
          this.store.recordCashOut(sessionId, player.id, amount)
        );
      }
    });
  }

  protected isBusy(): boolean {
    return Boolean(this.pendingAction() || this.store.loading());
  }

  protected isPending(action: string): boolean {
    return this.pendingAction() === action;
  }

  protected loadingMessage(): string {
    const action = this.pendingAction();

    if (action === 'add-player') {
      return 'Adding player...';
    }

    if (action?.startsWith('rebuy:')) {
      return 'Recording rebuy...';
    }

    if (action?.startsWith('cash-out:')) {
      return 'Recording cash out...';
    }

    return 'Saving changes...';
  }

  protected isRecentRebuyPlayer(playerId: string): boolean {
    return this.recentRebuyPlayerId() === playerId;
  }

  protected isRecentRebuySession(sessionId: string): boolean {
    return this.recentRebuySessionId() === sessionId;
  }

  protected playerAction(action: string, playerId: string): string {
    return `${action}:${playerId}`;
  }

  private async runAction(action: string, task: () => Promise<void>): Promise<boolean> {
    if (this.pendingAction()) {
      return false;
    }

    this.pendingAction.set(action);
    this.actionError.set(null);
    const startedAt = Date.now();
    let succeeded = false;

    try {
      await task();
      succeeded = true;
    } catch (error) {
      this.actionError.set(this.toMessage(error));
    } finally {
      await this.waitForMinimumActionDelay(startedAt);
      this.pendingAction.set(null);
    }

    return succeeded;
  }

  private playRebuyAnimation(sessionId: string, playerId: string): void {
    this.clearRebuyAnimation();
    this.recentRebuySessionId.set(sessionId);
    this.recentRebuyPlayerId.set(playerId);
    this.rebuyAnimationTimer = setTimeout(() => this.clearRebuyAnimation(), 1500);
  }

  private clearRebuyAnimation(): void {
    if (this.rebuyAnimationTimer) {
      clearTimeout(this.rebuyAnimationTimer);
      this.rebuyAnimationTimer = null;
    }

    this.recentRebuySessionId.set(null);
    this.recentRebuyPlayerId.set(null);
  }

  private waitForMinimumActionDelay(startedAt: number): Promise<void> {
    const remainingMs = Math.max(0, 750 - (Date.now() - startedAt));

    if (remainingMs === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to save changes.';
  }
}
