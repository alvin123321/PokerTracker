import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import {
  PokerSession,
  SessionPlayer,
  PokerTransaction,
  PokerStoreService,
  RegisteredPlayerOption
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
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Players</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            Manage player logins and review linked buy-ins, cash-outs, and net results.
          </p>
        </div>
        <a
          routerLink="/host/dashboard"
          class="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Dashboard
        </a>
      </div>

      <form class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label class="text-sm font-medium text-neutral-200" for="newPlayerLogin">Add player</label>
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
          class="w-full rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 md:w-auto md:min-w-32"
          (click)="createPlayer()"
        >
          @if (creatingPlayer()) {
            Adding...
          } @else {
            Add Player
          }
        </button>
        <p class="text-xs text-neutral-500 md:col-span-2">Temporary password is 123456.</p>
      </form>

      @if (errorMessage()) {
        <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {{ errorMessage() }}
        </div>
      }

      <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          <div class="border-b border-white/10 px-4 py-3">
            <h2 class="text-lg font-semibold text-white">Registered players</h2>
          </div>

          @if (loadingPlayers()) {
            <div class="p-6 text-sm text-neutral-400">Loading players...</div>
          } @else if (players().length === 0) {
            <div class="p-6 text-sm text-neutral-400">No registered players yet.</div>
          } @else {
            <div class="divide-y divide-white/5">
              @for (player of players(); track player.id) {
                @let totals = totalsFor(player.id);
                <button
                  type="button"
                  class="grid w-full gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04] sm:px-4 sm:py-4 md:grid-cols-[1fr_auto]"
                  [class.ring-1]="selectedPlayerId() === player.id"
                  [class.ring-inset]="selectedPlayerId() === player.id"
                  [class.ring-emerald-300]="selectedPlayerId() === player.id"
                  (click)="selectPlayer(player.id)"
                >
                  <span>
                    <span class="block font-semibold text-white">{{ playerLabel(player) }}</span>
                    <span class="mt-1 hidden text-xs text-neutral-500 sm:block">Login: {{ player.username }}</span>
                  </span>
                  <span class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:min-w-64">
                    <span>
                      <span class="block text-neutral-500">Buy-in</span>
                      <span class="font-semibold text-white">
                        {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    </span>
                    <span class="hidden sm:block">
                      <span class="block text-neutral-500">Cash</span>
                      <span class="font-semibold text-white">
                        {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    </span>
                    <span>
                      <span class="block text-neutral-500">Net</span>
                      <span
                        class="font-semibold"
                        [class.text-emerald-300]="totals.net >= 0"
                        [class.text-red-300]="totals.net < 0"
                      >
                        {{ totals.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    </span>
                  </span>
                </button>
              }
            </div>
          }
        </section>

        <section class="rounded-lg border border-white/10 bg-white/[0.04]">
          @if (selectedPlayer(); as player) {
            @let totals = selectedTotals();
            <div class="border-b border-white/10 p-4">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 class="text-xl font-semibold text-white">{{ playerLabel(player) }}</h2>
                  <p class="mt-1 text-sm text-neutral-400">Login: {{ player.username }}</p>
                </div>
                <button
                  type="button"
                  class="rounded-lg border border-red-300/30 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-400/10"
                  (click)="confirmDeletePlayer(player)"
                >
                  Delete User
                </button>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4 md:grid-cols-5">
              <div class="rounded-lg bg-neutral-950 p-3">
                <p class="text-xs text-neutral-500">Sessions</p>
                <p class="mt-1 text-xl font-semibold text-white">{{ totals.sessions }}</p>
              </div>
              <div class="hidden rounded-lg bg-neutral-950 p-3 md:block">
                <p class="text-xs text-neutral-500">Active</p>
                <p class="mt-1 text-xl font-semibold text-white">{{ totals.activeSessions }}</p>
              </div>
              <div class="rounded-lg bg-neutral-950 p-3">
                <p class="text-xs text-neutral-500">Buy-in</p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                </p>
              </div>
              <div class="hidden rounded-lg bg-neutral-950 p-3 md:block">
                <p class="text-xs text-neutral-500">Cash out</p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                </p>
              </div>
              <div class="rounded-lg bg-neutral-950 p-3">
                <p class="text-xs text-neutral-500">Net</p>
                <p
                  class="mt-1 text-xl font-semibold"
                  [class.text-emerald-300]="totals.net >= 0"
                  [class.text-red-300]="totals.net < 0"
                >
                  {{ totals.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                </p>
              </div>
            </div>

            <div class="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Session detail</h3>
              @for (row of selectedRows(); track row.session.id + row.player.id) {
                <div class="rounded-lg border border-white/10 bg-neutral-950 p-3 sm:p-4">
                  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p class="font-semibold text-white">{{ row.session.name }}</p>
                      <p class="mt-1 text-sm text-neutral-500">
                        {{ row.session.sessionDate | date: 'mediumDate' }} · {{ row.player.status }}
                      </p>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:min-w-72">
                      <span>
                        <span class="block text-neutral-500">Buy-in</span>
                        <span class="font-semibold text-white">
                          {{ row.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                      <span class="hidden sm:block">
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
                  <div class="mt-3 flex flex-wrap gap-2">
                    @for (transaction of row.transactions; track transaction.id) {
                      <span class="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300">
                        {{ transaction.type }} {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </span>
                    }
                  </div>
                </div>
              } @empty {
                <div class="rounded-lg border border-dashed border-white/10 p-6 text-sm text-neutral-500">
                  No linked session records for this player yet.
                </div>
              }
            </div>
          } @else {
            <div class="p-6 text-sm text-neutral-400">Select a player to view details.</div>
          }
        </section>
      </div>
    </section>
  `
})
export class PlayersAdminPage implements OnInit {
  protected readonly store = inject(PokerStoreService);
  private readonly dialog = inject(MatDialog);
  protected readonly players = signal<RegisteredPlayerOption[]>([]);
  protected readonly selectedPlayerId = signal<string | null>(null);
  protected readonly loadingPlayers = signal(false);
  protected readonly creatingPlayer = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly newPlayerLogin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)]
  });

  protected readonly selectedPlayer = computed(() =>
    this.players().find((player) => player.id === this.selectedPlayerId()) ?? null
  );
  protected readonly selectedRows = computed(() =>
    this.rowsForPlayer(this.selectedPlayerId())
  );
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
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.creatingPlayer.set(false);
    }
  }

  protected confirmDeletePlayer(player: RegisteredPlayerOption): void {
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

      try {
        await this.store.deleteRegisteredPlayer(player.id);
        await this.loadPlayers();
      } catch (error) {
        this.errorMessage.set(this.toMessage(error));
      }
    });
  }

  protected selectPlayer(playerId: string): void {
    this.selectedPlayerId.set(playerId);
  }

  protected playerLabel(player: RegisteredPlayerOption): string {
    return player.displayName ?? player.username;
  }

  protected totalsFor(playerId: string): PlayerTotals {
    return this.totalsFromRows(this.rowsForPlayer(playerId));
  }

  private async loadPlayers(preferredPlayerId?: string): Promise<void> {
    this.loadingPlayers.set(true);
    this.errorMessage.set(null);

    try {
      const players = await this.store.listRegisteredPlayers();
      this.players.set(players);
      const nextSelectedId =
        preferredPlayerId ??
        (players.some((player) => player.id === this.selectedPlayerId())
          ? this.selectedPlayerId()
          : players[0]?.id ?? null);
      this.selectedPlayerId.set(nextSelectedId);
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
          .filter((player) => player.userId === playerId)
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
