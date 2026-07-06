import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import {
  PokerSession,
  PokerStoreService,
  PokerTransaction,
  RegisteredPlayerOption,
  SessionPlayer
} from '../data/poker-store.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../shared/confirmation-dialog.component';

interface PlayerLedgerRow {
  session: PokerSession;
  player: SessionPlayer;
  transactions: PokerTransaction[];
}

interface PlayerTotals {
  sessions: number;
  activeSessions: number;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
}

@Component({
  selector: 'app-players-admin-page',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="space-y-5 sm:space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-medium uppercase text-emerald-300">Admin</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {{ selectedPlayer() ? playerLabel(selectedPlayer()!) : 'Players' }}
          </h1>
        </div>
        <a
          routerLink="/host/dashboard"
          class="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Dashboard
        </a>
      </div>

      @if (errorMessage()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ errorMessage() }}
        </div>
      }

      @if (selectedPlayer(); as player) {
        @let totals = selectedTotals();
        <section class="space-y-4">
          <button
            type="button"
            aria-label="Back to players"
            title="Back to players"
            class="pokertrack-icon-button pokertrack-icon-button-neutral"
            (click)="showPlayerList()"
          >
            <span aria-hidden="true" class="text-2xl leading-none">&larr;</span>
            <span class="sr-only">Back to players</span>
          </button>

          <div class="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-xl font-semibold text-white">{{ playerLabel(player) }}</h2>
                <span
                  class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                  [class.border-emerald-300/40]="player.role === 'MANAGER'"
                  [class.text-emerald-200]="player.role === 'MANAGER'"
                  [class.border-white/10]="player.role !== 'MANAGER'"
                  [class.text-neutral-400]="player.role !== 'MANAGER'"
                >
                  {{ player.role === 'MANAGER' ? 'Manager' : 'Player' }}
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                [disabled]="roleUpdatingPlayerId() === player.id || isDeletingAnyPlayer()"
                class="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-emerald-300/30 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                (click)="toggleManagerRole(player)"
              >
                @if (roleUpdatingPlayerId() === player.id) {
                  <span class="action-spinner" aria-hidden="true"></span>
                  Saving...
                } @else if (player.role === 'MANAGER') {
                  Make Player
                } @else {
                  Make Manager
                }
              </button>
              <button
                type="button"
                [disabled]="isDeletingAnyPlayer()"
                aria-label="Delete player"
                title="Delete player"
                class="pokertrack-icon-button"
                (click)="confirmDeletePlayer(player)"
              >
                @if (isDeletingPlayer(player.id)) {
                  <span class="action-spinner" aria-hidden="true"></span>
                  <span class="sr-only">Deleting player</span>
                } @else {
                  <span class="trash-icon" aria-hidden="true"></span>
                  <span class="sr-only">Delete player</span>
                }
              </button>
            </div>
          </div>

          <div class="grid gap-2 sm:grid-cols-3 sm:gap-3">
            <div class="grid min-h-28 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-4 text-center shadow-lg shadow-emerald-950/10">
              <p class="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-100">
                <span aria-hidden="true">🎟️</span>
                Buy-in
              </p>
              <p class="mt-2 text-3xl font-semibold text-white">
                {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="grid min-h-28 place-items-center rounded-lg border border-amber-300/15 bg-amber-400/[0.06] p-4 text-center shadow-lg shadow-amber-950/10">
              <p class="flex items-center justify-center gap-2 text-sm font-semibold text-amber-100">
                <span aria-hidden="true">💵</span>
                Cash
              </p>
              <p class="mt-2 text-3xl font-semibold text-white">
                {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
            <div class="grid min-h-28 place-items-center rounded-lg border border-sky-300/15 bg-sky-400/[0.06] p-4 text-center shadow-lg shadow-sky-950/10">
              <p class="flex items-center justify-center gap-2 text-sm font-semibold text-sky-100">
                <span aria-hidden="true">{{ totals.net >= 0 ? '📈' : '📉' }}</span>
                Net
              </p>
              <p
                class="mt-2 text-3xl font-semibold"
                [class.text-emerald-300]="totals.net >= 0"
                [class.text-red-300]="totals.net < 0"
              >
                {{ totals.net | currency: 'USD' : 'symbol' : '1.0-0' }}
              </p>
            </div>
          </div>

          <section class="rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="border-b border-white/10 px-4 py-3">
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Session detail</h3>
            </div>
            <div class="space-y-3 p-3 sm:p-4">
              @for (row of selectedRows(); track row.session.id + row.player.id) {
                <div class="rounded-lg border border-white/10 bg-neutral-950 p-3 sm:p-4">
                  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p class="font-semibold text-white">{{ row.session.name }}</p>
                      <p class="mt-1 text-sm text-neutral-500">
                        {{ row.session.sessionDate | date: 'mediumDate' }} - {{ row.player.status }}
                      </p>
                    </div>
                    <div class="grid grid-cols-3 gap-3 text-sm md:min-w-72">
                      <span>
                        <span class="block text-neutral-500">Buy-in</span>
                        <span class="font-semibold text-white">
                          {{ row.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                      <span>
                        <span class="block text-neutral-500">Cash</span>
                        <span class="font-semibold text-white">
                          {{ row.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                      <span>
                        <span class="block text-neutral-500">Net</span>
                        <span
                          class="font-semibold"
                          [class.text-emerald-300]="row.player.net >= 0"
                          [class.text-red-300]="row.player.net < 0"
                        >
                          {{ row.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div class="mt-4 space-y-2">
                    @for (transaction of row.transactions; track transaction.id) {
                      <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
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
                    }
                  </div>
                </div>
              } @empty {
                <div class="rounded-lg border border-dashed border-white/10 p-6 text-sm text-neutral-500">
                  No linked session records for this player yet.
                </div>
              }
            </div>
          </section>
        </section>
      } @else {
        <section class="space-y-4">
          <form class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label class="text-sm font-medium text-neutral-200" for="newPlayerLogin">Add Player</label>
              <input
                id="newPlayerLogin"
                [formControl]="newPlayerLogin"
                class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="Player A"
              />
            </div>
            <button
              type="button"
              [disabled]="newPlayerLogin.invalid || creatingPlayer()"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 md:w-auto md:min-w-36"
              (click)="createPlayer()"
            >
              @if (creatingPlayer()) {
                <span class="action-spinner" aria-hidden="true"></span>
                Adding...
              } @else {
                Add Player
              }
            </button>
          </form>

          <section class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="grid gap-3 border-b border-white/10 p-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 class="text-lg font-semibold text-white">Player list</h2>
                <p class="mt-1 text-sm text-neutral-500">{{ filteredPlayers().length }} players</p>
              </div>
              <label class="block md:w-80" for="playerSearch">
                <span class="sr-only">Search players</span>
                <input
                  id="playerSearch"
                  [formControl]="searchControl"
                  class="w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300"
                  placeholder="Search name"
                />
              </label>
            </div>

            @if (loadingPlayers()) {
              <div class="p-6 text-sm text-neutral-400">Loading players...</div>
            } @else if (filteredPlayers().length === 0) {
              <div class="p-6 text-sm text-neutral-400">No players match your search.</div>
            } @else {
              <div class="grid gap-2 p-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))] sm:gap-3 sm:p-4">
                @for (player of filteredPlayers(); track player.id) {
                  <button
                    type="button"
                    class="group grid min-h-20 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 text-left transition hover:border-emerald-300/30 hover:bg-white/[0.05]"
                    (click)="selectPlayer(player.id)"
                  >
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-semibold text-emerald-200 transition group-hover:border-emerald-300/30">
                      {{ playerInitial(player) }}
                    </span>
                    <span class="min-w-0">
                      <span class="block truncate font-semibold text-white">{{ playerLabel(player) }}</span>
                    </span>
                    <span
                      class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                      [class.border-emerald-300/40]="player.role === 'MANAGER'"
                      [class.text-emerald-200]="player.role === 'MANAGER'"
                      [class.border-white/10]="player.role !== 'MANAGER'"
                      [class.text-neutral-400]="player.role !== 'MANAGER'"
                    >
                      {{ player.role === 'MANAGER' ? 'Manager' : 'Player' }}
                    </span>
                  </button>
                }
              </div>
            }
          </section>
        </section>
      }
    </section>
  `,
  styles: [
    `
      .action-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 9999px;
        animation: action-spinner 700ms linear infinite;
      }

      @keyframes action-spinner {
        to {
          transform: rotate(360deg);
        }
      }
    `
  ]
})
export class PlayersAdminPage implements OnInit {
  protected readonly store = inject(PokerStoreService);
  private readonly dialog = inject(MatDialog);
  protected readonly players = signal<RegisteredPlayerOption[]>([]);
  protected readonly selectedPlayerId = signal<string | null>(null);
  protected readonly loadingPlayers = signal(false);
  protected readonly creatingPlayer = signal(false);
  protected readonly deletingPlayerId = signal<string | null>(null);
  protected readonly roleUpdatingPlayerId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly newPlayerLogin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)]
  });
  protected readonly searchControl = new FormControl('', {
    nonNullable: true
  });
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, {
    initialValue: ''
  });

  protected readonly filteredPlayers = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase();
    const sortedPlayers = [...this.players()].sort((a, b) =>
      this.playerLabel(a).localeCompare(this.playerLabel(b), undefined, {
        sensitivity: 'base',
        numeric: true
      })
    );

    if (!search) {
      return sortedPlayers;
    }

    return sortedPlayers.filter((player) =>
      `${player.displayName ?? ''} ${player.username}`.toLocaleLowerCase().includes(search)
    );
  });
  protected readonly selectedPlayer = computed(() =>
    this.players().find((player) => player.id === this.selectedPlayerId()) ?? null
  );
  protected readonly selectedRows = computed(() => this.rowsForPlayer(this.selectedPlayerId()));
  protected readonly selectedTotals = computed(() => this.totalsFromRows(this.selectedRows()));

  async ngOnInit(): Promise<void> {
    await this.loadPlayers();
  }

  protected async createPlayer(): Promise<void> {
    if (this.newPlayerLogin.invalid || this.creatingPlayer()) {
      this.newPlayerLogin.markAsTouched();
      return;
    }

    this.creatingPlayer.set(true);
    this.errorMessage.set(null);

    try {
      const player = await this.store.createRegisteredPlayer(this.newPlayerLogin.value);
      this.newPlayerLogin.reset();
      await this.loadPlayers(player.id);
      this.selectedPlayerId.set(player.id);
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.creatingPlayer.set(false);
    }
  }

  protected confirmDeletePlayer(player: RegisteredPlayerOption): void {
    if (this.isDeletingAnyPlayer()) {
      return;
    }

    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Delete player user?',
          message:
            'This deletes the player login account. Existing poker records stay in session history but will no longer be linked to a player login.',
          confirmLabel: 'Delete user',
          tone: 'danger',
          details: [this.playerLabel(player), `Login: ${player.username}`]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      this.deletingPlayerId.set(player.id);
      this.errorMessage.set(null);

      try {
        await this.store.deleteRegisteredPlayer(player.id);
        this.selectedPlayerId.set(null);
        await this.loadPlayers();
      } catch (error) {
        this.errorMessage.set(this.toMessage(error));
      } finally {
        this.deletingPlayerId.set(null);
      }
    });
  }

  protected async toggleManagerRole(player: RegisteredPlayerOption): Promise<void> {
    if (this.roleUpdatingPlayerId() || this.isDeletingAnyPlayer()) {
      return;
    }

    const nextRole = player.role === 'MANAGER' ? 'PLAYER' : 'MANAGER';
    this.roleUpdatingPlayerId.set(player.id);
    this.errorMessage.set(null);

    try {
      await this.store.setRegisteredPlayerRole(player.id, nextRole);
      await this.loadPlayers(player.id);
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.roleUpdatingPlayerId.set(null);
    }
  }

  protected selectPlayer(playerId: string): void {
    this.selectedPlayerId.set(playerId);
  }

  protected showPlayerList(): void {
    this.selectedPlayerId.set(null);
  }

  protected playerLabel(player: RegisteredPlayerOption): string {
    return player.displayName ?? player.username;
  }

  protected playerInitial(player: RegisteredPlayerOption): string {
    return this.playerLabel(player).trim().charAt(0).toLocaleUpperCase() || '?';
  }

  protected isDeletingAnyPlayer(): boolean {
    return this.deletingPlayerId() !== null;
  }

  protected isDeletingPlayer(playerId: string): boolean {
    return this.deletingPlayerId() === playerId;
  }

  private async loadPlayers(preferredPlayerId?: string): Promise<void> {
    this.loadingPlayers.set(true);
    this.errorMessage.set(null);

    try {
      const players = await this.store.listRegisteredPlayers();
      this.players.set(players);

      if (preferredPlayerId && players.some((player) => player.id === preferredPlayerId)) {
        this.selectedPlayerId.set(preferredPlayerId);
      } else if (!players.some((player) => player.id === this.selectedPlayerId())) {
        this.selectedPlayerId.set(null);
      }
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.loadingPlayers.set(false);
    }
  }

  private rowsForPlayer(playerId: string | null): PlayerLedgerRow[] {
    if (!playerId) {
      return [];
    }

    return this.store
      .sessions()
      .flatMap((session) =>
        session.players
          .filter(
            (player) => player.userId === playerId || this.localRegisteredPlayerId(player.name) === playerId
          )
          .map((player) => ({
            session,
            player,
            transactions: session.transactions.filter((transaction) => transaction.playerId === player.id)
          }))
      )
      .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate));
  }

  private totalsFromRows(rows: PlayerLedgerRow[]): PlayerTotals {
    return {
      sessions: rows.length,
      activeSessions: rows.filter((row) => row.player.status === 'ACTIVE').length,
      totalBuyIn: rows.reduce((sum, row) => sum + row.player.totalBuyIn, 0),
      totalCashOut: rows.reduce((sum, row) => sum + row.player.cashOut, 0),
      net: rows.reduce((sum, row) => sum + row.player.net, 0)
    };
  }

  private localRegisteredPlayerId(name: string): string {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    return `local-player-${normalized.length >= 3 ? normalized : 'player'}`;
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.hasMessage(error)) {
      return error.message;
    }

    return 'Unable to update the player directory.';
  }

  private hasMessage(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }
}
