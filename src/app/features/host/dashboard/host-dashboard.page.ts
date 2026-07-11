import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  defaultPokerTableName,
  PokerTransaction,
  PokerSession,
  PokerStoreService,
  SessionPlayer
} from '../data/poker-store.service';
import {
  sortDashboardTablePlayers,
  shouldShowActiveSessionsEmptyState,
  shouldShowActiveSessionsLoadingState
} from './host-dashboard.logic';
import { gameTimelineTransactions } from '../data/session-timeline.logic';
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
        <h1 class="sr-only">Dashboard</h1>
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

      @if (shouldShowDashboardLoader()) {
        <section
          class="dashboard-loading-state mx-auto w-full max-w-5xl"
          [class.dashboard-loading-state-exit]="dashboardLoaderLeaving()"
        >
          <article class="overflow-hidden rounded-lg border border-emerald-300/25 bg-neutral-950/70 p-6 text-center shadow-[0_22px_60px_rgba(0,0,0,0.28)] ring-1 ring-emerald-300/10 sm:p-8">
            <div class="deck-shuffle mx-auto mb-5" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p class="text-lg font-semibold text-white">Loading sessions</p>
          </article>
        </section>
      } @else if (shouldShowEmptyState()) {
        <section class="dashboard-content-state dashboard-empty-state mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
          <article class="empty-session-hero overflow-hidden rounded-lg border border-emerald-300/35 bg-neutral-950/78 p-5 text-center shadow-[0_22px_60px_rgba(0,0,0,0.36)] ring-1 ring-emerald-300/10 sm:p-8">
            <div class="empty-poker-table mx-auto" aria-hidden="true">
              <span class="empty-poker-table-pattern"></span>
              <span class="empty-poker-seat empty-poker-seat-top"></span>
              <span class="empty-poker-seat empty-poker-seat-right-top"></span>
              <span class="empty-poker-seat empty-poker-seat-right-bottom"></span>
              <span class="empty-poker-seat empty-poker-seat-bottom"></span>
              <span class="empty-poker-seat empty-poker-seat-left-bottom"></span>
              <span class="empty-poker-seat empty-poker-seat-left-top"></span>
              <span class="empty-poker-felt">
                <span class="empty-poker-spade">♠</span>
              </span>
            </div>

            <div class="mx-auto mt-6 max-w-xl">
              <p class="empty-session-title text-2xl font-semibold text-white sm:text-3xl">No active session</p>
              <p class="empty-session-copy mt-3 text-sm leading-6 text-neutral-300 sm:text-base">
                Start a session first, then create tables and seat players.
              </p>
            </div>

            <a
              routerLink="/host/sessions/new"
              class="empty-session-action mt-6 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border px-5 text-base font-semibold transition sm:max-w-sm"
            >
              <span class="empty-session-action-cross" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              <span class="empty-session-action-label">Create New Session</span>
            </a>
          </article>

          <section class="whats-next-panel rounded-lg border border-white/10 bg-neutral-950/60 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.26)] sm:p-5">
            <div class="flex items-center gap-3">
              <span class="whats-next-line h-px flex-1"></span>
              <h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-300">What's next</h2>
              <span class="whats-next-line h-px flex-1"></span>
            </div>

            <div class="whats-next-grid mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <article class="whats-next-step rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <span class="whats-next-number">1</span>
                <img
                  class="whats-next-icon"
                  src="/icons/dashboard-steps/create-session.svg"
                  alt=""
                  aria-hidden="true"
                />
                <h3 class="mt-3 text-base font-semibold text-white">Create Session</h3>
                <p class="whats-next-copy mt-2 text-sm leading-5 text-neutral-400">Open the session for today.</p>
              </article>

              <article class="whats-next-step rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <span class="whats-next-number">2</span>
                <img
                  class="whats-next-icon"
                  src="/icons/dashboard-steps/add-table.svg"
                  alt=""
                  aria-hidden="true"
                />
                <h3 class="mt-3 text-base font-semibold text-white">Add Tables</h3>
                <p class="whats-next-copy mt-2 text-sm leading-5 text-neutral-400">Create one or more tables.</p>
              </article>

              <article class="whats-next-step rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <span class="whats-next-number">3</span>
                <img
                  class="whats-next-icon"
                  src="/icons/dashboard-steps/add-player.svg"
                  alt=""
                  aria-hidden="true"
                />
                <h3 class="mt-3 text-base font-semibold text-white">Add Players</h3>
                <p class="whats-next-copy mt-2 text-sm leading-5 text-neutral-400">Seat players and track buy-ins.</p>
              </article>
            </div>
          </section>
        </section>
      } @else {
        <section class="dashboard-content-state space-y-4">
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
                    <span class="grid w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
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

                      <span class="dashboard-status-pill dashboard-status-pill-active justify-self-end">
                        <span class="dashboard-status-dot" aria-hidden="true"></span>
                        Active
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
                        <span class="dashboard-stat-icon dashboard-stat-icon-players" aria-hidden="true"></span>
                        <span class="dashboard-stat-copy">
                          <span class="dashboard-stat-value">
                            {{ activePlayerCount(session) }}
                          </span>
                          <span class="dashboard-stat-label">Active</span>
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
                      <span class="dashboard-add-table-label">Add Table</span>
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
                                    class="border-t p-0 opacity-0 transition-opacity duration-300 ease-in-out"
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
                                    @for (player of dashboardPlayersForTable(session, table.id); track player.id) {
                                      <div
                                        class="dashboard-player-row border-b border-white/10 last:border-b-0"
                                        [class.dashboard-player-row-open]="isDashboardPlayerExpanded(player.id)"
                                        [class.dashboard-rebuy-glow]="isRecentRebuyPlayer(player.id)"
                                      >
                                        <div
                                          class="grid cursor-pointer gap-3 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                                          role="button"
                                          tabindex="0"
                                          [attr.aria-expanded]="isDashboardPlayerExpanded(player.id)"
                                          (click)="toggleDashboardPlayer(player.id)"
                                          (keydown.enter)="toggleDashboardPlayer(player.id)"
                                          (keydown.space)="$event.preventDefault(); toggleDashboardPlayer(player.id)"
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
                                              <span
                                                class="dashboard-player-net-inline"
                                                [class.dashboard-player-net-positive]="player.net >= 0"
                                                [class.dashboard-player-net-negative]="player.net < 0"
                                              >
                                                Net
                                                <strong>{{ player.net | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                                              </span>
                                            }
                                          </div>
                                          <p class="mt-1 hidden text-xs text-neutral-500 md:block">
                                            Tap to view game timeline
                                          </p>
                                        </div>

                                        <div
                                          class="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-[8rem_7rem_7rem] md:min-w-[22rem]"
                                          (keydown.enter)="$event.stopPropagation()"
                                          (keydown.space)="$event.stopPropagation()"
                                        >
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
                                              (click)="$event.stopPropagation(); openRebuyDialog(session.id, player)"
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
                                              (click)="$event.stopPropagation(); openCashOutDialog(session.id, player)"
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

                                        <div
                                          class="dashboard-player-timeline"
                                          [class.dashboard-player-timeline-open]="isDashboardPlayerExpanded(player.id)"
                                          [attr.aria-hidden]="!isDashboardPlayerExpanded(player.id)"
                                        >
                                          <div class="dashboard-player-timeline-inner">
                                            <div class="mb-2 flex items-center justify-between gap-3">
                                              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Game timeline</span>
                                              <span class="text-xs text-neutral-500">{{ dashboardPlayerTimelineTransactions(session, player.id).length }} records</span>
                                            </div>

                                            @if (dashboardPlayerTimelineTransactions(session, player.id).length === 0) {
                                              <div class="rounded-lg border border-dashed border-white/10 bg-black/15 p-3 text-sm text-neutral-500">
                                                No timeline recorded.
                                              </div>
                                            } @else {
                                              <div class="grid gap-2 sm:grid-cols-2">
                                                @for (transaction of dashboardPlayerTimelineTransactions(session, player.id); track transaction.id) {
                                                  <div
                                                    class="dashboard-timeline-item"
                                                    [class.dashboard-timeline-item-buyin]="transaction.type === 'BUYIN'"
                                                    [class.dashboard-timeline-item-rebuy]="transaction.type === 'REBUY'"
                                                    [class.dashboard-timeline-item-cashout]="transaction.type === 'CASHOUT'"
                                                  >
                                                    <span class="text-xs font-semibold uppercase">{{ transactionLabel(transaction.type) }}</span>
                                                    <span class="text-sm text-neutral-400">{{ transaction.createdAt | date: 'shortTime' }}</span>
                                                    <span class="text-right text-base font-semibold text-white">
                                                      {{ transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                                                    </span>
                                                  </div>
                                                }
                                              </div>
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    } @empty {
                                      <div class="m-3 rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-neutral-500 sm:m-4">
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

    </section>
  `,
  styles: [
    `
      .session-overview-card {
        position: relative;
        isolation: isolate;
      }

      .dashboard-loading-state {
        animation: dashboard-loader-in 260ms ease-out both;
      }

      .dashboard-loading-state-exit {
        pointer-events: none;
        animation: dashboard-loader-out 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .dashboard-content-state {
        animation: dashboard-content-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .dashboard-empty-state {
        animation: dashboard-content-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      @keyframes dashboard-loader-in {
        from {
          opacity: 0;
          transform: translateY(0.35rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes dashboard-loader-out {
        from {
          opacity: 1;
          filter: blur(0);
          transform: translateY(0);
        }

        to {
          opacity: 0;
          filter: blur(5px);
          transform: translateY(-0.35rem);
        }
      }

      @keyframes dashboard-content-in {
        from {
          opacity: 0;
          filter: blur(4px);
          transform: translateY(0.45rem);
        }

        to {
          opacity: 1;
          filter: blur(0);
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .dashboard-loading-state,
        .dashboard-loading-state-exit,
        .dashboard-content-state,
        .dashboard-empty-state {
          animation-duration: 1ms;
          filter: none;
          transform: none;
        }
      }

      .empty-session-hero,
      .whats-next-panel {
        position: relative;
        isolation: isolate;
      }

      .empty-session-hero::before {
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          radial-gradient(circle at 50% 12%, rgba(45, 212, 191, 0.16), transparent 30%),
          radial-gradient(circle at 8% 100%, rgba(16, 185, 129, 0.12), transparent 34%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 48%);
        content: '';
      }

      .empty-poker-table {
        position: relative;
        width: min(82vw, 24rem);
        aspect-ratio: 1.55;
        filter: drop-shadow(0 22px 28px rgba(0, 0, 0, 0.34));
      }

      .empty-poker-table-pattern {
        position: absolute;
        inset: 4% 0;
        border-radius: 999px;
        background:
          radial-gradient(circle at 20% 24%, rgba(45, 212, 191, 0.2) 0 2px, transparent 3px),
          radial-gradient(circle at 78% 70%, rgba(16, 185, 129, 0.18) 0 2px, transparent 3px);
        opacity: 0.7;
      }

      .empty-poker-seat {
        position: absolute;
        width: 14%;
        height: 21%;
        border: 1px solid rgba(94, 234, 212, 0.46);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.82));
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.035), 0 0 18px rgba(45, 212, 191, 0.16);
      }

      .empty-poker-seat-top {
        top: 0;
        left: 50%;
        transform: translateX(-50%);
      }

      .empty-poker-seat-right-top {
        top: 20%;
        right: 2%;
        transform: rotate(76deg);
      }

      .empty-poker-seat-right-bottom {
        right: 2%;
        bottom: 20%;
        transform: rotate(104deg);
      }

      .empty-poker-seat-bottom {
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      }

      .empty-poker-seat-left-bottom {
        bottom: 20%;
        left: 2%;
        transform: rotate(-104deg);
      }

      .empty-poker-seat-left-top {
        top: 20%;
        left: 2%;
        transform: rotate(-76deg);
      }

      .empty-poker-felt {
        position: absolute;
        inset: 17% 12%;
        display: grid;
        place-items: center;
        border: 2px solid rgba(45, 212, 191, 0.84);
        border-radius: 999px;
        background:
          radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.22), transparent 42%),
          linear-gradient(135deg, rgba(6, 78, 59, 0.94), rgba(8, 47, 73, 0.88));
        box-shadow:
          inset 0 0 0 2px rgba(255, 255, 255, 0.055),
          inset 0 0 42px rgba(0, 0, 0, 0.38),
          0 0 34px rgba(45, 212, 191, 0.28);
      }

      .empty-poker-felt::before {
        position: absolute;
        inset: 22% 21%;
        border: 1px solid rgba(94, 234, 212, 0.48);
        border-radius: 999px;
        content: '';
      }

      .empty-poker-spade {
        color: rgba(94, 234, 212, 0.78);
        font-size: clamp(2rem, 9vw, 4.1rem);
        line-height: 1;
        text-shadow: 0 0 18px rgba(45, 212, 191, 0.34);
      }

      .empty-session-action {
        border-color: rgba(110, 231, 183, 0.46);
        background: rgba(16, 185, 129, 0.15);
        color: rgb(236, 253, 245);
        box-shadow: 0 0 30px rgba(45, 212, 191, 0.18);
      }

      .empty-session-action-cross {
        display: inline-grid;
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        place-items: center;
        color: rgb(110, 231, 183);
        transform: translateY(-0.08rem);
        transition: color 180ms ease, filter 180ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .empty-session-action-cross svg {
        display: block;
        width: 1.25rem;
        height: 1.25rem;
      }

      .empty-session-action-label {
        font-family: 'OCR A Extended', 'Agency FB', 'Bahnschrift SemiCondensed', Consolas, monospace;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.07em;
        transform: translateY(0.03rem);
      }

      .empty-session-action:hover {
        border-color: rgba(167, 243, 208, 0.7);
        background: rgba(16, 185, 129, 0.22);
        color: #fff;
        box-shadow:
          0 0 36px rgba(45, 212, 191, 0.32),
          0 0 0 1px rgba(110, 231, 183, 0.1);
        transform: translateY(-1px);
      }

      .empty-session-action:hover .empty-session-action-cross {
        color: rgb(167, 243, 208);
        filter: drop-shadow(0 0 10px rgba(52, 211, 153, 0.42));
        transform: translateY(-0.13rem) scale(1.1);
      }

      .empty-session-action:active {
        box-shadow: 0 0 20px rgba(45, 212, 191, 0.22);
        transform: translateY(1px) scale(0.985);
      }

      .empty-session-action:active .empty-session-action-cross {
        transform: translateY(-0.05rem) scale(0.92);
      }

      @media (prefers-reduced-motion: reduce) {
        .empty-session-action-cross {
          transition-duration: 1ms;
        }
      }

      .whats-next-line {
        background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.44), transparent);
      }

      .whats-next-step {
        position: relative;
        display: flex;
        min-height: 10.75rem;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        overflow: hidden;
        padding-top: 0.35rem;
        text-align: center;
        transition:
          border-color 180ms ease,
          background 180ms ease,
          transform 180ms ease,
          box-shadow 220ms ease;
      }

      .whats-next-step::before {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 18% 18%, rgba(45, 212, 191, 0.13), transparent 30%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 52%);
        content: '';
      }

      .whats-next-step > * {
        position: relative;
      }

      .whats-next-step:hover {
        border-color: rgba(94, 234, 212, 0.36);
        background: rgba(255, 255, 255, 0.065);
        box-shadow: 0 0 28px rgba(45, 212, 191, 0.1);
        transform: translateY(-1px);
      }

      .whats-next-step > .whats-next-number {
        position: absolute;
        top: 0.55rem;
        left: 0.55rem;
        display: inline-grid;
        width: 2.15rem;
        height: 2.15rem;
        place-items: center;
        border: 1px solid rgba(94, 234, 212, 0.58);
        border-radius: 999px;
        background: rgba(45, 212, 191, 0.82);
        color: rgb(4, 47, 46);
        font-size: 1.05rem;
        font-weight: 800;
        box-shadow: 0 0 18px rgba(45, 212, 191, 0.28);
      }

      .whats-next-icon {
        display: block;
        width: min(7.5rem, 72%);
        height: 5.7rem;
        margin-top: 0;
        filter: drop-shadow(0 0 8px rgba(99, 255, 232, 0.56))
          drop-shadow(0 0 18px rgba(45, 212, 191, 0.22));
        object-fit: contain;
        opacity: 1;
        transform: translateY(-0.35rem);
      }

      .whats-next-step h3 {
        margin-top: -0.15rem;
      }

      .whats-next-copy {
        max-width: 10.5rem;
        margin-right: auto;
        margin-left: auto;
      }

      @keyframes dashboard-empty-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 639px) {
        .empty-session-hero {
          padding: 1rem;
        }

        .empty-poker-table {
          width: min(78vw, 18.5rem);
        }

        .empty-session-title,
        .empty-session-copy,
        .whats-next-copy {
          display: none;
        }

        .whats-next-panel {
          padding: 0.85rem;
        }

        .whats-next-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .whats-next-step {
          display: block;
          height: 7.25rem;
          min-height: 7.25rem;
          padding: 0.95rem 0.35rem 0.65rem;
          text-align: center;
        }

        .whats-next-step .whats-next-number {
          position: absolute;
          top: 0.45rem;
          left: 0.45rem;
          width: 1.5rem;
          height: 1.5rem;
          font-size: 0.78rem;
        }

        .whats-next-icon {
          position: absolute;
          top: 0.45rem;
          left: 50%;
          width: min(4.6rem, 76%);
          height: 3.75rem;
          margin-top: 0;
          transform: translateX(-50%);
        }

        .whats-next-step h3 {
          position: absolute;
          right: 0;
          bottom: 0.65rem;
          left: 0;
          width: 100%;
          margin-top: 0;
          padding: 0 0.25rem;
          font-size: 0.78rem;
          line-height: 1.15;
          text-align: center;
        }

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

      .dashboard-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid rgba(52, 211, 153, 0.42);
        border-radius: 999px;
        background: rgba(22, 163, 74, 0.1);
        color: rgb(134, 239, 172);
        box-shadow: 0 0 18px rgba(34, 197, 94, 0.12);
        padding: 0.3rem 0.72rem;
        font-size: 0.72rem;
        font-weight: 850;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .dashboard-status-dot {
        width: 0.46rem;
        height: 0.46rem;
        border-radius: 999px;
        background: rgb(34, 197, 94);
        box-shadow:
          0 0 0 0.22rem rgba(34, 197, 94, 0.12),
          0 0 1rem rgba(34, 197, 94, 0.42);
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

      .dashboard-add-table-label {
        font-family: 'Orbitron', 'Rajdhani', 'Inter', system-ui, sans-serif;
        font-size: 0.92rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
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
export class HostDashboardPage implements OnInit, OnDestroy {
  protected readonly store = inject(PokerStoreService);
  protected readonly shouldShowActiveSessionsEmptyState = shouldShowActiveSessionsEmptyState;
  protected readonly shouldShowActiveSessionsLoadingState = shouldShowActiveSessionsLoadingState;
  private readonly dialog = inject(MatDialog);
  protected readonly pendingAction = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly initialLoadingWindowExpired = signal(false);
  protected readonly dashboardLoaderVisible = signal(true);
  protected readonly dashboardLoaderLeaving = signal(false);
  protected readonly expandedSessionId = signal<string | null | undefined>(undefined);
  protected readonly expandedTableId = signal<string | null | undefined>(undefined);
  protected readonly expandedDashboardPlayerId = signal<string | null>(null);
  protected readonly recentRebuyPlayerId = signal<string | null>(null);
  protected readonly recentRebuySessionId = signal<string | null>(null);
  private rebuyAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private initialLoadingTimer: ReturnType<typeof setTimeout> | null = null;
  private dashboardLoaderExitTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      this.initialLoadingWindowExpired.set(true);
      this.dashboardLoaderVisible.set(false);
      return;
    }

    if (this.store.sessionsLoaded()) {
      this.initialLoadingWindowExpired.set(true);
      this.dashboardLoaderVisible.set(false);
      return;
    }

    this.initialLoadingTimer = window.setTimeout(() => {
      this.revealDashboardContent();
      this.initialLoadingTimer = null;
    }, 900);
  }

  ngOnDestroy(): void {
    if (this.initialLoadingTimer) {
      clearTimeout(this.initialLoadingTimer);
      this.initialLoadingTimer = null;
    }

    if (this.dashboardLoaderExitTimer) {
      clearTimeout(this.dashboardLoaderExitTimer);
      this.dashboardLoaderExitTimer = null;
    }

    this.clearRebuyAnimation();
  }

  protected isSessionExpanded(sessionId: string): boolean {
    const expandedSessionId = this.expandedSessionId();

    if (expandedSessionId === undefined) {
      return this.store.activeSessions()[0]?.id === sessionId;
    }

    return expandedSessionId === sessionId;
  }

  protected shouldShowEmptyState(): boolean {
    return this.shouldShowActiveSessionsEmptyState({
      activeSessionCount: this.store.activeSessions().length,
      sessionsLoaded: this.store.sessionsLoaded(),
      initialLoadingWindowExpired: this.initialLoadingWindowExpired()
    });
  }

  protected shouldShowLoadingState(): boolean {
    return this.shouldShowActiveSessionsLoadingState({
      activeSessionCount: this.store.activeSessions().length,
      sessionsLoaded: this.store.sessionsLoaded(),
      initialLoadingWindowExpired: this.initialLoadingWindowExpired()
    });
  }

  protected shouldShowDashboardLoader(): boolean {
    return this.dashboardLoaderVisible();
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

  protected toggleDashboardPlayer(playerId: string): void {
    this.expandedDashboardPlayerId.update((currentPlayerId) =>
      currentPlayerId === playerId ? null : playerId
    );
  }

  protected isDashboardPlayerExpanded(playerId: string): boolean {
    return this.expandedDashboardPlayerId() === playerId;
  }

  protected dashboardPlayerTimelineTransactions(
    session: PokerSession,
    playerId: string
  ): PokerTransaction[] {
    return gameTimelineTransactions(
      session.transactions.filter((transaction) => transaction.playerId === playerId)
    );
  }

  protected dashboardPlayersForTable(
    session: PokerSession | undefined,
    tableId: string | null
  ): SessionPlayer[] {
    return sortDashboardTablePlayers(this.store.playersForTable(session, tableId));
  }

  protected activePlayerCount(session: PokerSession): number {
    return session.players.filter((player) => player.status === 'ACTIVE').length;
  }

  protected transactionLabel(type: PokerTransaction['type']): string {
    switch (type) {
      case 'BUYIN':
        return 'Buy-in';
      case 'REBUY':
        return 'Rebuy';
      case 'CASHOUT':
        return 'Cash out';
    }
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
        data: { tableName: defaultPokerTableName(nextNumber) },
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

  private revealDashboardContent(): void {
    this.initialLoadingWindowExpired.set(true);
    this.dashboardLoaderLeaving.set(true);

    this.dashboardLoaderExitTimer = window.setTimeout(() => {
      this.dashboardLoaderVisible.set(false);
      this.dashboardLoaderLeaving.set(false);
      this.dashboardLoaderExitTimer = null;
    }, 560);
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
