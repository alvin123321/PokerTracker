import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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

interface TableNameDialogData {
  tableName: string;
}

@Component({
  selector: 'app-table-name-dialog',
  imports: [ReactiveFormsModule],
  template: `
    <section class="w-[min(92vw,26rem)] bg-neutral-950 p-5 text-neutral-50">
      <div>
        <h2 class="text-xl font-semibold text-white">New Table</h2>
        <p class="mt-1 text-sm text-neutral-400">Name this table before adding players.</p>
      </div>

      <label class="mt-5 block text-sm font-medium text-neutral-200" for="tableName">Table name</label>
      <input
        id="tableName"
        [formControl]="tableName"
        class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
        placeholder="Main Table"
        (keydown.enter)="save()"
      />

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
          (click)="dialogRef.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          [disabled]="tableName.invalid"
          class="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="save()"
        >
          Create
        </button>
      </div>
    </section>
  `
})
class TableNameDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<TableNameDialogComponent, string | undefined>);
  private readonly data = inject<TableNameDialogData>(MAT_DIALOG_DATA);
  protected readonly tableName = new FormControl(this.data.tableName, {
    nonNullable: true,
    validators: [Validators.required]
  });

  protected save(): void {
    if (this.tableName.invalid) {
      this.tableName.markAsTouched();
      return;
    }

    this.dialogRef.close(this.tableName.value.trim());
  }
}

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
            <p class="mt-1 text-sm text-neutral-400">Syncing before controls unlock.</p>
          </div>
        </div>
      }

      @if (store.activeSessions().length === 0) {
        <section class="grid min-h-[45vh] place-items-center">
          <a
            routerLink="/host/sessions/new"
            class="inline-flex min-h-14 min-w-56 items-center justify-center rounded-lg bg-emerald-400 px-7 text-base font-semibold text-neutral-950 shadow-[0_0_28px_rgba(52,211,153,0.22)] transition hover:bg-emerald-300"
          >
            Create New Session
          </a>
        </section>
      } @else {
        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <span class="dashboard-table-icon" aria-hidden="true"></span>
            <h2 class="truncate text-xl font-semibold text-white">Active Sessions</h2>
          </div>

          <div class="grid gap-4">
            @for (session of store.activeSessions(); track session.id) {
              @let totals = store.totalsFor(session);
              <article class="session-overview-card overflow-hidden rounded-lg border border-emerald-300/25 bg-neutral-950/65 shadow-[0_0_28px_rgba(0,0,0,0.25)] ring-1 ring-emerald-300/10">
                <button
                  type="button"
                  class="w-full p-4 text-left transition hover:bg-white/[0.035] sm:p-5"
                  [attr.aria-expanded]="isSessionExpanded(session.id)"
                  (click)="toggleSession(session.id)"
                >
                  <span class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <span class="min-w-0">
                      <span class="flex flex-wrap items-center gap-3">
                        <span class="truncate text-2xl font-semibold text-white">{{ session.name }}</span>
                        <span class="rounded-full border border-emerald-300/35 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.12)]">
                          {{ session.tables.length }} table{{ session.tables.length === 1 ? '' : 's' }}
                        </span>
                      </span>
                      <span class="mt-2 block text-sm text-neutral-400">
                        {{ session.sessionDate | date: 'mediumDate' }}
                      </span>
                    </span>

                    <span class="grid grid-cols-3 gap-2 text-center text-sm lg:min-w-[30rem]">
                      <span class="dashboard-stat">
                        <span class="dashboard-stat-icon dashboard-stat-icon-players" aria-hidden="true"></span>
                        <span class="dashboard-stat-copy">
                          <span class="dashboard-stat-value">{{ session.tables.length }}</span>
                          <span class="dashboard-stat-label">Tables</span>
                        </span>
                      </span>
                      <span class="dashboard-stat">
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
                      </span>
                      <span class="dashboard-stat">
                        <span class="dashboard-stat-icon dashboard-stat-icon-cashed" aria-hidden="true"></span>
                        <span class="dashboard-stat-copy">
                          <span class="dashboard-stat-value">
                            {{ totals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                          </span>
                          <span class="dashboard-stat-label">Cash out</span>
                        </span>
                      </span>
                    </span>
                  </span>
                </button>

                <div class="border-t border-white/10 px-4 pb-4 sm:px-5 sm:pb-5">
                  <button
                    type="button"
                    [disabled]="isBusy()"
                    class="mt-4 w-full rounded-lg border border-emerald-300/30 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50 sm:mx-auto sm:block sm:max-w-xs"
                    (click)="createTable(session.id); $event.stopPropagation()"
                  >
                    <span aria-hidden="true" class="mr-2">+</span>
                    @if (isPending(tableAction('add-table', session.id))) {
                      Creating...
                    } @else {
                      Add Table
                    }
                  </button>
                </div>

                <div
                  class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
                  [style.grid-template-rows]="isSessionExpanded(session.id) ? '1fr' : '0fr'"
                  [style.pointer-events]="isSessionExpanded(session.id) ? 'auto' : 'none'"
                >
                  <div class="min-h-0">
                    <div
                      class="border-t border-white/10 p-4 opacity-0 transition-opacity duration-300 ease-in-out sm:p-5"
                      [class.opacity-100]="isSessionExpanded(session.id)"
                    >
                      @if (session.tables.length === 0) {
                        <div class="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">
                          No active tables yet.
                        </div>
                      } @else {
                        <div class="grid gap-3">
                          @for (table of session.tables; track table.id) {
                            @let tableTotals = store.totalsForTable(session, table.id);
                            <article
                              class="table-shell relative overflow-hidden rounded-lg border bg-neutral-950/70 shadow-[0_16px_34px_rgba(0,0,0,0.22)] ring-1"
                              [class.table-shell-cyan]="tableAccent(table.tableNumber) === 'cyan'"
                              [class.table-shell-amber]="tableAccent(table.tableNumber) === 'amber'"
                              [class.table-shell-fuchsia]="tableAccent(table.tableNumber) === 'fuchsia'"
                              [class.table-shell-emerald]="tableAccent(table.tableNumber) === 'emerald'"
                              [class.border-cyan-300/35]="tableAccent(table.tableNumber) === 'cyan'"
                              [class.ring-cyan-300/15]="tableAccent(table.tableNumber) === 'cyan'"
                              [class.border-amber-300/35]="tableAccent(table.tableNumber) === 'amber'"
                              [class.ring-amber-300/15]="tableAccent(table.tableNumber) === 'amber'"
                              [class.border-fuchsia-300/35]="tableAccent(table.tableNumber) === 'fuchsia'"
                              [class.ring-fuchsia-300/15]="tableAccent(table.tableNumber) === 'fuchsia'"
                              [class.border-emerald-300/35]="tableAccent(table.tableNumber) === 'emerald'"
                              [class.ring-emerald-300/15]="tableAccent(table.tableNumber) === 'emerald'"
                            >
                              <button
                                type="button"
                                class="relative w-full overflow-hidden p-4 text-left transition hover:bg-white/[0.035]"
                                [attr.aria-expanded]="isTableExpanded(table.id)"
                                (click)="toggleTable(table.id)"
                              >
                                <span
                                  class="table-glow-wash pointer-events-none absolute inset-0"
                                  [class.table-glow-wash-cyan]="tableAccent(table.tableNumber) === 'cyan'"
                                  [class.table-glow-wash-amber]="tableAccent(table.tableNumber) === 'amber'"
                                  [class.table-glow-wash-fuchsia]="tableAccent(table.tableNumber) === 'fuchsia'"
                                  [class.table-glow-wash-emerald]="tableAccent(table.tableNumber) === 'emerald'"
                                  aria-hidden="true"
                                ></span>
                                <span
                                  class="table-soft-rail absolute inset-y-5 left-0 w-px rounded-full"
                                  [class.table-soft-rail-cyan]="tableAccent(table.tableNumber) === 'cyan'"
                                  [class.table-soft-rail-amber]="tableAccent(table.tableNumber) === 'amber'"
                                  [class.table-soft-rail-fuchsia]="tableAccent(table.tableNumber) === 'fuchsia'"
                                  [class.table-soft-rail-emerald]="tableAccent(table.tableNumber) === 'emerald'"
                                  aria-hidden="true"
                                ></span>
                                <span class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
                                  <span class="flex min-w-0 items-center justify-center pl-1 text-center">
                                    <span class="block max-w-full truncate text-lg font-semibold text-white">{{ table.name }}</span>
                                  </span>

                                  <span class="grid grid-cols-3 gap-2 text-center text-sm">
                                    <span class="flex min-h-16 flex-col justify-center rounded-md bg-white/[0.045] px-2 py-2">
                                      <span class="block text-xs text-neutral-500">Players</span>
                                      <span class="mt-1 block font-semibold text-white">{{ tableTotals.activePlayers }}/{{ tableTotals.totalPlayers }}</span>
                                    </span>
                                    <span class="flex min-h-16 flex-col justify-center rounded-md bg-white/[0.045] px-2 py-2">
                                      <span class="block text-xs text-neutral-500">Buy-in</span>
                                      <span class="mt-1 block font-semibold text-white">
                                        {{ tableTotals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                                      </span>
                                    </span>
                                    <span class="flex min-h-16 flex-col justify-center rounded-md bg-white/[0.045] px-2 py-2">
                                      <span class="block text-xs text-neutral-500">Cash out</span>
                                      <span class="mt-1 block font-semibold text-white">
                                        {{ tableTotals.totalCashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                                      </span>
                                    </span>
                                  </span>
                                </span>
                              </button>

                              <button
                                type="button"
                                [disabled]="isBusy()"
                                class="table-add-player-button mx-4 mb-4 mt-0 w-[calc(100%-2rem)]"
                                aria-label="Add player"
                                title="Add player"
                                (click)="openAddPlayerDialog(session.id, table.id); $event.stopPropagation()"
                              >
                                <img
                                  src="/icons/add-user-emerald.svg"
                                  alt=""
                                  class="table-add-user-icon"
                                  aria-hidden="true"
                                />
                                <span class="ml-2 text-sm font-semibold">Add Player</span>
                              </button>

                              <div
                                class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
                                [style.grid-template-rows]="isTableExpanded(table.id) ? '1fr' : '0fr'"
                                [style.pointer-events]="isTableExpanded(table.id) ? 'auto' : 'none'"
                              >
                                <div class="min-h-0">
                                  <div
                                    class="border-t p-3 opacity-0 transition-opacity duration-300 ease-in-out sm:p-4"
                                    [class.border-cyan-300/20]="tableAccent(table.tableNumber) === 'cyan'"
                                    [class.bg-cyan-300/[0.035]]="tableAccent(table.tableNumber) === 'cyan'"
                                    [class.border-amber-300/20]="tableAccent(table.tableNumber) === 'amber'"
                                    [class.bg-amber-300/[0.035]]="tableAccent(table.tableNumber) === 'amber'"
                                    [class.border-fuchsia-300/20]="tableAccent(table.tableNumber) === 'fuchsia'"
                                    [class.bg-fuchsia-300/[0.035]]="tableAccent(table.tableNumber) === 'fuchsia'"
                                    [class.border-emerald-300/20]="tableAccent(table.tableNumber) === 'emerald'"
                                    [class.bg-emerald-300/[0.035]]="tableAccent(table.tableNumber) === 'emerald'"
                                    [class.opacity-100]="isTableExpanded(table.id)"
                                  >
                                    @for (player of store.playersForTable(session, table.id); track player.id) {
                                      <div
                                        class="grid gap-3 border border-white/10 border-b-0 bg-neutral-950/60 p-3 first:rounded-t-md last:rounded-b-md last:border-b md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
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
                                              (click)="openRebuyDialog(session.id, player)"
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
                                              (click)="openCashOutDialog(session.id, player)"
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
                                      <div class="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-neutral-500">
                                        No players at this table yet.
                                      </div>
                                    }
                                  </div>
                                </div>
                              </div>
                            </article>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>
      }

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
  `,
  styles: [
    `
      .session-overview-card {
        position: relative;
        isolation: isolate;
      }

      .pokertrack-sync-overlay {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        min-height: 100dvh;
      }

      @supports (height: 100dvh) {
        .pokertrack-sync-overlay {
          height: 100dvh;
        }
      }

      .session-overview-card::before {
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          linear-gradient(135deg, rgba(52, 211, 153, 0.12), transparent 38%),
          radial-gradient(circle at 96% 8%, rgba(34, 211, 238, 0.12), transparent 30%);
        content: '';
      }

      .session-overview-card::after {
        position: absolute;
        inset: 1px;
        z-index: -1;
        border-radius: 7px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 48%);
        content: '';
      }

      .table-add-player-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.75rem;
        border: 1px solid rgba(110, 231, 183, 0.36);
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.82);
        color: rgb(209, 250, 229);
        box-shadow: 0 0 18px rgba(52, 211, 153, 0.14);
        transition:
          background 160ms ease,
          border-color 160ms ease,
          box-shadow 180ms ease,
          transform 160ms ease;
      }

      .table-add-player-button:hover {
        border-color: rgba(110, 231, 183, 0.78);
        background: rgba(52, 211, 153, 0.16);
        box-shadow: 0 0 24px rgba(52, 211, 153, 0.24);
        transform: translateY(-1px);
      }

      .table-add-player-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
        transform: none;
      }

      .table-add-user-icon {
        display: block;
        width: 1.55rem;
        height: 1.55rem;
        object-fit: contain;
      }

      .table-shell {
        position: relative;
        isolation: isolate;
        transition:
          border-color 180ms ease,
          box-shadow 240ms ease,
          transform 180ms ease;
      }

      .table-shell::before {
        position: absolute;
        inset: 0;
        z-index: 0;
        opacity: 0.58;
        content: '';
        pointer-events: none;
      }

      .table-shell > * {
        position: relative;
        z-index: 1;
      }

      .table-shell-cyan::before {
        background:
          radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.2), transparent 36%),
          linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 56%);
      }

      .table-shell-amber::before {
        background:
          radial-gradient(circle at 0% 0%, rgba(251, 191, 36, 0.2), transparent 36%),
          linear-gradient(90deg, rgba(251, 191, 36, 0.1), transparent 56%);
      }

      .table-shell-fuchsia::before {
        background:
          radial-gradient(circle at 0% 0%, rgba(217, 70, 239, 0.2), transparent 36%),
          linear-gradient(90deg, rgba(217, 70, 239, 0.1), transparent 56%);
      }

      .table-shell-emerald::before {
        background:
          radial-gradient(circle at 0% 0%, rgba(52, 211, 153, 0.2), transparent 36%),
          linear-gradient(90deg, rgba(52, 211, 153, 0.1), transparent 56%);
      }

      .table-shell:hover {
        transform: translateY(-1px);
      }

      .table-shell-cyan {
        animation: table-breathe-cyan 4.8s ease-in-out infinite;
      }

      .table-shell-amber {
        animation: table-breathe-amber 5.2s ease-in-out infinite;
      }

      .table-shell-fuchsia {
        animation: table-breathe-fuchsia 5s ease-in-out infinite;
      }

      .table-shell-emerald {
        animation: table-breathe-emerald 5.4s ease-in-out infinite;
      }

      .table-glow-wash {
        opacity: 0;
        z-index: -1;
      }

      .table-glow-wash-cyan {
        background:
          radial-gradient(circle at 0% 0%, rgba(34, 211, 238, 0.18), transparent 34%),
          linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 46%);
      }

      .table-glow-wash-amber {
        background:
          radial-gradient(circle at 0% 0%, rgba(251, 191, 36, 0.18), transparent 34%),
          linear-gradient(90deg, rgba(251, 191, 36, 0.1), transparent 46%);
      }

      .table-glow-wash-fuchsia {
        background:
          radial-gradient(circle at 0% 0%, rgba(217, 70, 239, 0.18), transparent 34%),
          linear-gradient(90deg, rgba(217, 70, 239, 0.1), transparent 46%);
      }

      .table-glow-wash-emerald {
        background:
          radial-gradient(circle at 0% 0%, rgba(52, 211, 153, 0.18), transparent 34%),
          linear-gradient(90deg, rgba(52, 211, 153, 0.1), transparent 46%);
      }

      .table-soft-rail {
        opacity: 0.38;
        filter: blur(0.35px);
      }

      .table-soft-rail-cyan {
        background: rgba(103, 232, 249, 0.46);
        box-shadow: 0 0 10px rgba(34, 211, 238, 0.18);
      }

      .table-soft-rail-amber {
        background: rgba(252, 211, 77, 0.46);
        box-shadow: 0 0 10px rgba(251, 191, 36, 0.16);
      }

      .table-soft-rail-fuchsia {
        background: rgba(232, 121, 249, 0.46);
        box-shadow: 0 0 10px rgba(217, 70, 239, 0.16);
      }

      .table-soft-rail-emerald {
        background: rgba(110, 231, 183, 0.46);
        box-shadow: 0 0 10px rgba(52, 211, 153, 0.16);
      }

      @keyframes table-breathe-cyan {
        0%,
        100% {
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22), 0 0 18px rgba(34, 211, 238, 0.08);
        }
        50% {
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 30px rgba(34, 211, 238, 0.18);
        }
      }

      @keyframes table-breathe-amber {
        0%,
        100% {
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22), 0 0 18px rgba(251, 191, 36, 0.08);
        }
        50% {
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 30px rgba(251, 191, 36, 0.17);
        }
      }

      @keyframes table-breathe-fuchsia {
        0%,
        100% {
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22), 0 0 18px rgba(217, 70, 239, 0.08);
        }
        50% {
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 30px rgba(217, 70, 239, 0.17);
        }
      }

      @keyframes table-breathe-emerald {
        0%,
        100% {
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22), 0 0 18px rgba(52, 211, 153, 0.08);
        }
        50% {
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 30px rgba(52, 211, 153, 0.18);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .table-shell {
          animation: none;
        }
      }
    `
  ]
})
export class HostDashboardPage implements OnDestroy {
  protected readonly store = inject(PokerStoreService);
  private readonly dialog = inject(MatDialog);
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly expandedSessionId = signal<string | null | undefined>(undefined);
  protected readonly expandedTableId = signal<string | null | undefined>(undefined);
  protected readonly recentRebuyPlayerId = signal<string | null>(null);
  protected readonly recentRebuySessionId = signal<string | null>(null);
  private rebuyAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.clearRebuyAnimation();
  }

  protected isSessionExpanded(sessionId: string): boolean {
    const expandedSessionId = this.expandedSessionId();

    if (expandedSessionId === undefined) {
      return this.store.activeSessions()[0]?.id === sessionId;
    }

    return expandedSessionId === sessionId;
  }

  protected toggleSession(sessionId: string): void {
    const expandedSessionId = this.expandedSessionId();
    const isDefaultOpen = expandedSessionId === undefined && this.store.activeSessions()[0]?.id === sessionId;
    const isCurrentlyOpen = expandedSessionId === sessionId || isDefaultOpen;

    this.expandedSessionId.set(isCurrentlyOpen ? null : sessionId);
  }

  protected isTableExpanded(tableId: string): boolean {
    const expandedTableId = this.expandedTableId();

    if (expandedTableId === undefined) {
      const firstTable = this.store.activeSessions().flatMap((session) => session.tables)[0];
      return firstTable?.id === tableId;
    }

    return expandedTableId === tableId;
  }

  protected toggleTable(tableId: string): void {
    const expandedTableId = this.expandedTableId();
    const firstTable = this.store.activeSessions().flatMap((session) => session.tables)[0];
    const isDefaultOpen = expandedTableId === undefined && firstTable?.id === tableId;
    const isCurrentlyOpen = expandedTableId === tableId || isDefaultOpen;

    this.expandedTableId.set(isCurrentlyOpen ? null : tableId);
  }

  protected tableAccent(tableNumber: number): 'cyan' | 'amber' | 'fuchsia' | 'emerald' {
    return ['cyan', 'amber', 'fuchsia', 'emerald'][(tableNumber - 1) % 4] as
      | 'cyan'
      | 'amber'
      | 'fuchsia'
      | 'emerald';
  }

  protected async createTable(sessionId: string): Promise<void> {
    if (this.isBusy() || !sessionId) {
      return;
    }

    const session = this.store.getSession(sessionId);
    const nextNumber = (session?.tables.length ?? 0) + 1;
    const dialogRef = this.dialog.open<TableNameDialogComponent, TableNameDialogData, string | undefined>(
      TableNameDialogComponent,
      {
        autoFocus: 'first-tabbable',
        data: { tableName: `Table ${nextNumber}` },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    const tableName = (await firstValueFrom(dialogRef.afterClosed()))?.trim();

    if (!tableName) {
      return;
    }

    let createdTableId: string | null = null;

    const succeeded = await this.runAction(this.tableAction('add-table', sessionId), async () => {
      const table = await this.store.createTable(sessionId, tableName);
      createdTableId = table.id;
    });

    if (succeeded && createdTableId) {
      this.expandedSessionId.set(sessionId);
      this.expandedTableId.set(createdTableId);
    }
  }

  protected async openAddPlayerDialog(sessionId: string, tableId: string): Promise<void> {
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

      await this.runAction(this.tableAction('add-player', tableId), () =>
        this.store.addPlayer(
          sessionId,
          result.name,
          result.buyIn,
          result.comment,
          result.playerUserId,
          result.createRegisteredPlayer,
          tableId
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

    if (action?.startsWith('add-player:')) {
      return 'Adding player...';
    }

    if (action?.startsWith('add-table:')) {
      return 'Creating table...';
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

  protected tableAction(action: string, tableId: string): string {
    return `${action}:${tableId}`;
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
