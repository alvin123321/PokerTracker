import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  defaultPokerTableName,
  PokerStoreService,
  PokerSession,
  PokerTable,
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
import { messageFromUnknownError } from '../shared/action-feedback.logic';
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
  imports: [CurrencyPipe, DatePipe, MatDialogModule, NgTemplateOutlet, RouterLink],
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

      <section class="space-y-4 sm:space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a [routerLink]="backLink" class="text-sm font-semibold text-emerald-300">&larr; {{ backLabel }}</a>
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

          <div class="session-action-bar">
            @if (canDelete() && currentSession.status === 'ACTIVE') {
              <button
                type="button"
                [disabled]="isBusy() || !canCloseSession(currentSession)"
                [title]="canCloseSession(currentSession) ? 'Close session' : 'Cash out all players before closing'"
                class="session-action-button session-close-button inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/30 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                (click)="closeSession()"
              >
                @if (isPending('close-session')) {
                  <span class="action-spinner" aria-hidden="true"></span>
                  Closing...
                } @else {
                  Close Session
                }
              </button>
            }
            <div class="session-primary-actions">
              @if (!isHistoryView && currentSession.status === 'ACTIVE') {
                <button
                  type="button"
                  [disabled]="isBusy()"
                  class="session-action-button inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/30 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                  (click)="createTable()"
                >
                  @if (isPending('add-table')) {
                    <span class="action-spinner" aria-hidden="true"></span>
                    Creating...
                  } @else {
                    + Table
                  }
                </button>
                <button
                  type="button"
                  [disabled]="isBusy() || !selectedTable()"
                  class="session-action-button inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                  (click)="openAddPlayerDialog()"
                >
                  @if (isPending('add-player')) {
                    <span class="action-spinner" aria-hidden="true"></span>
                    Adding...
                  } @else {
                    Add Player
                  }
                </button>
              }
            </div>
            @if (canDelete()) {
              <button
                type="button"
                [disabled]="isBusy()"
                aria-label="Delete session"
                title="Delete session"
                class="pokertrack-icon-button session-delete-button"
                (click)="deleteSession()"
              >
                @if (isPending('delete-session')) {
                  <span class="action-spinner" aria-hidden="true"></span>
                  <span class="sr-only">Deleting session</span>
                } @else {
                  <span class="trash-icon" aria-hidden="true"></span>
                  <span class="sr-only">Delete Session</span>
                }
              </button>
            }
          </div>
        </div>

        <div class="hidden gap-3 md:grid md:grid-cols-4 md:gap-4">
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
            <p class="text-sm text-neutral-400">Total buy-in</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">
              {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>
          <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 md:block md:p-4">
            <p class="text-sm text-neutral-400">Players</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">{{ totals.totalPlayers }}</p>
          </div>
          <div class="hidden rounded-lg border border-white/10 bg-white/[0.04] p-3 md:block md:p-4">
            <p class="text-sm text-neutral-400">Cashed out</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">{{ totals.cashedOutPlayers }}</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
            <p class="text-sm text-neutral-400">Tables</p>
            <p class="mt-1 text-2xl font-semibold text-white md:mt-2">{{ currentSession.tables.length }}</p>
          </div>
        </div>

        <section class="space-y-3">
          @if (!isHistoryView && currentSession.status === 'ACTIVE') {
          <div class="flex justify-end">
              <button
                type="button"
                [disabled]="isBusy()"
                class="rounded-lg border border-emerald-300/30 px-3 py-2 text-sm font-semibold text-emerald-100"
                (click)="createTable()"
              >
                + Table
              </button>
          </div>
          }

          @if (currentSession.tables.length === 0) {
            <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
              <p class="text-lg font-semibold text-white">
                {{ isHistoryView ? 'No tables in this session' : 'Create the first table' }}
              </p>
              <p class="mt-2 text-sm text-neutral-400">
                {{ isHistoryView ? 'Tables added during the session will appear here.' : 'A session can contain multiple tables. Add a table before adding players.' }}
              </p>
              @if (!isHistoryView && currentSession.status === 'ACTIVE') {
                <button
                  type="button"
                  [disabled]="isBusy()"
                  class="mt-5 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
                  (click)="createTable()"
                >
                  Create Table 1
                </button>
              }
            </div>
          } @else {
            <div class="grid gap-3">
              @for (table of currentSession.tables; track table.id) {
                @let tableTotals = store.totalsForTable(currentSession, table.id);
                <article
                  class="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] transition"
                  [class.border-emerald-300]="isTableExpanded(table.id)"
                  [class.bg-emerald-300/10]="isTableExpanded(table.id)"
                >
                @if (canDelete() && currentSession.status === 'ACTIVE') {
                  <button
                    type="button"
                    [disabled]="isBusy()"
                    aria-label="Delete table"
                    title="Delete table"
                    class="table-delete-button"
                    (click)="confirmDeleteTable(table); $event.stopPropagation()"
                  >
                    @if (isPending(tableAction('delete-table', table.id))) {
                      <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                    } @else {
                      <span class="trash-icon" aria-hidden="true"></span>
                    }
                  </button>
                }
                <button
                  type="button"
                  class="w-full p-4 text-left"
                    [attr.aria-expanded]="isTableExpanded(table.id)"
                    (click)="selectTable(table.id)"
                >
                  <span class="flex items-start justify-between gap-3">
                    <span>
                      <span class="block text-base font-semibold text-white">{{ table.name }}</span>
                      <span class="mt-1 block text-xs uppercase tracking-wide text-neutral-500">
                        Table {{ table.tableNumber }} · {{ table.status }}
                      </span>
                    </span>
                    <span class="mr-12 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-neutral-200">
                      {{ tableTotals.totalPlayers }}/10 Seats
                    </span>
                  </span>
                  <span class="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <span class="rounded-md bg-black/20 px-2 py-2">
                      <span class="block text-neutral-500">Active</span>
                      <span class="mt-1 block font-semibold text-white">{{ tableTotals.activePlayers }}</span>
                    </span>
                    <span class="rounded-md bg-black/20 px-2 py-2">
                      <span class="block text-neutral-500">Buy-in</span>
                      <span class="mt-1 block font-semibold text-white">{{ tableTotals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                    </span>
                    <span class="rounded-md bg-black/20 px-2 py-2">
                      <span class="block text-neutral-500">Done</span>
                      <span class="mt-1 block font-semibold text-white">{{ tableTotals.cashedOutPlayers }}</span>
                    </span>
                  </span>
                </button>
                  <div
                    class="table-detail-panel"
                    [class.table-detail-panel-open]="isTableExpanded(table.id)"
                    [attr.aria-hidden]="isTableExpanded(table.id) ? null : 'true'"
                    [attr.inert]="isTableExpanded(table.id) ? null : ''"
                  >
                    <div class="table-detail-panel-inner border-t border-white/10 bg-neutral-950/35 p-3 sm:p-4">
                    @if (playersForTable(currentSession, table.id).length === 0) {
                      <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center sm:p-8">
                        <p class="text-lg font-semibold text-white">No players at {{ table.name }}</p>
                        @if (!isHistoryView && currentSession.status === 'ACTIVE') {
                          <button
                            type="button"
                            class="mt-5 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950"
                            [disabled]="isBusy()"
                            (click)="openAddPlayerDialog()"
                          >
                            Add Player
                          </button>
                        }
                      </div>
                    } @else {
                      <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        <div
                          class="hidden grid-cols-[1.35fr_0.9fr_0.65fr_0.9fr_0.85fr_1.4fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 lg:grid"
                        >
                          <span>Player</span>
                          <span>Buy-in</span>
                          <span>Rebuys</span>
                          <span>Cash out</span>
                          <span>Net</span>
                          <span class="text-right">Actions</span>
                        </div>

                        @for (player of playersForTable(currentSession, table.id); track player.id; let playerIndex = $index) {
                          <ng-container
                            [ngTemplateOutlet]="playerRow"
                            [ngTemplateOutletContext]="{ $implicit: player, index: playerIndex }"
                          ></ng-container>
                        }
                      </div>
                    }
                    </div>
                  </div>
                </article>
              }
            </div>
            @if (!isHistoryView && currentSession.status === 'ACTIVE') {
              <div class="pt-1 text-center">
                <button
                  type="button"
                  [disabled]="isBusy()"
                  class="w-full rounded-lg border border-emerald-300/30 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 sm:w-auto sm:min-w-56"
                  (click)="createTable()"
                >
                  + Table
                </button>
              </div>
            }
          }
        </section>

        <ng-template #playerRow let-player let-playerIndex="index">
              <div
                class="player-row border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.035]"
                [class.player-row-accent-cyan]="playerAccent(playerIndex) === 'cyan'"
                [class.player-row-accent-amber]="playerAccent(playerIndex) === 'amber'"
                [class.player-row-accent-fuchsia]="playerAccent(playerIndex) === 'fuchsia'"
                [class.player-row-accent-emerald]="playerAccent(playerIndex) === 'emerald'"
                [class.opacity-70]="player.status === 'COMPLETED'"
                [class.player-row-rebuy-glow]="recentRebuyPlayerId() === player.id"
              >
                <div class="lg:hidden">
                  <div class="grid cursor-pointer gap-2 px-3 py-2.5" (click)="togglePlayer(player.id)">
                    <div class="session-player-mobile-card">
                      <button
                        type="button"
                        class="min-w-0 px-3 py-2 text-left transition"
                        (click)="$event.stopPropagation(); togglePlayer(player.id)"
                      >
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="truncate text-base font-semibold text-white">{{ player.name }}</span>
                          <span class="shrink-0 text-xs text-neutral-500">
                            {{ isExpanded(player.id) ? 'v' : '>' }}
                          </span>
                        </span>
                        <span class="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-400">
                          <span>{{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }} buy-in</span>
                          @if (player.status === 'COMPLETED') {
                            <span
                              class="font-semibold"
                              [class.text-emerald-300]="player.net >= 0"
                              [class.text-red-300]="player.net < 0"
                            >
                              Net {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                            </span>
                          }
                        </span>
                      </button>

                      @if (canRemovePlayer(currentSession, player)) {
                        <button
                          type="button"
                          [disabled]="isBusy()"
                          aria-label="Remove player"
                          title="Remove player"
                          class="session-player-remove-icon-button session-player-remove-mobile-button"
                          (click)="$event.stopPropagation(); confirmRemoveSessionPlayer(player)"
                        >
                          @if (isPending(playerAction('remove-player', player.id))) {
                            <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                          } @else {
                            <span class="trash-icon" aria-hidden="true"></span>
                          }
                        </button>
                      }
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      @if (player.status !== 'COMPLETED') {
                        <button
                          type="button"
                          [disabled]="isBusy()"
                          class="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                          (click)="$event.stopPropagation(); openRebuyDialog(player)"
                        >
                          @if (isPending(playerAction('rebuy', player.id))) {
                            <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                            Saving
                          } @else {
                            Rebuy
                          }
                        </button>
                      }
                      <button
                        type="button"
                        [disabled]="isBusy()"
                        class="inline-flex min-h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
                        [class.col-span-2]="player.status === 'COMPLETED'"
                        (click)="$event.stopPropagation(); openCashOutDialog(player)"
                      >
                        @if (isPending(playerAction('cash-out', player.id))) {
                          <span class="action-spinner action-spinner-sm" aria-hidden="true"></span>
                          Saving
                        } @else {
                          {{ player.status === 'COMPLETED' ? 'Edit Cash Out' : 'Cash Out' }}
                        }
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  class="hidden cursor-pointer gap-3 px-4 py-2.5 lg:grid lg:grid-cols-[1.35fr_0.85fr_0.55fr_0.85fr_0.8fr_1.25fr] lg:items-center"
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
                    <span class="min-w-0">
                      <span class="block truncate text-base font-semibold text-white">{{ player.name }}</span>
                    </span>
                  </button>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Buy-in</p>
                    <p class="font-semibold text-white">
                      {{ player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Rebuys</p>
                    <p class="font-semibold text-white">{{ rebuyCount(player.id) }}</p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-lg bg-neutral-950 p-3 lg:block lg:bg-transparent lg:p-0">
                    <p class="text-xs text-neutral-500 lg:hidden">Cash out</p>
                    @if (player.status === 'COMPLETED') {
                      <p class="font-semibold text-white">
                        {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </p>
                    } @else {
                      <span aria-hidden="true"></span>
                    }
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
                      <span aria-hidden="true"></span>
                    }
                  </div>

                  <div class="flex justify-end gap-2">
                    @if (player.status !== 'COMPLETED') {
                      <button
                        type="button"
                        [disabled]="isBusy()"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                        (click)="$event.stopPropagation(); openRebuyDialog(player)"
                      >
                        @if (isPending(playerAction('rebuy', player.id))) {
                          <span class="action-spinner" aria-hidden="true"></span>
                          Saving...
                        } @else {
                          Rebuy
                        }
                      </button>
                    }
                    <button
                      type="button"
                      [disabled]="isBusy()"
                      class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
                      (click)="$event.stopPropagation(); openCashOutDialog(player)"
                    >
                      @if (isPending(playerAction('cash-out', player.id))) {
                        <span class="action-spinner" aria-hidden="true"></span>
                        Saving...
                      } @else {
                        {{ player.status === 'COMPLETED' ? 'Edit Cash Out' : 'Cash Out' }}
                      }
                    </button>
                    @if (canRemovePlayer(currentSession, player)) {
                      <button
                        type="button"
                        [disabled]="isBusy()"
                        aria-label="Remove player"
                        title="Remove player"
                        class="session-player-remove-icon-button"
                        (click)="$event.stopPropagation(); confirmRemoveSessionPlayer(player)"
                      >
                        @if (isPending(playerAction('remove-player', player.id))) {
                          <span class="action-spinner" aria-hidden="true"></span>
                        } @else {
                          <span class="trash-icon" aria-hidden="true"></span>
                        }
                      </button>
                    }
                  </div>
                </div>

                <div
                  class="player-detail-panel"
                  [class.player-detail-panel-open]="isExpanded(player.id)"
                  [attr.aria-hidden]="!isExpanded(player.id)"
                  [attr.inert]="isExpanded(player.id) ? null : ''"
                >
                  <div class="player-detail-panel-inner border-t border-emerald-300/10 bg-neutral-950/80 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
                    @if (player.status === 'COMPLETED') {
                      <div class="mb-3 grid grid-cols-2 gap-2 text-sm lg:hidden">
                        <div class="rounded-lg bg-white/[0.03] p-3">
                          <p class="text-xs text-neutral-500">Cash out</p>
                          <p class="mt-1 font-semibold text-white">
                            {{ player.cashOut | currency: 'USD' : 'symbol' : '1.0-0' }}
                          </p>
                        </div>
                        <div class="rounded-lg bg-white/[0.03] p-3">
                          <p class="text-xs text-neutral-500">Net</p>
                          <p
                            class="mt-1 font-semibold"
                            [class.text-emerald-300]="player.net >= 0"
                            [class.text-red-300]="player.net < 0"
                          >
                            {{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}
                          </p>
                        </div>
                      </div>
                    }

                    <div class="player-detail-toolbar mb-3">
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-white">Buy-in timeline</p>
                        <p class="hidden text-xs text-neutral-500 lg:block">
                          {{ canDelete() ? 'Host can edit or delete buy-ins' : 'Managers can edit buy-ins' }}
                        </p>
                      </div>
                      <div class="player-detail-toolbar-actions">
                        <p class="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 lg:hidden">
                          Total re-buys {{ activeBuyInCount(player.id) }}
                        </p>
                      </div>
                    </div>

                    <div class="space-y-2">
                      @if (buyInTransactions(player.id).length === 0) {
                        <div class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-500">
                          No buy-ins recorded for this player.
                        </div>
                      } @else {
                        @for (transaction of buyInTransactions(player.id); track transaction.id) {
                          <div
                            class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[0.75fr_0.9fr_0.7fr_1.2fr_auto] sm:gap-3"
                            [class.transaction-row-buyin]="transaction.type === 'BUYIN' && !transaction.deletedAt"
                            [class.transaction-row-rebuy]="transaction.type === 'REBUY' && !transaction.deletedAt"
                            [class.border-neutral-800]="transaction.deletedAt"
                            [class.opacity-60]="transaction.deletedAt"
                          >
                            <span
                              class="text-xs font-semibold uppercase text-emerald-300"
                              [class.transaction-label-buyin]="transaction.type === 'BUYIN' && !transaction.deletedAt"
                              [class.transaction-label-rebuy]="transaction.type === 'REBUY' && !transaction.deletedAt"
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
                              class="col-start-1 row-start-2 text-sm text-neutral-300 sm:col-auto sm:row-auto"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              {{ transaction.createdAt | date: 'shortTime' }}
                            </span>
                            <span
                              class="col-start-2 row-start-1 self-center text-right text-lg font-semibold text-white sm:col-auto sm:row-auto sm:self-auto sm:text-left sm:text-base"
                              [class.transaction-amount-buyin]="transaction.type === 'BUYIN' && !transaction.deletedAt"
                              [class.transaction-amount-rebuy]="transaction.type === 'REBUY' && !transaction.deletedAt"
                              [class.line-through]="transaction.deletedAt"
                              [class.text-neutral-500]="transaction.deletedAt"
                            >
                              {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                            </span>
                            @if (transaction.comment) {
                              <span
                                class="col-span-3 text-sm text-neutral-400 sm:col-auto"
                                [class.line-through]="transaction.deletedAt"
                                [class.text-neutral-500]="transaction.deletedAt"
                              >
                                {{ transaction.comment }}
                              </span>
                            } @else {
                              <span class="hidden sm:block"></span>
                            }
                            <button
                              type="button"
                              [disabled]="isBusy()"
                              class="col-start-3 row-start-1 inline-flex h-8 items-center justify-center gap-2 self-center rounded-lg border border-white/10 px-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:col-auto sm:row-auto sm:h-auto sm:px-3 sm:py-2"
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
                </div>
              </div>
        </ng-template>
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

      .session-action-bar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
      }

      .session-primary-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.6rem;
        min-width: 0;
      }

      .session-action-button {
        min-height: 2.85rem;
        padding-inline: 0.6rem;
        white-space: nowrap;
      }

      .session-close-button {
        justify-self: start;
      }

      .session-delete-button {
        justify-self: end;
      }

      .table-delete-button {
        position: absolute;
        top: 0.8rem;
        right: 0.8rem;
        z-index: 5;
        display: inline-grid;
        width: 2.4rem;
        height: 2.4rem;
        place-items: center;
        border: 1px solid rgb(248 113 113 / 0.32);
        border-radius: 0.55rem;
        background: rgb(10 10 10 / 0.74);
        color: rgb(254 202 202);
        transition:
          background 160ms ease,
          border-color 160ms ease,
          color 160ms ease,
          transform 160ms ease;
      }

      .table-delete-button:hover {
        border-color: rgb(248 113 113 / 0.62);
        background: rgb(248 113 113 / 0.12);
        color: rgb(254 226 226);
        transform: translateY(-1px);
      }

      .table-delete-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
        transform: none;
      }

      .session-action-bar .pokertrack-icon-button {
        width: 2.85rem;
        min-width: 2.85rem;
        height: 2.85rem;
      }

      .table-detail-panel {
        display: grid;
        grid-template-rows: 0fr;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition:
          grid-template-rows 320ms cubic-bezier(0.16, 1, 0.3, 1),
          opacity 220ms ease,
          visibility 0ms linear 320ms;
      }

      .table-detail-panel-open {
        grid-template-rows: 1fr;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition:
          grid-template-rows 360ms cubic-bezier(0.16, 1, 0.3, 1),
          opacity 220ms ease;
      }

      .table-detail-panel-inner {
        min-height: 0;
        overflow: hidden;
        transform: translateY(-0.35rem);
        transition:
          padding 280ms cubic-bezier(0.16, 1, 0.3, 1),
          transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
          border-color 220ms ease,
          background 220ms ease;
      }

      .table-detail-panel-open .table-detail-panel-inner {
        transform: translateY(0);
      }

      .table-detail-panel:not(.table-detail-panel-open) .table-detail-panel-inner {
        border-width: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      @media (max-width: 639px) {
        .session-action-bar {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .session-primary-actions {
          grid-column: 1 / -1;
          grid-row: 2;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          width: 100%;
        }
      }

      @media (min-width: 640px) {
        .session-action-button {
          padding-inline: 0.85rem;
        }
      }

      .action-spinner-sm {
        width: 0.75rem;
        height: 0.75rem;
      }

      .pokertrack-sync-overlay {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        min-height: 100dvh;
        animation: pokertrack-sync-fade 180ms ease-out both;
      }

      @supports (height: 100dvh) {
        .pokertrack-sync-overlay {
          height: 100dvh;
        }
      }

      .deck-shuffle {
        position: relative;
        width: 4.5rem;
        height: 3.25rem;
      }

      .deck-shuffle span {
        position: absolute;
        left: 1.15rem;
        top: 0.35rem;
        width: 2.25rem;
        height: 2.9rem;
        border: 1px solid rgb(110 231 183 / 0.8);
        border-radius: 0.35rem;
        background:
          linear-gradient(135deg, rgb(110 231 183) 0 20%, transparent 20% 100%),
          linear-gradient(315deg, rgb(255 255 255 / 0.12), rgb(10 10 10));
        box-shadow: 0 0.75rem 1.5rem rgb(0 0 0 / 0.35);
        animation: deck-shuffle 980ms ease-in-out infinite;
      }

      .deck-shuffle span:nth-child(2) {
        animation-delay: 120ms;
      }

      .deck-shuffle span:nth-child(3) {
        animation-delay: 240ms;
      }

      .player-detail-panel {
        display: grid;
        grid-template-rows: 0fr;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition:
          grid-template-rows 260ms ease-in-out,
          opacity 220ms ease-in-out,
          visibility 0ms linear 260ms;
      }

      .player-detail-panel-open {
        grid-template-rows: 1fr;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition:
          grid-template-rows 260ms ease-in-out,
          opacity 220ms ease-in-out;
      }

      .player-detail-panel-inner {
        min-height: 0;
        overflow: hidden;
        transform: translateY(-0.25rem);
        transition:
          padding 240ms ease-in-out,
          transform 240ms ease-in-out,
          border-color 240ms ease-in-out;
      }

      .player-detail-panel-open .player-detail-panel-inner {
        transform: translateY(0);
      }

      .player-detail-panel:not(.player-detail-panel-open) .player-detail-panel-inner {
        border-width: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      .player-detail-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .player-detail-toolbar-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .session-player-remove-icon-button {
        display: inline-grid;
        width: 2.5rem;
        min-width: 2.5rem;
        height: 2.5rem;
        place-items: center;
        border: 1px solid rgb(248 113 113 / 0.32);
        border-radius: 0.5rem;
        background: rgb(248 113 113 / 0.08);
        color: rgb(254 202 202);
        transition:
          background 160ms ease,
          border-color 160ms ease,
          color 160ms ease,
          transform 160ms ease;
      }

      .session-player-remove-icon-button:hover {
        border-color: rgb(248 113 113 / 0.62);
        background: rgb(248 113 113 / 0.13);
        color: rgb(254 226 226);
        transform: translateY(-1px);
      }

      .session-player-remove-icon-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
        transform: none;
      }

      .session-player-mobile-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 0.08);
        border-radius: 0.65rem;
        background: rgb(255 255 255 / 0.025);
        transition:
          background 180ms ease,
          border-color 180ms ease;
      }

      .session-player-mobile-card:hover {
        border-color: rgb(255 255 255 / 0.14);
        background: rgb(255 255 255 / 0.04);
      }

      .session-player-remove-mobile-button {
        width: 2.85rem;
        min-width: 2.85rem;
        height: auto;
        min-height: 100%;
        border-width: 0 0 0 1px;
        border-color: rgb(248 113 113 / 0.22);
        border-radius: 0;
        background: transparent;
      }

      @media (max-width: 640px) {
        .player-detail-toolbar {
          align-items: flex-start;
        }

        .player-detail-toolbar-actions {
          max-width: 52%;
        }

      }

      .transaction-row-buyin {
        border-color: rgb(52 211 153 / 0.24);
        background:
          linear-gradient(135deg, rgb(16 185 129 / 0.12), transparent 62%),
          rgb(255 255 255 / 0.03);
      }

      .transaction-row-rebuy {
        border-color: rgb(56 189 248 / 0.28);
        background:
          linear-gradient(135deg, rgb(14 165 233 / 0.14), transparent 62%),
          rgb(255 255 255 / 0.03);
      }

      .transaction-label-buyin,
      .transaction-amount-buyin {
        color: rgb(110 231 183);
      }

      .transaction-label-rebuy,
      .transaction-amount-rebuy {
        color: rgb(125 211 252);
      }

      .player-row {
        position: relative;
      }

      .player-row::before {
        position: absolute;
        inset: 0 auto 0 0;
        width: 0.18rem;
        content: '';
        opacity: 0.8;
      }

      .player-row-accent-cyan {
        background: linear-gradient(90deg, rgb(34 211 238 / 0.08), transparent 42%);
      }

      .player-row-accent-amber {
        background: linear-gradient(90deg, rgb(251 191 36 / 0.08), transparent 42%);
      }

      .player-row-accent-fuchsia {
        background: linear-gradient(90deg, rgb(217 70 239 / 0.08), transparent 42%);
      }

      .player-row-accent-emerald {
        background: linear-gradient(90deg, rgb(52 211 153 / 0.08), transparent 42%);
      }

      .player-row-accent-cyan::before {
        background: rgb(34 211 238 / 0.75);
      }

      .player-row-accent-amber::before {
        background: rgb(251 191 36 / 0.75);
      }

      .player-row-accent-fuchsia::before {
        background: rgb(217 70 239 / 0.75);
      }

      .player-row-accent-emerald::before {
        background: rgb(52 211 153 / 0.75);
      }

      .player-row-rebuy-glow {
        animation: player-row-rebuy-glow 1200ms ease-in-out both;
      }

      @keyframes action-spinner {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes player-row-rebuy-glow {
        0% {
          background: rgb(16 185 129 / 0);
          box-shadow: inset 0 0 0 1px rgb(110 231 183 / 0);
        }

        18% {
          background: rgb(16 185 129 / 0.18);
          box-shadow:
            inset 0 0 0 1px rgb(110 231 183 / 0.5),
            0 0 26px rgb(16 185 129 / 0.22);
        }

        100% {
          background: rgb(16 185 129 / 0);
          box-shadow: inset 0 0 0 1px rgb(110 231 183 / 0);
        }
      }

      @keyframes deck-shuffle {
        0%,
        100% {
          transform: translateX(-0.55rem) rotate(-10deg);
          z-index: 1;
        }

        45% {
          transform: translateX(0.65rem) rotate(9deg);
          z-index: 3;
        }

        70% {
          transform: translateX(0) rotate(0deg);
          z-index: 2;
        }
      }

      @keyframes pokertrack-sync-fade {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
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
  protected readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  protected readonly isHistoryView = this.route.snapshot.queryParamMap.get('from') === 'history';
  protected readonly backLink =
    this.isHistoryView
      ? '/host/sessions/history'
      : '/host/dashboard';
  protected readonly backLabel =
    this.isHistoryView ? 'History' : 'Dashboard';
  private readonly expandedPlayerId = signal<string | null>(null);
  protected readonly recentRebuyPlayerId = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private rebuyGlowTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successToast = signal<string | null>(null);
  protected readonly selectedTableId = signal<string | null>(null);
  protected readonly expandedTableIds = signal<string[]>([]);

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly selectedTable = computed(() => {
    const currentSession = this.session();
    const tables = currentSession?.tables ?? [];
    const selectedId = this.selectedTableId();
    return tables.find((table) => table.id === selectedId) ?? tables[0] ?? null;
  });
  protected readonly sortedPlayers = computed(() =>
    this.store.sortedPlayersForActiveSession({
      ...(this.session() ?? this.emptySession()),
      players: this.store.playersForTable(this.session(), this.selectedTable()?.id ?? null)
    })
  );
  protected readonly toastMessage = computed(() => {
    if (this.actionError() || this.store.error()) {
      return this.actionError() ?? this.store.error();
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
  protected readonly loadingMessage = computed(() => {
    const action = this.pendingAction();

    if (action === 'add-player') {
      return 'Adding player...';
    }

    if (action === 'add-table') {
      return 'Creating table...';
    }

    if (action?.startsWith('delete-table:')) {
      return 'Deleting table...';
    }

    if (action?.startsWith('rebuy:')) {
      return 'Recording rebuy...';
    }

    if (action?.startsWith('cash-out:')) {
      return 'Recording cash out...';
    }

    if (action?.startsWith('remove-player:')) {
      return 'Removing player...';
    }

    if (action === 'delete-session') {
      return 'Deleting session...';
    }

    if (action === 'close-session') {
      return 'Closing session...';
    }

    return 'Syncing table...';
  });

  ngOnDestroy(): void {
    this.clearSuccessToast();
    this.clearRebuyGlow();
  }

  protected selectTable(tableId: string): void {
    this.expandedTableIds.update((tableIds) =>
      tableIds.includes(tableId)
        ? tableIds.filter((currentTableId) => currentTableId !== tableId)
        : [...tableIds, tableId]
    );
    this.selectedTableId.set(tableId);
    this.expandedPlayerId.set(null);
  }

  protected isTableExpanded(tableId: string): boolean {
    return this.expandedTableIds().includes(tableId);
  }

  protected playersForTable(currentSession: PokerSession | undefined, tableId: string): SessionPlayer[] {
    return this.store.sortedPlayersForActiveSession({
      ...(currentSession ?? this.emptySession()),
      players: this.store.playersForTable(currentSession ?? undefined, tableId)
    });
  }

  protected async createTable(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    const nextNumber = (this.session()?.tables.length ?? 0) + 1;
    const name = defaultPokerTableName(nextNumber);

    let createdTableId: string | null = null;
    const succeeded = await this.runAction('add-table', async () => {
      const table = await this.store.createTable(this.sessionId, name);
      createdTableId = table.id;
    });

    if (succeeded && createdTableId) {
      const tableId = createdTableId;
      this.selectedTableId.set(tableId);
      this.expandedTableIds.update((tableIds) => [...tableIds, tableId]);
    }
  }

  protected async openAddPlayerDialog(): Promise<void> {
    const selectedTable = this.selectedTable();

    if (this.isBusy() || !selectedTable) {
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
          result.createRegisteredPlayer,
          selectedTable.id
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
        const succeeded = await this.runAction(this.playerAction('rebuy', player.id), () =>
          this.store.recordRebuy(this.sessionId, player.id, result.amount, result.comment)
        );

        if (succeeded) {
          this.flashRebuyRow(player.id);
        }
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
        data: { player, mode: player.status === 'COMPLETED' ? 'edit' : 'record' },
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
        transaction,
        canDelete: this.canDelete()
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
            `${transaction.type} - ${this.formatMoney(transaction.amount)} - ${new Date(
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
          (transaction.type === 'BUYIN' || transaction.type === 'REBUY') &&
          !transaction.deletedAt
      ).length ?? 0
    );
  }

  protected buyInTransactions(playerId: string): PokerTransaction[] {
    return this.store.buyInTransactionsForPlayer(this.session(), playerId);
  }

  protected activeBuyInCount(playerId: string): number {
    return this.buyInTransactions(playerId).filter((transaction) => !transaction.deletedAt).length;
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

  protected canDelete(): boolean {
    return this.authState.isHostAdmin();
  }

  protected canCloseSession(session: PokerSession): boolean {
    return session.status === 'ACTIVE' && session.players.every((player) => player.status === 'COMPLETED');
  }

  protected canRemovePlayer(session: PokerSession, _player: SessionPlayer): boolean {
    return session.status === 'ACTIVE' && this.canDelete();
  }

  protected isPending(action: string): boolean {
    return this.pendingAction() === action;
  }

  protected playerAction(action: string, playerId: string): string {
    return `${action}:${playerId}`;
  }

  protected tableAction(action: string, tableId: string): string {
    return `${action}:${tableId}`;
  }

  protected transactionAction(action: string, transactionId: string): string {
    return `${action}:${transactionId}`;
  }

  protected playerAccent(index: number): 'cyan' | 'amber' | 'fuchsia' | 'emerald' {
    return ['cyan', 'amber', 'fuchsia', 'emerald'][index % 4] as
      | 'cyan'
      | 'amber'
      | 'fuchsia'
      | 'emerald';
  }

  protected closeSession(): void {
    if (this.isBusy() || !this.canDelete()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession) {
      return;
    }

    const totals = this.store.totalsFor(currentSession);
    const pendingPlayers = currentSession.players.filter((player) => player.status === 'ACTIVE');

    if (!this.canCloseSession(currentSession)) {
      this.actionError.set('Cash out all players before closing this session.');
      return;
    }

    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Close session?',
          message: 'This marks the session completed and opens the final summary.',
          confirmLabel: 'Close session',
          tone: 'primary',
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

  protected deleteSession(): void {
    if (this.isBusy() || !this.canDelete()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession) {
      return;
    }

    const totals = this.store.totalsFor(currentSession);
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Delete session?',
          message:
            'This permanently removes the session, its members, and all buy-in, rebuy, cash-out, and net results tied to it.',
          confirmLabel: 'Delete session',
          tone: 'danger',
          details: [
            currentSession.name,
            `${totals.totalPlayers} players`,
            `${this.formatMoney(totals.totalBuyIn)} total buy-in`,
            `${this.formatMoney(totals.totalNet)} net result removed from totals`
          ]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      const deleted = await this.runAction('delete-session', async () => {
        await this.store.deleteSession(this.sessionId);
      });

      if (deleted) {
        await this.router.navigateByUrl(this.backLink, { replaceUrl: true });
      }
    });
  }

  protected confirmDeleteTable(table: PokerTable): void {
    if (this.isBusy() || !this.canDelete()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession || currentSession.status !== 'ACTIVE') {
      return;
    }

    const tableTotals = this.store.totalsForTable(currentSession, table.id);
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Delete table?',
          message:
            'This removes the table, its seated players, buy-ins, rebuys, cash-outs, and call-time records from this session.',
          confirmLabel: 'Delete table',
          tone: 'danger',
          details: [
            table.name,
            `${tableTotals.totalPlayers} players`,
            `${this.formatMoney(tableTotals.totalBuyIn)} total buy-in`
          ]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      const deleted = await this.runAction(this.tableAction('delete-table', table.id), async () => {
        await this.store.deleteTable(this.sessionId, table.id);
      });

      if (deleted) {
        this.selectedTableId.set(null);
        this.expandedTableIds.update((tableIds) =>
          tableIds.filter((currentTableId) => currentTableId !== table.id)
        );
        this.expandedPlayerId.set(null);
      }
    });
  }

  protected confirmRemoveSessionPlayer(player: SessionPlayer): void {
    if (this.isBusy() || !this.canDelete()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession || currentSession.status !== 'ACTIVE') {
      return;
    }

    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        autoFocus: false,
        data: {
          title: 'Remove player?',
          message:
            'This removes the player from this session and removes their buy-in, rebuy, cash-out, and call-time records from this session.',
          confirmLabel: 'Remove player',
          tone: 'danger',
          details: [player.name]
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      const removed = await this.runAction(this.playerAction('remove-player', player.id), () =>
        this.store.removeSessionPlayer(this.sessionId, player.id)
      );

      if (removed) {
        this.expandedPlayerId.set(null);
      }
    });
  }

  private async runAction(action: string, task: () => Promise<void>): Promise<boolean> {
    if (this.pendingAction()) {
      return false;
    }

    this.clearSuccessToast();
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

      if (succeeded) {
        this.showSuccessToast('Saved');
      }

      return succeeded;
    }
  }

  private flashRebuyRow(playerId: string): void {
    this.clearRebuyGlow();
    this.recentRebuyPlayerId.set(playerId);
    this.rebuyGlowTimer = setTimeout(() => {
      this.recentRebuyPlayerId.set(null);
      this.rebuyGlowTimer = null;
    }, 1300);
  }

  private clearRebuyGlow(): void {
    if (this.rebuyGlowTimer) {
      clearTimeout(this.rebuyGlowTimer);
      this.rebuyGlowTimer = null;
    }

    this.recentRebuyPlayerId.set(null);
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

  private waitForMinimumActionDelay(startedAt: number): Promise<void> {
    const remainingMs = Math.max(0, 750 - (Date.now() - startedAt));

    if (remainingMs === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => window.setTimeout(resolve, remainingMs));
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  }

  private emptySession() {
    return {
      id: '',
      name: '',
      sessionDate: '',
      status: 'ACTIVE' as const,
      createdAt: '',
      closedAt: null,
      tables: [] as PokerTable[],
      players: [] as SessionPlayer[],
      transactions: [] as PokerTransaction[],
      timeCalls: []
    };
  }

  private toMessage(error: unknown): string {
    return messageFromUnknownError(error, 'Unable to save changes.');
  }
}
