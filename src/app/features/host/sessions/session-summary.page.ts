import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LucideEllipsis } from '@lucide/angular';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerSession,
  PokerStoreService,
  PokerTransaction,
  SessionPlayer
} from '../data/poker-store.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../shared/confirmation-dialog.component';
import { messageFromUnknownError } from '../shared/action-feedback.logic';
import {
  ActionFeedbackToastComponent,
  ActionFeedbackToastTone,
} from '../shared/action-feedback-toast.component';

interface SessionTableGroup {
  tableId: string | null;
  tableName: string;
  players: SessionPlayer[];
}

interface SessionSummaryFeedback {
  message: string;
  tone: ActionFeedbackToastTone;
}

@Component({
  selector: 'app-session-summary-page',
  imports: [
    ActionFeedbackToastComponent,
    CurrencyPipe,
    DatePipe,
    LucideEllipsis,
    MatDialogModule,
    RouterLink,
  ],
  template: `
    @if (session(); as currentSession) {
      @if (actionToast(); as toast) {
        <app-action-feedback-toast [message]="toast.message" [tone]="toast.tone" />
      }

      @let totals = store.totalsFor(currentSession);
      @let adminNet = adminNetTotal(currentSession);
      @let netPending = isNetPending(currentSession);
      <section class="space-y-5 sm:space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a routerLink="/host/sessions/history" class="text-sm font-semibold text-emerald-300">&larr; History</a>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-semibold text-white sm:text-3xl">Session Summary</h1>
              <span
                class="rounded-full border px-3 py-1 text-xs font-semibold"
                [class.bg-emerald-300]="currentSession.status === 'ACTIVE'"
                [class.text-neutral-950]="currentSession.status === 'ACTIVE'"
                [class.border-emerald-300/50]="currentSession.status === 'ACTIVE'"
                [class.border-emerald-300/40]="currentSession.status === 'COMPLETED'"
                [class.bg-transparent]="currentSession.status === 'COMPLETED'"
                [class.text-emerald-300]="currentSession.status === 'COMPLETED'"
              >
                {{ currentSession.status }}
              </span>
            </div>
            <p class="mt-2 text-sm text-neutral-400 sm:text-base">
              {{ currentSession.name }} · {{ currentSession.sessionDate | date: 'mediumDate' }}
              @if (currentSession.closedAt) {
                · Closed {{ currentSession.closedAt | date: 'shortTime' }}
              }
            </p>
          </div>
          @if (currentSession.status === 'COMPLETED' && authState.isHostAdmin()) {
            <div class="session-summary-menu" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="session-summary-menu-trigger"
                aria-label="Session actions"
                [attr.aria-expanded]="sessionMenuOpen()"
                [disabled]="deletingSession()"
                (click)="toggleSessionMenu()"
              >
                <svg lucideEllipsis [strokeWidth]="2.3" aria-hidden="true"></svg>
              </button>
              @if (sessionMenuOpen()) {
                <div class="session-summary-menu-panel" role="menu">
                  <button type="button" role="menuitem" (click)="confirmDeleteSession()">
                    Delete session
                  </button>
                </div>
              }
            </div>
          }
        </div>

        @if (store.error()) {
          <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ store.error() }}
          </div>
        }

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <p class="text-sm text-neutral-400">Total players</p>
            <p class="mt-1 text-2xl font-semibold text-white sm:mt-2">{{ totals.totalPlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-1 text-2xl font-semibold text-sky-200 sm:mt-2">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 sm:p-4">
            <p class="text-sm text-amber-100/75">Total cashed out</p>
            <p class="mt-1 text-2xl font-semibold text-amber-200 sm:mt-2">
              {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div
            class="rounded-lg border p-3 sm:p-4"
            [class.border-amber-300/20]="netPending"
            [class.bg-amber-300/[0.06]]="netPending"
            [class.border-emerald-300/20]="!netPending && adminNet >= 0"
            [class.bg-emerald-300/[0.06]]="!netPending && adminNet >= 0"
            [class.border-red-300/20]="!netPending && adminNet < 0"
            [class.bg-red-300/[0.06]]="!netPending && adminNet < 0"
          >
            <p class="text-sm text-neutral-400">Net total</p>
            @if (netPending) {
              <p class="mt-1 text-2xl font-semibold text-amber-200 sm:mt-2">Pending</p>
            } @else {
              <p
                class="mt-1 text-2xl font-semibold sm:mt-2"
                [class.text-emerald-300]="adminNet >= 0"
                [class.text-red-300]="adminNet < 0"
              >
                {{ adminNet | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            }
          </div>
        </div>

        @if (totals.activePlayers > 0) {
          <div class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            {{ totals.activePlayers }} player(s) still have pending cash out values in this session.
          </div>
        }

        <div class="space-y-3">
            @for (tableGroup of tableGroups(); track tableGroup.tableId) {
              <section class="overflow-hidden rounded-xl border border-emerald-300/15 bg-neutral-950/80">
                <div class="flex items-center justify-between border-b border-white/10 bg-emerald-300/[0.04] px-3 py-2 sm:px-4">
                  <h2 class="text-base font-semibold text-white">{{ tableGroup.tableName }}</h2>
                  <span class="text-xs font-semibold text-emerald-300">
                    {{ tableGroup.players.length }} player{{ tableGroup.players.length === 1 ? '' : 's' }}
                  </span>
                </div>

                <div class="space-y-2 p-2 sm:p-3">
                  @for (player of tableGroup.players; track player.id) {
                    <article
                      class="summary-player-row overflow-hidden rounded-lg border border-white/10 bg-black/25"
                      [class.summary-player-row-open]="isPlayerExpanded(player.id)"
                    >
                      <button
                        type="button"
                        class="grid w-full gap-3 p-3 text-left transition duration-200 ease-out hover:bg-white/[0.035] sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
                        [attr.aria-expanded]="isPlayerExpanded(player.id)"
                        (click)="togglePlayer(player.id)"
                      >
                        <div class="min-w-0">
                          <div class="relative grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:min-h-0 sm:flex-wrap sm:items-center">
                            <h4 class="min-w-0 truncate text-center font-semibold text-white sm:text-left">
                              {{ player.name }}
                            </h4>
                            @if (player.status === 'ACTIVE') {
                              <span class="justify-self-end rounded-full bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100">
                                Pending
                              </span>
                            }
                          </div>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center text-sm lg:min-w-96">
                          <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                            <span class="block text-xs text-neutral-500">Buy-in</span>
                            <span class="mt-1 block text-base font-semibold text-white">
                              {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                            </span>
                          </span>
                          <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                            <span class="block text-xs text-neutral-500">Cash</span>
                            @if (player.status === 'COMPLETED') {
                              <span class="mt-1 block text-base font-semibold text-white">
                                {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                              </span>
                            } @else {
                              <span class="mt-1 block text-base font-semibold text-neutral-500">Pending</span>
                            }
                          </span>
                          <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                            <span class="block text-xs text-neutral-500">Net</span>
                            @if (player.status === 'COMPLETED') {
                              <span
                                class="mt-1 block text-base font-semibold"
                                [class.text-emerald-300]="player.net >= 0"
                                [class.text-red-300]="player.net < 0"
                              >
                                {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                              </span>
                            } @else {
                              <span class="mt-1 block text-base font-semibold text-neutral-500">Pending</span>
                            }
                          </span>
                        </div>
                      </button>

                      <div
                        class="summary-detail-panel"
                        [class.summary-detail-panel-open]="isPlayerExpanded(player.id)"
                        [attr.aria-hidden]="!isPlayerExpanded(player.id)"
                        [attr.inert]="isPlayerExpanded(player.id) ? null : ''"
                      >
                        <div class="summary-detail-panel-inner border-t border-white/10 bg-white/[0.02] p-3 sm:p-4">
                          <div class="space-y-2">
                            @for (transaction of transactionsForPlayer(player.id); track transaction.id) {
                              <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-neutral-950 p-3">
                                <span
                                  class="h-3 w-3 rounded-full"
                                  [class.bg-emerald-300]="transaction.type === 'BUYIN'"
                                  [class.bg-sky-300]="transaction.type === 'REBUY'"
                                  [class.bg-amber-300]="transaction.type === 'CASHOUT'"
                                ></span>
                                <span class="min-w-0">
                                  <span
                                    class="text-sm font-semibold uppercase"
                                    [class.text-emerald-200]="transaction.type === 'BUYIN'"
                                    [class.text-sky-200]="transaction.type === 'REBUY'"
                                    [class.text-amber-200]="transaction.type === 'CASHOUT'"
                                  >
                                    {{ transaction.type }}
                                  </span>
                                  <span class="mt-1 block text-xs text-neutral-500">
                                    {{ transaction.createdAt | date: 'short' }}
                                  </span>
                                </span>
                                <span class="text-center text-lg font-semibold text-white">
                                  {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                                </span>
                              </div>
                            } @empty {
                              <div class="rounded-lg border border-dashed border-white/10 p-4 text-sm text-neutral-500">
                                No buy-in, rebuy, or cash-out records for this player.
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              </section>
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
  `,
  styles: [
    `
      .summary-detail-panel {
        display: grid;
        grid-template-rows: 0fr;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition:
          grid-template-rows 360ms ease-in-out,
          opacity 300ms ease-in-out,
          visibility 0ms linear 360ms;
      }

      .summary-detail-panel-open {
        grid-template-rows: 1fr;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition:
          grid-template-rows 360ms ease-in-out,
          opacity 300ms ease-in-out;
      }

      .summary-detail-panel-inner {
        min-height: 0;
        overflow: hidden;
        transform: translateY(-0.25rem);
        transition:
          padding 320ms ease-in-out,
          transform 320ms ease-in-out,
          border-color 320ms ease-in-out;
      }

      .summary-detail-panel-open .summary-detail-panel-inner {
        transform: translateY(0);
      }

      .summary-detail-panel:not(.summary-detail-panel-open) .summary-detail-panel-inner {
        border-width: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      .summary-player-row {
        transition:
          border-color 220ms ease-out,
          background-color 220ms ease-out,
          box-shadow 260ms ease-out;
      }

      .summary-player-row-open {
        border-color: rgb(52 211 153 / 0.35);
        background:
          linear-gradient(180deg, rgb(16 185 129 / 0.1), rgb(16 185 129 / 0.035)),
          rgb(0 0 0 / 0.32);
        box-shadow:
          0 0 0 1px rgb(52 211 153 / 0.14),
          0 0 22px rgb(16 185 129 / 0.13);
      }

      .session-summary-menu {
        position: relative;
        flex: 0 0 auto;
        align-self: flex-end;
      }

      .session-summary-menu-trigger {
        display: inline-grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.5rem;
        background: rgb(255 255 255 / 0.035);
        color: rgb(209 250 229);
      }

      .session-summary-menu-trigger:hover:not(:disabled) {
        border-color: rgb(110 231 183 / 0.48);
        background: rgb(16 185 129 / 0.12);
      }

      .session-summary-menu-trigger:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .session-summary-menu-trigger svg {
        width: 1.25rem;
        height: 1.25rem;
      }

      .session-summary-menu-panel {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        z-index: 30;
        min-width: min(12rem, calc(100vw - 2rem));
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.5rem;
        background: rgb(10 10 10);
        padding: 0.4rem;
        box-shadow: 0 1.25rem 2.5rem rgb(0 0 0 / 0.38);
      }

      .session-summary-menu-panel button {
        width: 100%;
        border-radius: 0.35rem;
        padding: 0.7rem 0.8rem;
        color: rgb(252 165 165);
        text-align: left;
      }

      .session-summary-menu-panel button:hover {
        background: rgb(248 113 113 / 0.12);
      }
    `
  ]
})
export class SessionSummaryPage implements OnDestroy {
  protected readonly store = inject(PokerStoreService);
  protected readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  protected readonly expandedPlayerId = signal<string | null>(null);
  protected readonly deletingSession = signal(false);
  protected readonly sessionMenuOpen = signal(false);
  protected readonly actionToast = signal<SessionSummaryFeedback | null>(null);
  private actionToastTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly tableGroups = computed<SessionTableGroup[]>(() => {
    const currentSession = this.session();

    if (!currentSession) {
      return [];
    }

    const groups = currentSession.tables
      .map((table) => ({
        tableId: table.id,
        tableName: table.name,
        players: this.sortedPlayersForTable(currentSession, table.id)
      }))
      .filter((group) => group.players.length > 0);

    const unassignedPlayers = this.sortedPlayersForTable(currentSession, null);

    if (unassignedPlayers.length === 0) {
      return groups;
    }

    return [
      ...groups,
      {
        tableId: null,
        tableName: 'Unassigned Table',
        players: unassignedPlayers
      }
    ];
  });

