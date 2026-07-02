import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  PokerStoreService,
  SessionPlayer,
  PokerTransaction
} from '../data/poker-store.service';
import {
  AddPlayerDialogData,
  AddPlayerDialogComponent,
  AddPlayerDialogResult
} from '../players/add-player-dialog.component';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../shared/confirmation-dialog.component';
import {
  CashOutDialogComponent,
  CashOutDialogData
} from '../transactions/cash-out-dialog.component';
import {
  EditBuyInDialogComponent,
  EditBuyInDialogData,
  EditBuyInDialogResult
} from '../transactions/edit-buy-in-dialog.component';
import {
  RebuyDialogComponent,
  RebuyDialogData,
  RebuyDialogResult
} from '../transactions/rebuy-dialog.component';

@Component({
  selector: 'app-active-session-page',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, RouterLink],
  template: `
    @if (session(); as currentSession) {
      @let totals = store.totalsFor(currentSession);
      @if (toastMessage(); as message) {
        <div class="pokertrack-toast pointer-events-none fixed bottom-4 right-4 z-50 w-[min(calc(100vw-2rem),22rem)] sm:bottom-6 sm:right-6">
          <div
            class="rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl shadow-black/40 backdrop-blur"
            [class.border-red-400/30]="toastTone() === 'error'"
            [class.bg-red-400/15]="toastTone() === 'error'"
            [class.text-red-50]="toastTone() === 'error'"
            [class.border-emerald-300/25]="toastTone() === 'saving'"
            [class.bg-neutral-900/90]="toastTone() === 'saving'"
            [class.text-emerald-50]="toastTone() === 'saving'"
            [class.border-emerald-300/30]="toastTone() === 'success'"
            [class.bg-emerald-400/15]="toastTone() === 'success'"
            [class.text-emerald-50]="toastTone() === 'success'"
          >
            {{ message }}
          </div>
        </div>
      }

      <section class="space-y-4 sm:space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">Dashboard</a>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-semibold text-white sm:text-3xl">{{ currentSession.name }}</h1>
              <span class="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-neutral-950">
                {{ currentSession.status }}
              </span>
            </div>
            <p class="mt-2 text-sm text-neutral-400">
              {{ currentSession.sessionDate | date: 'fullDate' }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:flex">
            <button
              type="button"
              [disabled]="isBusy()"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              (click)="openAddPlayerDialog()"
            >
              @if (isPending('add-player')) {
                <span class="action-spinner" aria-hidden="true"></span>
                Adding...
              } @else {
                Add Player
              }
            </button>
            <button
              type="button"
              [disabled]="isBusy()"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/30 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              (click)="closeSession()"
            >
              @if (isPending('close-session')) {
                <span class="action-spinner" aria-hidden="true"></span>
                Closing...
              } @else {
                Close Session
              }
            </button>
          </div>
        </div>

        <div class="hidden gap-3 md:grid md:grid-cols-4 md:gap-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
            <p class="text-sm text-neutral-400">Players</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">{{ totals.totalPlayers }}</p>
          </div>
          <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 md:block md:p-4">
            <p class="text-sm text-neutral-400">Active</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">{{ totals.activePlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 md:block md:p-4">
            <p class="text-sm text-neutral-400">Cash out</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">
              {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
        </div>

        @if (currentSession.players.length === 0) {
          <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <p class="text-xl font-semibold text-white">Add the first player</p>
            <p class="mt-2 text-sm text-neutral-400">Players are added immediately with a default $200 buy-in.</p>
            <button
              type="button"
              class="mt-5 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
              [disabled]="isBusy()"
              (click)="openAddPlayerDialog()"
            >
              Add Player
            </button>
          </div>
        } @else {
          <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div
              class="hidden grid-cols-[1.35fr_0.8fr_0.9fr_0.9fr_0.65fr_0.85fr_1.4fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 lg:grid"
            >
              <span>Player</span>
              <span>Status</span>
              <span>Buy-in</span>
              <span>Cash out</span>
              <span>Rebuys</span>
              <span>Net</span>
              <span class="text-right">Actions</span>
            </div>

            @for (player of sortedPlayers(); track player.id) {
              <div
                class="border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.035]"
                [class.opacity-70]="player.status === 'COMPLETED'"
              >
                <div class="lg:hidden">
                  <div
                    class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-2"
                    (click)="togglePlayer(player.id)"
                  >
                    <button
                      type="button"
                      class="min-w-0 text-left"
                      (click)="$event.stopPropagation(); togglePlayer(player.id)"
                    >
                      <span class="flex min-w-0 items-center gap-2">
                        <span class="truncate text-sm font-semibold text-white">{{ player.name }}</span>
                        <span class="shrink-0 text-xs text-neutral-500">
                          {{ isExpanded(player.id) ? 'v' : '>' }}
                        </span>
                      </span>
                      <span class="mt-0.5 block text-xs text-neutral-400">
                        {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }} buy-in
                      </span>
                    </button>

                    <button
                      type="button"
                      [disabled]="player.status === 'COMPLETED' || isBusy()"
                      class="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openRebuyDialog(player)"
                    >
                      @if (isPending(playerAction('rebuy', player.id))) {
                        <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                        Saving
                      } @else {
                        Rebuy
                      }
                    </button>
                    <button
                      type="button"
                      [disabled]="player.status === 'COMPLETED' || isBusy()"
                      class="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openCashOutDialog(player)"
                    >
                      @if (isPending(playerAction('cash-out', player.id))) {
                        <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                        Saving
                      } @else {
                        Cash Out
                      }
                    </button>
                  </div>
                </div>

                <div
                  class="hidden cursor-pointer gap-4 p-4 lg:grid lg:grid-cols-[1.35fr_0.8fr_0.9fr_0.9fr_0.65fr_0.85fr_1.4fr] lg:items-center lg:gap-3"
                  (click)="togglePlayer(player.id)"
                >
                  <button
                    type="button"
                    class="group flex items-center gap-3 text-left"
                    (click)="$event.stopPropagation(); togglePlayer(player.id)"
                  >
                    <span
                      class="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-neutral-950 transition group-hover:border-emerald-300/60 group-hover:bg-emerald-300/10"
                      aria-hidden="true"
                    >
                      <span class="text-sm font-bold text-neutral-400 transition group-hover:text-emerald-300">
                        {{ isExpanded(player.id) ? 'v' : '>' }}
                      </span>
                    </span>
                    <span>
                      <span class="block text-lg font-semibold text-white lg:text-base">{{ player.name }}</span>
                      <span class="mt-1 block text-xs text-neutral-500">
                        {{ isExpanded(player.id) ? 'Hide buy-ins' : 'Show buy-ins' }}
                      </span>
                    </span>
                  </button>

                  <div>
                    <span
                      class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                      [class.bg-emerald-300]="player.status === 'ACTIVE'"
                      [class.text-neutral-950]="player.status === 'ACTIVE'"
                      [class.bg-white]="player.status === 'COMPLETED'"
                      [class.text-neutral-950]="player.status === 'COMPLETED'"
                    >
                      {{ player.status }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Buy-in</p>
                    <p class="font-semibold text-white">
                      {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Cash out</p>
                    <p class="font-semibold text-white">
                      @if (player.status === 'COMPLETED') {
                        {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                      } @else {
                        <span class="text-neutral-500">Pending</span>
                      }
                    </p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Rebuys</p>
                    <p class="font-semibold text-white">{{ rebuyCount(player.id) }}</p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Net</p>
                    @if (player.status === 'COMPLETED') {
                      <p
                        class="font-semibold"
                        [class.text-emerald-300]="player.net >= 0"
                        [class.text-red-300]="player.net < 0"
                      >
                        {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </p>
                    } @else {
                      <p class="font-semibold text-neutral-500">Pending</p>
                    }
                  </div>

                  <div class="grid grid-cols-2 gap-2 lg:justify-end">
                    <button
                      type="button"
                      [disabled]="player.status === 'COMPLETED' || isBusy()"
                      class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openRebuyDialog(player)"
                    >
                      @if (isPending(playerAction('rebuy', player.id))) {
                        <span class="action-spinner" aria-hidden="true"></span>
                        Saving...
                      } @else {
                        Rebuy
                      }
                    </button>
                    <button
                      type="button"
                      [disabled]="player.status === 'COMPLETED' || isBusy()"
                      class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openCashOutDialog(player)"
                    >
                      @if (isPending(playerAction('cash-out', player.id))) {
                        <span class="action-spinner" aria-hidden="true"></span>
                        Saving...
                      } @else {
                        Cash Out
                      }
                    </button>
                  </div>
                </div>

                @if (isExpanded(player.id)) {
                  <div class="border-t border-emerald-300/10 bg-neutral-950/80 px-3 py-3 sm:px-4 sm:py-4">
                    <div class="mb-3 grid grid-cols-2 gap-2 text-sm lg:hidden">
                      <div class="rounded-lg bg-white/[0.03] p-3">
                        <p class="text-xs text-neutral-500">Status</p>
                        <p class="mt-1 font-semibold text-white">{{ player.status }}</p>
                      </div>
                      <div class="rounded-lg bg-white/[0.03] p-3">
                        <p class="text-xs text-neutral-500">Rebuys</p>
                        <p class="mt-1 font-semibold text-white">{{ rebuyCount(player.id) }}</p>
                      </div>
                      <div class="rounded-lg bg-white/[0.03] p-3">
                        <p class="text-xs text-neutral-500">Cash out</p>
                        <p class="mt-1 font-semibold text-white">
                          @if (player.status === 'COMPLETED') {
                            {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                          } @else {
                            <span class="text-neutral-500">Pending</span>
                          }
                        </p>
                      </div>
                      <div class="rounded-lg bg-white/[0.03] p-3">
                        <p class="text-xs text-neutral-500">Net</p>
                        @if (player.status === 'COMPLETED') {
                          <p
                            class="mt-1 font-semibold"
                            [class.text-emerald-300]="player.net >= 0"
                            [class.text-red-300]="player.net < 0"
                          >
                            {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                          </p>
                        } @else {
                          <p class="mt-1 font-semibold text-neutral-500">Pending</p>
                        }
                      </div>
                    </div>

                    <div class="mb-3 flex items-center justify-between gap-3">
                      <p class="text-sm font-semibold text-white">Buy-in timeline</p>
                      <p class="hidden text-xs text-neutral-500 sm:block">Host can edit or delete buy-ins</p>
                    </div>

                    <div class="space-y-2">
                      @if (buyInTransactions(player.id).length === 0) {
                        <div class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-500">
                          No buy-ins recorded for this player.
                        </div>
                      } @else {
                        @for (transaction of buyInTransactions(player.id); track transaction.id) {
                          <div
                            class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[0.75fr_0.9fr_0.7fr_1.2fr_auto] sm:items-center"
                            [class.border-neutral-800]="transaction.deletedAt"
                            [class.opacity-60]="transaction.deletedAt"
                          >
                            <span
                              class="text-xs font-semibold uppercase text-emerald-300"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              {{ transaction.type }}
                              @if (transaction.deletedAt) {
                                <span class="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-neutral-500 no-underline">
                                  Deleted
                                </span>
                              }
                            </span>
                            <span
                              class="text-sm text-neutral-300"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              {{ transaction.createdAt | date: 'shortTime' }}
                            </span>
                            <span
                              class="font-semibold text-white"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                            </span>
                            <span
                              class="text-sm text-neutral-400"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              @if (transaction.comment) {
                                {{ transaction.comment }}
                              } @else {
                                <span class="text-neutral-600">No comment</span>
                              }
                            </span>
                            <button
                              type="button"
                              [disabled]="isBusy()"
                              class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              (click)="openEditBuyInDialog(player, transaction)"
                            >
                              @if (
                                isPending(transactionAction('edit-buy-in', transaction.id)) ||
                                isPending(transactionAction('delete-buy-in', transaction.id))
                              ) {
                                <span class="action-spinner" aria-hidden="true"></span>
                                Saving...
                              } @else {
                                Edit
                              }
                            </button>
                          </div>
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>
    } @else {
      <section class="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 class="text-2xl font-semibold text-white">Session not found</h1>
        <p class="mt-2 text-neutral-400">Create a new session or choose one from the dashboard.</p>
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
      .pokertrack-toast {
        animation: pokertrack-toast-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .action-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 9999px;
        animation: action-spinner 700ms linear infinite;
      }

      .action-spinner-sm {
        width: 0.75rem;
        height: 0.75rem;
      }

      @keyframes action-spinner {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes pokertrack-toast-in {
        from {
          opacity: 0;
          transform: translateY(0.75rem) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `
  ]
})
export class ActiveSessionPage implements OnDestroy {
  protected readonly store = inject(PokerStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  private readonly expandedPlayerId = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successToast = signal<string | null>(null);

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly sortedPlayers = computed(() =>
    this.store.sortedPlayersForActiveSession(this.session())
  );
  protected readonly toastMessage = computed(() => {
    if (this.actionError() || this.store.error()) {
      return this.actionError() ?? this.store.error();
    }

    if (this.pendingAction()) {
      return 'Saving changes...';
    }

    return this.successToast();
  });
  protected readonly toastTone = computed<'saving' | 'error' | 'success'>(() => {
    if (this.actionError() || this.store.error()) {
      return 'error';
    }

    if (this.pendingAction()) {
      return 'saving';
    }

    return 'success';
  });

  ngOnDestroy(): void {
    this.clearSuccessToast();
  }

  protected async openAddPlayerDialog(): Promise<void> {
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
          this.sessionId,
          result.name,
          result.buyIn,
          result.comment,
          result.playerUserId,
          result.createRegisteredPlayer
        )
      );
    });
  }

  protected openRebuyDialog(player: SessionPlayer): void {
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
        await this.runAction(this.playerAction('rebuy', player.id), () =>
          this.store.recordRebuy(this.sessionId, player.id, result.amount, result.comment)
        );
      }
    });
  }

  protected openCashOutDialog(player: SessionPlayer): void {
    if (this.isBusy()) {
      return;
    }

    const dialogRef = this.dialog.open<CashOutDialogComponent, CashOutDialogData, number>(
      CashOutDialogComponent,
      {
        autoFocus: 'first-tabbable',
        data: { player },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (amount?: number) => {
      if (amount !== undefined && amount >= 0) {
        await this.runAction(this.playerAction('cash-out', player.id), () =>
          this.store.recordCashOut(this.sessionId, player.id, amount)
        );
      }
    });
  }

  protected openEditBuyInDialog(player: SessionPlayer, transaction: PokerTransaction): void {
    if (this.isBusy()) {
      return;
    }

    const dialogRef = this.dialog.open<
      EditBuyInDialogComponent,
      EditBuyInDialogData,
      EditBuyInDialogResult
    >(EditBuyInDialogComponent, {
      autoFocus: 'first-tabbable',
      data: {
        playerName: player.name,
        transaction
      },
      panelClass: 'pokertrack-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(async (result?: EditBuyInDialogResult) => {
      if (!result) {
        return;
      }

      if (result.action === 'delete') {
        this.confirmDeleteBuyIn(player, transaction);
        return;
      }

      if (result.amount > 0) {
        await this.runAction(this.transactionAction('edit-buy-in', transaction.id), () =>
          this.store.updateBuyInTransaction(
            this.sessionId,
            transaction.id,
            result.amount,
            result.comment
          )
        );
      }
    });
  }

  private confirmDeleteBuyIn(player: SessionPlayer, transaction: PokerTransaction): void {
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Delete buy-in?',
          message:
            'This marks the transaction as deleted, moves it to the bottom of the timeline, and recalculates the player total immediately.',
          confirmLabel: 'Delete',
          tone: 'danger',
          details: [
            player.name,
            `${transaction.type} · ${this.formatMoney(transaction.amount)} · ${new Date(
              transaction.createdAt
            ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          ]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        await this.runAction(this.transactionAction('delete-buy-in', transaction.id), () =>
          this.store.deleteBuyInTransaction(this.sessionId, transaction.id)
        );
      }
    });
  }

  protected rebuyCount(playerId: string): number {
    return (
      this.session()?.transactions.filter(
        (transaction) =>
          transaction.playerId === playerId &&
          transaction.type === 'REBUY' &&
          !transaction.deletedAt
      ).length ?? 0
    );
  }

  protected buyInTransactions(playerId: string): PokerTransaction[] {
    return this.store.buyInTransactionsForPlayer(this.session(), playerId);
  }

  protected togglePlayer(playerId: string): void {
    this.expandedPlayerId.update((currentPlayerId) =>
      currentPlayerId === playerId ? null : playerId
    );
  }

  protected isExpanded(playerId: string): boolean {
    return this.expandedPlayerId() === playerId;
  }

  protected isBusy(): boolean {
    return Boolean(this.pendingAction() || this.store.loading());
  }

  protected isPending(action: string): boolean {
    return this.pendingAction() === action;
  }

  protected playerAction(action: string, playerId: string): string {
    return `${action}:${playerId}`;
  }

  protected transactionAction(action: string, transactionId: string): string {
    return `${action}:${transactionId}`;
  }

  protected closeSession(): void {
    if (this.isBusy()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession) {
      return;
    }

    const totals = this.store.totalsFor(currentSession);
    const pendingPlayers = currentSession.players.filter((player) => player.status === 'ACTIVE');
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Close session?',
          message:
            pendingPlayers.length > 0
              ? 'Some players have not cashed out yet. You can close anyway, but their cash out will remain pending in this session.'
              : 'This marks the session completed and opens the final summary.',
          confirmLabel: pendingPlayers.length > 0 ? 'Close anyway' : 'Close session',
          tone: pendingPlayers.length > 0 ? 'danger' : 'primary',
          details: [
            `${totals.totalPlayers} players`,
            `${this.formatMoney(totals.totalBuyIn)} total buy-in`,
            `${pendingPlayers.length} pending cash out`
          ]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      await this.runAction('close-session', async () => {
        await this.store.closeSession(this.sessionId);
        await this.router.navigate(['/host/sessions', this.sessionId, 'summary']);
      });
    });
  }

  private async runAction(action: string, task: () => Promise<void>): Promise<void> {
    if (this.pendingAction()) {
      return;
    }

    this.clearSuccessToast();
    this.pendingAction.set(action);
    this.actionError.set(null);
    let succeeded = false;

    try {
      await task();
      succeeded = true;
    } catch (error) {
      this.actionError.set(this.toMessage(error));
    } finally {
      this.pendingAction.set(null);

      if (succeeded) {
        this.showSuccessToast('Saved');
      }
    }
  }

  private showSuccessToast(message: string): void {
    this.clearSuccessToast();
    this.successToast.set(message);
    this.toastTimer = setTimeout(() => {
      this.successToast.set(null);
      this.toastTimer = null;
    }, 2400);
  }

  private clearSuccessToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.successToast.set(null);
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to save changes.';
  }
}
