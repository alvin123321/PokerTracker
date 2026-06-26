import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  MockPokerStoreService,
  MockSessionPlayer,
  MockTransaction
} from '../data/mock-poker-store.service';
import {
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
      <section class="space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">Dashboard</a>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h1 class="text-3xl font-semibold text-white">{{ currentSession.name }}</h1>
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
              class="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
              (click)="openAddPlayerDialog()"
            >
              Add Player
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-300/30 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-400/10"
              (click)="closeSession()"
            >
              Close Session
            </button>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Players</p>
            <p class="mt-2 text-2xl font-semibold text-white">{{ totals.totalPlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Active</p>
            <p class="mt-2 text-2xl font-semibold text-white">{{ totals.activePlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-2 text-2xl font-semibold text-white">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p class="text-sm text-neutral-400">Cash out</p>
            <p class="mt-2 text-2xl font-semibold text-white">
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
                <div
                  class="grid cursor-pointer gap-4 p-4 lg:grid-cols-[1.35fr_0.8fr_0.9fr_0.9fr_0.65fr_0.85fr_1.4fr] lg:items-center lg:gap-3"
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
                      [disabled]="player.status === 'COMPLETED'"
                      class="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openRebuyDialog(player)"
                    >
                      Rebuy
                    </button>
                    <button
                      type="button"
                      [disabled]="player.status === 'COMPLETED'"
                      class="rounded-lg border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openCashOutDialog(player)"
                    >
                      Cash Out
                    </button>
                  </div>
                </div>

                @if (isExpanded(player.id)) {
                  <div class="border-t border-emerald-300/10 bg-neutral-950/80 px-4 py-4">
                    <div class="mb-3 flex items-center justify-between gap-3">
                      <p class="text-sm font-semibold text-white">Buy-in timeline</p>
                      <p class="text-xs text-neutral-500">Host can edit or delete buy-ins</p>
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
                              class="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                              (click)="openEditBuyInDialog(player, transaction)"
                            >
                              Edit
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
  `
})
export class ActiveSessionPage {
  protected readonly store = inject(MockPokerStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  private readonly expandedPlayerId = signal<string | null>(null);

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly sortedPlayers = computed(() =>
    this.store.sortedPlayersForActiveSession(this.session())
  );

  protected openAddPlayerDialog(): void {
    const dialogRef = this.dialog.open(AddPlayerDialogComponent, {
      autoFocus: 'first-tabbable',
      panelClass: 'pokertrack-dialog-panel'
    });

    dialogRef.afterClosed().subscribe((result?: AddPlayerDialogResult) => {
      if (!result || !result.name) {
        return;
      }

      this.store.addPlayer(this.sessionId, result.name, result.buyIn, result.comment);
    });
  }

  protected openRebuyDialog(player: MockSessionPlayer): void {
    const dialogRef = this.dialog.open<RebuyDialogComponent, RebuyDialogData, RebuyDialogResult>(
      RebuyDialogComponent,
      {
        autoFocus: false,
        data: { player },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe((result?: RebuyDialogResult) => {
      if (result && result.amount > 0) {
        this.store.recordRebuy(this.sessionId, player.id, result.amount, result.comment);
      }
    });
  }

  protected openCashOutDialog(player: MockSessionPlayer): void {
    const dialogRef = this.dialog.open<CashOutDialogComponent, CashOutDialogData, number>(
      CashOutDialogComponent,
      {
        autoFocus: 'first-tabbable',
        data: { player },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe((amount?: number) => {
      if (amount !== undefined && amount >= 0) {
        this.store.recordCashOut(this.sessionId, player.id, amount);
      }
    });
  }

  protected openEditBuyInDialog(player: MockSessionPlayer, transaction: MockTransaction): void {
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

    dialogRef.afterClosed().subscribe((result?: EditBuyInDialogResult) => {
      if (!result) {
        return;
      }

      if (result.action === 'delete') {
        this.confirmDeleteBuyIn(player, transaction);
        return;
      }

      if (result.amount > 0) {
        this.store.updateBuyInTransaction(
          this.sessionId,
          transaction.id,
          result.amount,
          result.comment
        );
      }
    });
  }

  private confirmDeleteBuyIn(player: MockSessionPlayer, transaction: MockTransaction): void {
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

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.deleteBuyInTransaction(this.sessionId, transaction.id);
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

  protected buyInTransactions(playerId: string): MockTransaction[] {
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

  protected closeSession(): void {
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
              ? 'Some players have not cashed out yet. You can close anyway, but their cash out will remain pending in this mock session.'
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

      this.store.closeSession(this.sessionId);
      await this.router.navigate(['/host/sessions', this.sessionId, 'summary']);
    });
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  }
}