  protected adminNetTotal(currentSession: PokerSession): number {
    const totals = this.store.totalsFor(currentSession);
    return totals.totalBuyIn - totals.totalCashOut;
  }

  protected isNetPending(currentSession: PokerSession): boolean {
    return this.store.totalsFor(currentSession).activePlayers > 0;
  }

  protected togglePlayer(playerId: string): void {
    this.expandedPlayerId.update((currentPlayerId) =>
      currentPlayerId === playerId ? null : playerId
    );
  }

  protected isPlayerExpanded(playerId: string): boolean {
    return this.expandedPlayerId() === playerId;
  }

  ngOnDestroy(): void {
    this.clearActionToast();
  }

  @HostListener('document:click')
  protected closeSessionMenu(): void {
    this.sessionMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeSessionMenuOnEscape(): void {
    this.sessionMenuOpen.set(false);
  }

  protected toggleSessionMenu(): void {
    this.sessionMenuOpen.update((isOpen) => !isOpen);
  }

  protected confirmDeleteSession(): void {
    const currentSession = this.session();

    if (
      !currentSession ||
      currentSession.status !== 'COMPLETED' ||
      !this.authState.isHostAdmin() ||
      this.deletingSession()
    ) {
      return;
    }

    this.sessionMenuOpen.set(false);
    const totals = this.store.totalsFor(currentSession);
    const playerCount = `${totals.totalPlayers} players`;
    const totalBuyIn = `${this.formatMoney(totals.totalBuyIn)} total buy-in`;
    const dialogRef = this.dialog.open<
      ConfirmationDialogComponent,
      ConfirmationDialogData,
      boolean
    >(ConfirmationDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete completed session?',
        message:
          'This permanently deletes this session and all game records. Registered members remain available.',
        cancelLabel: 'No, keep session',
        confirmLabel: 'Yes, delete',
        tone: 'danger',
        details: [currentSession.name, playerCount, totalBuyIn],
      },
      panelClass: 'pokertrack-dialog-panel',
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      this.deletingSession.set(true);

      try {
        await this.store.deleteSession(this.sessionId);
        await this.router.navigateByUrl('/host/sessions/history', { replaceUrl: true });
      } catch (error) {
        this.showActionToast(messageFromUnknownError(error, 'Unable to delete this session.'), 'error');
      } finally {
        this.deletingSession.set(false);
      }
    });
  }

  protected transactionsForPlayer(playerId: string): PokerTransaction[] {
    return (
      this.session()
        ?.transactions.filter((transaction) => transaction.playerId === playerId && !transaction.deletedAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)) ?? []
    );
  }

  private showActionToast(message: string, tone: ActionFeedbackToastTone): void {
    this.clearActionToast();
    this.actionToast.set({ message, tone });
    this.actionToastTimer = setTimeout(() => {
      this.actionToast.set(null);
      this.actionToastTimer = null;
    }, tone === 'error' ? 4300 : 2700);
  }

  private clearActionToast(): void {
    if (this.actionToastTimer) {
      clearTimeout(this.actionToastTimer);
      this.actionToastTimer = null;
    }

    this.actionToast.set(null);
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private sortedPlayersForTable(
    currentSession: PokerSession,
    tableId: string | null
  ): SessionPlayer[] {
    return [...this.store.playersForTable(currentSession, tableId)].sort((a, b) => b.net - a.net);
  }
}
