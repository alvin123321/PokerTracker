import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerStoreService,
  RecordedHand,
  RecordedHandActionType,
  RecordedHandBoardCard,
  RecordedHandStreet,
  SaveRecordedHandInput,
  SessionPlayer,
  PokerTransaction
} from '../data/poker-store.service';
import {
  RecordHandDialogComponent,
  RecordHandDialogData
} from '../../recorded-hands/record-hand-dialog.component';
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

      @if (isBusy()) {
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

          <div class="flex flex-wrap gap-3 lg:justify-end">
            <button
              type="button"
              [disabled]="isBusy() || currentSession.players.length === 0"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-800 disabled:text-neutral-500"
              (click)="openRecordHandDialog()"
            >
              @if (isPending('record-hand')) {
                <span class="action-spinner" aria-hidden="true"></span>
                Saving...
              } @else {
                Record Hand
              }
            </button>
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
                Add New Member
              }
            </button>
            @if (canDelete()) {
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
            }
            @if (canDelete()) {
              <button
                type="button"
                [disabled]="isBusy()"
                aria-label="Delete session"
                title="Delete session"
                class="pokertrack-icon-button"
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
              Add New Member
            </button>
          </div>
        } @else {
          @if (recordedHands().length > 0) {
            <section class="rounded-lg border border-white/10 bg-white/[0.04]">
              <div class="flex flex-col gap-1 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 class="text-sm font-semibold uppercase text-neutral-500">Recorded hands</h2>
                <p class="text-sm text-neutral-500">{{ recordedHands().length }} hand(s)</p>
              </div>
              <div class="grid gap-3 p-3 lg:grid-cols-2">
                @for (hand of recordedHands(); track hand.id) {
                  <article
                    class="rounded-lg border border-white/10 bg-neutral-950 p-4 transition duration-300 ease-in-out hover:border-emerald-300/45"
                    [class.lg:col-span-2]="expandedRecordedHandId() === hand.id"
                    role="button"
                    tabindex="0"
                    (click)="toggleRecordedHand(hand.id)"
                    (keydown.enter)="toggleRecordedHand(hand.id)"
                    (keydown.space)="toggleRecordedHand(hand.id)"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="flex flex-wrap gap-2">
                          @for (tag of hand.tags; track tag) {
                            <span class="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-neutral-950">
                              {{ tag }}
                            </span>
                          } @empty {
                            <span class="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-neutral-400">
                              Recorded hand
                            </span>
                          }
                        </div>
                        <p class="mt-2 text-sm text-neutral-400">
                          {{ hand.createdAt | date: 'short' }} · {{ hand.status }}
                        </p>
                      </div>
                      <span class="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-neutral-300">
                        {{ hand.actions.length }} actions
                      </span>
                    </div>
                    <p class="mt-3 text-sm text-neutral-300">
                      <span class="text-neutral-500">Players:</span> {{ handPlayerNames(hand) }}
                    </p>
                    <p class="mt-1 text-sm text-neutral-300">
                      <span class="text-neutral-500">Board:</span> {{ handBoardLabel(hand.board) }}
                    </p>
                    @if (hand.comment) {
                      <p class="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-neutral-300">
                        {{ hand.comment }}
                      </p>
                    }
                    @if (hand.actions.length > 0) {
                      <p class="mt-3 text-xs font-semibold uppercase text-neutral-500">
                        {{ handActionsPreview(hand) }}
                      </p>
                    }
                    @if (expandedRecordedHandId() === hand.id) {
                      <div class="mt-4 grid gap-3 border-t border-white/10 pt-4">
                        <div class="rounded-xl border border-emerald-300/20 bg-emerald-950/10 p-4">
                          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p class="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Board</p>
                              <p class="mt-1 text-sm text-neutral-400">{{ handBoardLabel(hand.board) }}</p>
                            </div>
                            <span class="rounded-full bg-white/[0.07] px-3 py-1 text-xs font-bold text-neutral-300">
                              {{ hand.playerIds.length }} players
                            </span>
                          </div>
                          <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            @for (card of hand.board; track card.rank + card.suit) {
                              <span
                                class="grid h-24 place-items-center rounded-lg bg-white text-3xl font-black text-neutral-950 shadow-lg shadow-black/30"
                                [class.text-red-600]="isRedSuit(card.suit)"
                              >
                                <span>{{ card.rank }}{{ suitSymbol(card.suit) }}</span>
                              </span>
                            } @empty {
                              <span class="col-span-full rounded-lg border border-dashed border-white/15 p-6 text-center text-sm font-semibold text-neutral-500">
                                No board cards recorded.
                              </span>
                            }
                          </div>
                        </div>

                        <div class="grid gap-3 xl:grid-cols-4">
                          @for (street of streetOptions; track street) {
                            <section class="rounded-lg border border-white/10 bg-black/20 p-3">
                              <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                                <h3 class="text-sm font-black uppercase tracking-wide text-emerald-300">
                                  {{ streetLabel(street) }}
                                </h3>
                                <span class="rounded-full bg-white/[0.07] px-2 py-0.5 text-xs font-bold text-neutral-300">
                                  {{ actionsForHandStreet(hand, street).length }}
                                </span>
                              </div>
                              <div class="mt-3 grid gap-2">
                                @for (action of actionsForHandStreet(hand, street); track action.id) {
                                  <div
                                    class="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border p-2 text-sm"
                                    [class.border-emerald-300/25]="action.actionType === 'RAISE'"
                                    [class.bg-emerald-300/10]="action.actionType === 'RAISE'"
                                    [class.border-sky-300/25]="action.actionType === 'CALL'"
                                    [class.bg-sky-300/10]="action.actionType === 'CALL'"
                                    [class.border-teal-300/25]="action.actionType === 'CHECK'"
                                    [class.bg-teal-300/10]="action.actionType === 'CHECK'"
                                    [class.border-red-300/25]="action.actionType === 'FOLD'"
                                    [class.bg-red-300/10]="action.actionType === 'FOLD'"
                                    [class.border-yellow-300/25]="action.actionType === 'BET'"
                                    [class.bg-yellow-300/10]="action.actionType === 'BET'"
                                    [class.border-purple-300/25]="action.actionType === 'ALL_IN'"
                                    [class.bg-purple-300/10]="action.actionType === 'ALL_IN'"
                                  >
                                    <span class="text-lg font-black">{{ actionIcon(action.actionType) }}</span>
                                    <span class="min-w-0">
                                      <span class="block truncate font-bold text-white">{{ action.playerName }}</span>
                                      <span class="text-xs font-semibold text-neutral-400">
                                        {{ actionLabel(action.actionType) }}
                                      </span>
                                    </span>
                                    @if (action.amount !== null) {
                                      <span class="font-black text-white">
                                        {{ action.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                                      </span>
                                    }
                                  </div>
                                } @empty {
                                  <p class="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs font-semibold text-neutral-500">
                                    No action
                                  </p>
                                }
                              </div>
                            </section>
                          }
                        </div>
                      </div>
                    }
                  </article>
                }
              </div>
            </section>
          }

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
                class="player-row border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.035]"
                [class.opacity-70]="player.status === 'COMPLETED'"
                [class.player-row-rebuy-glow]="recentRebuyPlayerId() === player.id"
              >
                <div class="lg:hidden">
                  <div
                    class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2"
                    (click)="togglePlayer(player.id)"
                  >
                    <button
                      type="button"
                      class="min-w-0 text-left"
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

                    @if (player.status !== 'COMPLETED') {
                      <button
                        type="button"
                        [disabled]="isBusy()"
                        class="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
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
                      class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-500"
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

                <div
                  class="hidden cursor-pointer gap-3 px-4 py-2.5 lg:grid lg:grid-cols-[1.35fr_0.75fr_0.85fr_0.85fr_0.55fr_0.8fr_1.25fr] lg:items-center"
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

                  <div>
                    <span
                      class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
                      [class.border-emerald-300/40]="player.status === 'ACTIVE'"
                      [class.bg-emerald-950]="player.status === 'ACTIVE'"
                      [class.text-emerald-100]="player.status === 'ACTIVE'"
                      [class.border-white/15]="player.status === 'COMPLETED'"
                      [class.bg-neutral-200]="player.status === 'COMPLETED'"
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
                  </div>
                </div>

                <div
                  class="player-detail-panel"
                  [class.player-detail-panel-open]="isExpanded(player.id)"
                  [attr.aria-hidden]="!isExpanded(player.id)"
                  [attr.inert]="isExpanded(player.id) ? null : ''"
                >
                  <div class="player-detail-panel-inner border-t border-emerald-300/10 bg-neutral-950/80 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
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
                      <p class="hidden text-xs text-neutral-500 sm:block">
                        {{ canDelete() ? 'Host can edit or delete buy-ins' : 'Managers can edit buy-ins' }}
                      </p>
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
                </div>
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

      .pokertrack-sync-overlay {
        animation: pokertrack-sync-fade 180ms ease-out both;
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

      .player-row {
        position: relative;
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
  private readonly expandedPlayerId = signal<string | null>(null);
  protected readonly expandedRecordedHandId = signal<string | null>(null);
  protected readonly recentRebuyPlayerId = signal<string | null>(null);
  protected readonly streetOptions: RecordedHandStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private rebuyGlowTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successToast = signal<string | null>(null);

  protected readonly session = computed(() => this.store.getSession(this.sessionId));
  protected readonly sortedPlayers = computed(() =>
    this.store.sortedPlayersForActiveSession(this.session())
  );
  protected readonly recordedHands = computed(() => this.store.recordedHandsForSession(this.session()));
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
      return 'Adding member...';
    }

    if (action?.startsWith('rebuy:')) {
      return 'Recording rebuy...';
    }

    if (action?.startsWith('cash-out:')) {
      return 'Recording cash out...';
    }

    if (action === 'record-hand') {
      return 'Saving hand...';
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

  protected openRecordHandDialog(): void {
    if (this.isBusy()) {
      return;
    }

    const currentSession = this.session();

    if (!currentSession || currentSession.players.length === 0) {
      return;
    }

    const dialogRef = this.dialog.open<
      RecordHandDialogComponent,
      RecordHandDialogData,
      SaveRecordedHandInput
    >(RecordHandDialogComponent, {
      autoFocus: false,
      data: { session: currentSession, accent: 'emerald' },
      width: '96vw',
      maxWidth: '98vw',
      maxHeight: '96vh',
      panelClass: 'pokertrack-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(async (result?: SaveRecordedHandInput) => {
      if (!result) {
        return;
      }

      await this.runAction('record-hand', () => this.store.saveRecordedHand(result));
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
          transaction.type === 'REBUY' &&
          !transaction.deletedAt
      ).length ?? 0
    );
  }

  protected buyInTransactions(playerId: string): PokerTransaction[] {
    return this.store.buyInTransactionsForPlayer(this.session(), playerId);
  }

  protected handPlayerNames(hand: RecordedHand): string {
    const currentSession = this.session();

    return (
      hand.playerIds
        .map(
          (playerId) =>
            currentSession?.players.find((player) => player.id === playerId)?.name ?? 'Unknown'
        )
        .join(', ') || 'No players selected'
    );
  }

  protected handBoardLabel(board: RecordedHandBoardCard[]): string {
    return board.map((card) => `${card.rank}${this.suitSymbol(card.suit)}`).join(' ') || 'No board';
  }

  protected handActionsPreview(hand: RecordedHand): string {
    return hand.actions
      .slice(0, 4)
      .map(
        (action) =>
          `${this.streetLabel(action.street)}: ${action.playerName} ${this.actionLabel(
            action.actionType
          )}${action.amount === null ? '' : ` ${this.formatMoney(action.amount)}`}`
      )
      .join(' · ');
  }

  protected toggleRecordedHand(handId: string): void {
    this.expandedRecordedHandId.update((currentHandId) =>
      currentHandId === handId ? null : handId
    );
  }

  protected actionsForHandStreet(
    hand: RecordedHand,
    street: RecordedHandStreet
  ): RecordedHand['actions'] {
    return hand.actions.filter((action) => action.street === street);
  }

  protected streetLabel(street: RecordedHandStreet): string {
    return street.charAt(0) + street.slice(1).toLowerCase();
  }

  protected actionLabel(action: RecordedHandActionType): string {
    return action === 'ALL_IN' ? 'All In' : action.charAt(0) + action.slice(1).toLowerCase();
  }

  protected actionIcon(action: RecordedHandActionType): string {
    return {
      RAISE: 'R',
      CALL: 'C',
      CHECK: 'K',
      FOLD: 'F',
      BET: 'B',
      ALL_IN: '!'
    }[action];
  }

  protected suitSymbol(suit: RecordedHandBoardCard['suit']): string {
    return {
      HEART: '♥',
      DIAMOND: '♦',
      CLUB: '♣',
      SPADE: '♠'
    }[suit];
  }

  protected isRedSuit(suit: RecordedHandBoardCard['suit']): boolean {
    return suit === 'HEART' || suit === 'DIAMOND';
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
    if (this.isBusy() || !this.canDelete()) {
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

      await this.runAction('delete-session', async () => {
        await this.store.deleteSession(this.sessionId);
        await this.router.navigate(['/host/dashboard']);
      });
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

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to save changes.';
  }
}
