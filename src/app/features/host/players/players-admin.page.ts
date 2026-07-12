import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  PokerSession,
  PokerStoreService,
  PokerTransaction,
  RegisteredPlayerOption,
  SessionPlayer,
} from '../data/poker-store.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../shared/confirmation-dialog.component';
import { messageFromUnknownError } from '../shared/action-feedback.logic';
import { ActionFeedbackToastComponent } from '../shared/action-feedback-toast.component';

interface PlayerLedgerRow {
  session: PokerSession;
  player: SessionPlayer;
  transactions: PokerTransaction[];
}

@Component({
  selector: 'app-players-admin-page',
  imports: [
    ActionFeedbackToastComponent,
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="space-y-5 sm:space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {{ selectedPlayer() ? playerLabel(selectedPlayer()!) : 'Member' }}
          </h1>
        </div>
      </div>

      @if (actionToast(); as toast) {
        <app-action-feedback-toast [message]="toast.message" [tone]="toast.tone" />
      }

      @if (selectedPlayer(); as player) {
        <section class="member-view-enter space-y-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Back to member list"
                title="Back to member list"
                class="pokertrack-icon-button pokertrack-icon-button-neutral"
                (click)="showPlayerList()"
              >
                <span aria-hidden="true" class="text-2xl leading-none">&larr;</span>
                <span class="sr-only">Back to member list</span>
              </button>

              <div class="min-w-0 flex-1">
                <p class="truncate text-lg font-semibold text-white">{{ playerLabel(player) }}</p>
                <p class="mt-1 text-sm text-neutral-400">
                  Login ID
                  <span class="ml-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 font-mono text-emerald-100">
                    {{ player.username }}
                  </span>
                </p>
              </div>

              <div class="member-action-menu-wrap">
                <button
                  type="button"
                  [disabled]="isAnyPlayerActionPending(player)"
                  aria-label="Member actions"
                  title="Member actions"
                  class="member-action-trigger"
                  (click)="toggleMemberActionMenu(player.id)"
                >
                  @if (isAnyPlayerActionPending(player)) {
                    <span class="action-spinner" aria-hidden="true"></span>
                  } @else {
                    <span aria-hidden="true">...</span>
                  }
                </button>

                @if (isMemberActionMenuOpen(player.id)) {
                  <div class="member-action-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      [disabled]="roleUpdatingPlayerId() === player.id || isDeletingAnyPlayer()"
                      class="member-action-menu-item"
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
                      role="menuitem"
                      [disabled]="passwordResettingPlayerId() === player.id || isDeletingAnyPlayer()"
                      class="member-action-menu-item member-action-menu-item-sky"
                      (click)="confirmResetPassword(player)"
                    >
                      @if (passwordResettingPlayerId() === player.id) {
                        <span class="action-spinner" aria-hidden="true"></span>
                        Resetting...
                      } @else {
                        Reset Password
                      }
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      [disabled]="isDeletingAnyPlayer()"
                      class="member-action-menu-item member-action-menu-item-danger"
                      (click)="confirmDeletePlayer(player)"
                    >
                      @if (isDeletingPlayer(player.id)) {
                        <span class="action-spinner" aria-hidden="true"></span>
                        Deleting...
                      } @else {
                        Delete
                      }
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <section class="rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="border-b border-white/10 px-4 py-3">
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Session detail</h3>
            </div>
            <div class="space-y-3 p-3 sm:p-4">
              @for (row of selectedRows(); track ledgerRowKey(row)) {
                <article class="overflow-hidden rounded-lg border border-white/10 bg-neutral-950">
                  <button
                    type="button"
                    class="grid w-full gap-4 p-3 text-center transition hover:bg-white/[0.035] sm:p-4"
                    [attr.aria-expanded]="isLedgerRowExpanded(row)"
                    (click)="toggleLedgerRow(row)"
                  >
                    <span class="grid gap-1">
                      <span class="truncate text-lg font-semibold text-white">{{ row.session.name }}</span>
                      <span class="text-sm text-neutral-500">{{ row.session.sessionDate | date: 'mediumDate' }}</span>
                    </span>

                    <span class="grid grid-cols-3 gap-2 text-sm">
                      <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                        <span class="block text-neutral-500">Buy-in</span>
                        <span class="font-semibold text-white">
                          {{ row.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                      <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                        <span class="block text-neutral-500">Cash</span>
                        <span class="font-semibold text-white">
                          {{ row.player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                      <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                        <span class="block text-neutral-500">Net</span>
                        <span
                          class="font-semibold"
                          [class.text-emerald-300]="row.player.net >= 0"
                          [class.text-red-300]="row.player.net < 0"
                        >
                          {{ row.player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      </span>
                    </span>
                  </button>

                  <div
                    class="member-ledger-panel"
                    [class.member-ledger-panel-open]="isLedgerRowExpanded(row)"
                    [attr.aria-hidden]="!isLedgerRowExpanded(row)"
                    [attr.inert]="isLedgerRowExpanded(row) ? null : ''"
                  >
                    <div class="member-ledger-panel-inner border-t border-white/10 bg-white/[0.02] p-3 sm:p-4">
                      <div class="space-y-2">
                        @for (transaction of row.transactions; track transaction.id) {
                          <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <span
                              class="h-3 w-3 rounded-full"
                              [class.bg-emerald-300]="transaction.type === 'BUYIN'"
                              [class.bg-sky-300]="transaction.type === 'REBUY'"
                              [class.bg-amber-300]="transaction.type === 'CASHOUT'"
                            ></span>
                            <span class="min-w-0 text-left">
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
                            No buy-in records for this session.
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </article>
              } @empty {
                <div class="rounded-lg border border-dashed border-white/10 p-6 text-sm text-neutral-500">
                  No linked session records for this player yet.
                </div>
              }
            </div>
          </section>
        </section>
      } @else {
        <section class="member-view-enter space-y-4">
          <form class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label class="text-sm font-medium text-neutral-200" for="newPlayerLogin">Add Member</label>
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
                Add Member
              }
            </button>
          </form>

          <section class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <div class="grid gap-3 border-b border-white/10 p-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 class="text-lg font-semibold text-white">Member list</h2>
                <p class="mt-1 text-sm text-neutral-500">{{ filteredPlayers().length }} members</p>
              </div>
              <label class="block md:w-80" for="playerSearch">
                <span class="sr-only">Search members</span>
                <input
                  id="playerSearch"
                  [formControl]="searchControl"
                  class="w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300"
                  placeholder="Search name"
                />
              </label>
            </div>

            @if (loadingPlayers()) {
              <div class="p-6 text-sm text-neutral-400">Loading members...</div>
            } @else if (filteredPlayers().length === 0) {
              <div class="p-6 text-sm text-neutral-400">No members match your search.</div>
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

      .member-view-enter {
        animation: member-view-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .member-action-menu-wrap {
        position: relative;
        display: inline-flex;
        justify-content: flex-end;
      }

      .member-action-trigger {
        display: inline-flex;
        width: 2.75rem;
        height: 2.75rem;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 0.7rem;
        background: rgba(10, 10, 10, 0.38);
        color: rgb(229, 229, 229);
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        transition: border-color 160ms ease, background 160ms ease, color 160ms ease,
          transform 160ms ease;
      }

      .member-action-trigger:hover {
        border-color: rgba(110, 231, 183, 0.48);
        background: rgba(16, 185, 129, 0.1);
        color: rgb(209, 250, 229);
        transform: translateY(-1px);
      }

      .member-action-trigger:disabled {
        cursor: not-allowed;
        opacity: 0.55;
        transform: none;
      }

      .member-action-menu {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        z-index: 30;
        display: grid;
        min-width: 12.5rem;
        gap: 0.35rem;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 0.75rem;
        background: rgb(10, 10, 10);
        padding: 0.45rem;
        box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.38);
        animation: member-menu-in 160ms ease-out both;
      }

      .member-action-menu-item {
        display: inline-flex;
        min-height: 2.55rem;
        align-items: center;
        justify-content: flex-start;
        gap: 0.55rem;
        border-radius: 0.55rem;
        padding: 0.65rem 0.75rem;
        color: rgb(209, 250, 229);
        font-size: 0.86rem;
        font-weight: 700;
        text-align: left;
        transition: background 150ms ease, color 150ms ease;
      }

      .member-action-menu-item:hover {
        background: rgba(16, 185, 129, 0.12);
        color: white;
      }

      .member-action-menu-item:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .member-action-menu-item-sky {
        color: rgb(186, 230, 253);
      }

      .member-action-menu-item-sky:hover {
        background: rgba(14, 165, 233, 0.12);
      }

      .member-action-menu-item-danger {
        color: rgb(254, 202, 202);
      }

      .member-action-menu-item-danger:hover {
        background: rgba(248, 113, 113, 0.12);
      }

      .member-ledger-panel {
        display: grid;
        grid-template-rows: 0fr;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: grid-template-rows 280ms ease-in-out, opacity 220ms ease-in-out,
          visibility 0ms linear 280ms;
      }

      .member-ledger-panel-open {
        grid-template-rows: 1fr;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition: grid-template-rows 280ms ease-in-out, opacity 220ms ease-in-out;
      }

      .member-ledger-panel-inner {
        min-height: 0;
        overflow: hidden;
        transform: translateY(-0.25rem);
        transition: padding 260ms ease-in-out, transform 260ms ease-in-out,
          border-color 260ms ease-in-out;
      }

      .member-ledger-panel-open .member-ledger-panel-inner {
        transform: translateY(0);
      }

      .member-ledger-panel:not(.member-ledger-panel-open) .member-ledger-panel-inner {
        border-width: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      @keyframes member-view-enter {
        from {
          opacity: 0;
          transform: translateY(0.5rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes member-toast-in {
        from {
          opacity: 0;
          transform: translateY(0.45rem) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes member-menu-in {
        from {
          opacity: 0;
          transform: translateY(-0.25rem) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes action-spinner {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PlayersAdminPage implements OnInit, OnDestroy {
  protected readonly store = inject(PokerStoreService);
  private readonly dialog = inject(MatDialog);
  protected readonly players = signal<RegisteredPlayerOption[]>([]);
  protected readonly selectedPlayerId = signal<string | null>(null);
  protected readonly loadingPlayers = signal(false);
  protected readonly creatingPlayer = signal(false);
  protected readonly deletingPlayerId = signal<string | null>(null);
  protected readonly roleUpdatingPlayerId = signal<string | null>(null);
  protected readonly passwordResettingPlayerId = signal<string | null>(null);
  protected readonly openMemberActionMenuId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly actionToast = computed<{ message: string; tone: 'success' | 'error' } | null>(
    () => {
      const errorMessage = this.errorMessage();

      if (errorMessage) {
        return { message: errorMessage, tone: 'error' };
      }

      const successMessage = this.successMessage();

      return successMessage ? { message: successMessage, tone: 'success' } : null;
    }
  );
  protected readonly expandedLedgerRowKey = signal<string | null | undefined>(undefined);
  private receiptTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly newPlayerLogin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
  });
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, {
    initialValue: '',
  });

  protected readonly filteredPlayers = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase();
    const sortedPlayers = [...this.players()].sort((a, b) =>
      this.playerLabel(a).localeCompare(this.playerLabel(b), undefined, {
        sensitivity: 'base',
        numeric: true,
      })
    );

    if (!search) {
      return sortedPlayers;
    }

    return sortedPlayers.filter((player) =>
      `${player.displayName ?? ''} ${player.username}`.toLocaleLowerCase().includes(search)
    );
  });
  protected readonly selectedPlayer = computed(
    () => this.players().find((player) => player.id === this.selectedPlayerId()) ?? null
  );
  protected readonly selectedRows = computed(() => this.rowsForPlayer(this.selectedPlayerId()));

  async ngOnInit(): Promise<void> {
    await this.loadPlayers();
  }

  ngOnDestroy(): void {
    if (this.receiptTimer) {
      clearTimeout(this.receiptTimer);
      this.receiptTimer = null;
    }
  }

  protected async createPlayer(): Promise<void> {
    if (this.newPlayerLogin.invalid || this.creatingPlayer()) {
      this.newPlayerLogin.markAsTouched();
      return;
    }

    this.creatingPlayer.set(true);
    this.clearActionReceipt();

    try {
      const player = await this.store.createRegisteredPlayer(this.newPlayerLogin.value);
      this.newPlayerLogin.reset();
      await this.loadPlayers(player.id);
      this.selectedPlayerId.set(player.id);
      this.showActionReceipt('Member added.', 'success');
    } catch (error) {
      this.showActionReceipt(this.toMessage(error), 'error');
    } finally {
      this.creatingPlayer.set(false);
    }
  }

  protected confirmDeletePlayer(player: RegisteredPlayerOption): void {
    if (this.isDeletingAnyPlayer()) {
      return;
    }

    this.openMemberActionMenuId.set(null);

    const dialogRef = this.dialog.open<
      ConfirmationDialogComponent,
      ConfirmationDialogData,
      boolean
    >(ConfirmationDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete player user?',
        message:
          'This deletes the player login account. Existing poker records stay in session history but will no longer be linked to a player login.',
        confirmLabel: 'Delete user',
        tone: 'danger',
        details: [this.playerLabel(player), `Login: ${player.username}`],
      },
      panelClass: 'pokertrack-dialog-panel',
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      this.deletingPlayerId.set(player.id);
      this.clearActionReceipt();

      try {
        await this.store.deleteRegisteredPlayer(player.id);
        this.selectedPlayerId.set(null);
        await this.loadPlayers();
        this.showActionReceipt('Member deleted.', 'success');
      } catch (error) {
        this.showActionReceipt(this.toMessage(error), 'error');
      } finally {
        this.deletingPlayerId.set(null);
      }
    });
  }

  protected confirmResetPassword(player: RegisteredPlayerOption): void {
    if (this.passwordResettingPlayerId() || this.isDeletingAnyPlayer()) {
      return;
    }

    this.openMemberActionMenuId.set(null);

    const dialogRef = this.dialog.open<
      ConfirmationDialogComponent,
      ConfirmationDialogData,
      boolean
    >(ConfirmationDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Reset password?',
        message: 'This resets the player login password to 123456.',
        confirmLabel: 'Reset password',
        tone: 'primary',
        details: [this.playerLabel(player), `Login ID: ${player.username}`],
      },
      panelClass: 'pokertrack-dialog-panel',
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      this.passwordResettingPlayerId.set(player.id);
      this.clearActionReceipt();

      try {
        const temporaryPassword = await this.store.resetRegisteredPlayerPassword(player.id);
        this.showActionReceipt(`Password reset to ${temporaryPassword}.`, 'success');
      } catch (error) {
        this.showActionReceipt(this.toMessage(error), 'error');
      } finally {
        this.passwordResettingPlayerId.set(null);
      }
    });
  }

  protected async toggleManagerRole(player: RegisteredPlayerOption): Promise<void> {
    if (this.roleUpdatingPlayerId() || this.isDeletingAnyPlayer()) {
      return;
    }

    this.openMemberActionMenuId.set(null);

    const nextRole = player.role === 'MANAGER' ? 'PLAYER' : 'MANAGER';
    this.roleUpdatingPlayerId.set(player.id);
    this.clearActionReceipt();

    try {
      await this.store.setRegisteredPlayerRole(player.id, nextRole);
      await this.loadPlayers(player.id);
      this.showActionReceipt(
        nextRole === 'MANAGER' ? 'Manager access saved.' : 'Player access saved.',
        'success'
      );
    } catch (error) {
      this.showActionReceipt(this.toMessage(error), 'error');
    } finally {
      this.roleUpdatingPlayerId.set(null);
    }
  }

  protected selectPlayer(playerId: string): void {
    this.expandedLedgerRowKey.set(undefined);
    this.openMemberActionMenuId.set(null);
    this.selectedPlayerId.set(playerId);
    this.scrollToPageTop();
  }

  protected showPlayerList(): void {
    this.expandedLedgerRowKey.set(undefined);
    this.openMemberActionMenuId.set(null);
    this.selectedPlayerId.set(null);
    this.scrollToPageTop();
  }

  protected toggleMemberActionMenu(playerId: string): void {
    this.openMemberActionMenuId.update((currentPlayerId) =>
      currentPlayerId === playerId ? null : playerId
    );
  }

  protected isMemberActionMenuOpen(playerId: string): boolean {
    return this.openMemberActionMenuId() === playerId;
  }

  protected isAnyPlayerActionPending(player: RegisteredPlayerOption): boolean {
    return (
      this.roleUpdatingPlayerId() === player.id ||
      this.passwordResettingPlayerId() === player.id ||
      this.isDeletingPlayer(player.id)
    );
  }

  protected ledgerRowKey(row: PlayerLedgerRow): string {
    return `${row.session.id}:${row.player.id}`;
  }

  protected isLedgerRowExpanded(row: PlayerLedgerRow): boolean {
    const expandedKey = this.expandedLedgerRowKey();

    if (expandedKey === undefined) {
      return this.firstLedgerRowKey() === this.ledgerRowKey(row);
    }

    return expandedKey === this.ledgerRowKey(row);
  }

  protected toggleLedgerRow(row: PlayerLedgerRow): void {
    const key = this.ledgerRowKey(row);
    const expandedKey = this.expandedLedgerRowKey();
    const isDefaultOpen = expandedKey === undefined && this.firstLedgerRowKey() === key;
    const isOpen = expandedKey === key || isDefaultOpen;

    this.expandedLedgerRowKey.set(isOpen ? null : key);
  }

  private firstLedgerRowKey(): string | null {
    const firstRow = this.selectedRows()[0];

    return firstRow ? this.ledgerRowKey(firstRow) : null;
  }

  private scrollToPageTop(): void {
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    });
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
    this.clearActionReceipt();

    try {
      const players = await this.store.listRegisteredPlayers();
      this.players.set(players);

      if (preferredPlayerId && players.some((player) => player.id === preferredPlayerId)) {
        this.selectedPlayerId.set(preferredPlayerId);
      } else if (!players.some((player) => player.id === this.selectedPlayerId())) {
        this.selectedPlayerId.set(null);
      }
    } catch (error) {
      this.showActionReceipt(this.toMessage(error), 'error');
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
            (player) =>
              player.userId === playerId || this.localRegisteredPlayerId(player.name) === playerId
          )
          .map((player) => ({
            session,
            player,
            transactions: session.transactions.filter(
              (transaction) => transaction.playerId === player.id
            ),
          }))
      )
      .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate));
  }

  private localRegisteredPlayerId(name: string): string {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    return `local-player-${normalized.length >= 2 ? normalized : 'player'}`;
  }

  private toMessage(error: unknown): string {
    return messageFromUnknownError(error, 'Unable to update the player directory.');
  }

  private showActionReceipt(message: string, tone: 'success' | 'error'): void {
    if (this.receiptTimer) {
      clearTimeout(this.receiptTimer);
      this.receiptTimer = null;
    }

    if (tone === 'success') {
      this.errorMessage.set(null);
      this.successMessage.set(message);
    } else {
      this.successMessage.set(null);
      this.errorMessage.set(message);
    }

    this.receiptTimer = setTimeout(
      () => {
        this.clearActionReceipt();
        this.receiptTimer = null;
      },
      tone === 'error' ? 4300 : 2700
    );
  }

  private clearActionReceipt(): void {
    if (this.receiptTimer) {
      clearTimeout(this.receiptTimer);
      this.receiptTimer = null;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
