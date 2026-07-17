import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { MiniGameHistoryListComponent } from '../../mini-game/mini-game-history-list.component';
import { MiniGameHistoryToggleComponent } from '../../mini-game/mini-game-history-toggle.component';
import { miniGameHistoryViewFromQuery } from '../../mini-game/mini-game.logic';
import { MiniGameHistoryView, MiniGameSnapshot } from '../../mini-game/mini-game.models';
import { MiniGameService } from '../../mini-game/mini-game.service';
import { PokerSession, PokerStoreService } from '../data/poker-store.service';
import { ActionFeedbackToastComponent } from '../shared/action-feedback-toast.component';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../shared/confirmation-dialog.component';

@Component({
  selector: 'app-session-history-page',
  imports: [
    ActionFeedbackToastComponent,
    CurrencyPipe,
    DatePipe,
    MiniGameHistoryListComponent,
    MiniGameHistoryToggleComponent,
    RouterLink,
  ],
  template: `
    @if (actionFeedback(); as message) {
      <app-action-feedback-toast [message]="message" />
    }

    <section class="space-y-5 sm:space-y-6">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-white sm:text-3xl">History</h1>
        </div>
        <app-mini-game-history-toggle
          [view]="historyView()"
          (viewChange)="selectHistoryView($event)"
        />
      </div>

      @if (historyView() === 'mini-games') {
        @if (miniGame.error()) {
          <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ miniGame.error() }}
          </div>
        }

        <app-mini-game-history-list
          [games]="miniGame.history()"
          [loading]="miniGame.historyLoading()"
          [canDelete]="true"
          detailBasePath="/host/mini-games"
          (deleteGame)="confirmDeleteMiniGame($event)"
        />
      } @else {
        @if (store.error()) {
          <div class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ store.error() }}
          </div>
        }

        @if (store.sessions().length === 0) {
          <div
            class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center"
          >
            <p class="text-lg font-semibold text-white">No sessions yet</p>
            <p class="mt-2 text-sm text-neutral-400">
              Completed and active sessions will appear here.
            </p>
          </div>
        } @else {
          <div class="grid gap-4">
            @for (session of sortedSessions(); track session.id) {
              @let totals = store.totalsFor(session);
              <a
                [routerLink]="
                  session.status === 'COMPLETED'
                    ? ['/host/sessions', session.id, 'summary']
                    : ['/host/sessions', session.id]
                "
                [queryParams]="session.status === 'ACTIVE' ? { from: 'history' } : null"
                class="session-history-card rounded-lg border bg-white/[0.04] p-4 transition hover:border-emerald-300/50 hover:bg-white/[0.07] sm:p-5"
                [class.session-history-card-active]="session.status === 'ACTIVE'"
              >
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-3">
                      <h2 class="text-lg font-semibold text-white">{{ session.name }}</h2>
                      @if (session.status === 'ACTIVE') {
                        <span
                          class="rounded-md border border-emerald-300/40 px-2 py-1 text-xs font-semibold text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.16)]"
                        >
                          Active
                        </span>
                      } @else {
                        <span
                          class="text-lg font-bold leading-none text-emerald-300"
                          aria-label="Completed session"
                          >&check;</span
                        >
                      }
                    </div>
                    <p class="mt-1 text-sm text-neutral-400">
                      {{ session.sessionDate | date: 'mediumDate' }}
                    </p>
                  </div>

                  <div class="grid grid-cols-3 gap-3 text-sm md:min-w-96">
                    <div>
                      <p class="text-neutral-500">Players</p>
                      <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p class="font-semibold text-white">{{ totals.totalPlayers }}</p>
                        <p class="text-xs font-semibold text-emerald-300">
                          {{ totals.cashedOutPlayers }} cashed out
                        </p>
                      </div>
                    </div>
                    <div>
                      <p class="text-neutral-500">Buy-in</p>
                      <p class="mt-1 font-semibold text-white">
                        {{ totals.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-neutral-500">Net total</p>
                      @if (isNetPending(session)) {
                        <p class="mt-1 font-semibold text-amber-200">Pending</p>
                      } @else {
                        <p
                          class="mt-1 font-semibold"
                          [class.text-emerald-300]="adminNetTotal(session) >= 0"
                          [class.text-red-300]="adminNetTotal(session) < 0"
                        >
                          {{ adminNetTotal(session) | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </p>
                      }
                    </div>
                  </div>
                </div>
              </a>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .session-history-card {
        border-color: rgb(255 255 255 / 0.1);
      }

      .session-history-card-active {
        border-color: rgb(52 211 153 / 0.45);
        box-shadow: 0 0 24px rgb(52 211 153 / 0.12);
      }
    `,
  ],
})
export class SessionHistoryPage implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(PokerStoreService);
  protected readonly miniGame = inject(MiniGameService);
  protected readonly actionFeedback = signal<string | null>(null);
  protected readonly historyView = signal<MiniGameHistoryView>('tables');
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private viewSubscription: Subscription | null = null;
  protected readonly sortedSessions = computed(() =>
    [...this.store.sessions()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  ngOnInit(): void {
    this.viewSubscription = this.route.queryParamMap.subscribe((params) => {
      const view = miniGameHistoryViewFromQuery(params.get('view'));
      this.historyView.set(view);

      if (view === 'mini-games') {
        void this.miniGame.loadHistory();
      }
    });
  }

  ngOnDestroy(): void {
    this.viewSubscription?.unsubscribe();

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
  }

  protected confirmDeleteMiniGame(game: MiniGameSnapshot): void {
    this.dialog
      .open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
        ConfirmationDialogComponent,
        {
          autoFocus: false,
          data: {
            title: 'Delete completed mini-game?',
            message: 'This permanently removes this mini-game from history.',
            cancelLabel: 'No',
            confirmLabel: 'Yes, delete',
            tone: 'danger',
            details: [game.name],
          },
          panelClass: 'pokertrack-dialog-panel',
        },
      )
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          void this.deleteMiniGame(game);
        }
      });
  }

  protected selectHistoryView(view: MiniGameHistoryView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'mini-games' ? view : null },
      queryParamsHandling: 'merge',
    });
  }

  protected adminNetTotal(session: PokerSession): number {
    const totals = this.store.totalsFor(session);
    return totals.totalBuyIn - totals.totalCashOut;
  }

  protected isNetPending(session: PokerSession): boolean {
    return this.store.totalsFor(session).activePlayers > 0;
  }

  private async deleteMiniGame(game: MiniGameSnapshot): Promise<void> {
    try {
      await this.miniGame.delete(game.id);
      await this.miniGame.loadHistory();
      this.showFeedback('Mini-game deleted.');
    } catch {
      // MiniGameService exposes the actionable error through miniGame.error().
    }
  }

  private showFeedback(message: string): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    this.actionFeedback.set(message);
    this.feedbackTimer = setTimeout(() => this.actionFeedback.set(null), 3000);
  }
}
