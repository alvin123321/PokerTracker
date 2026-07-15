import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LucideDices, LucidePlus } from '@lucide/angular';

import { AuthStateService } from '../../core/auth/auth-state.service';
import {
  ActionFeedbackToastComponent,
  ActionFeedbackToastTone,
} from '../host/shared/action-feedback-toast.component';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../host/shared/confirmation-dialog.component';
import { MiniGamePanelComponent } from './mini-game-panel.component';
import { MiniGameService } from './mini-game.service';
import {
  MiniGameSettingsDialogComponent,
  MiniGameSettingsDialogData,
  MiniGameSettingsDialogResult,
} from './mini-game-settings-dialog.component';
import { MiniGameWinnerCelebrationComponent } from './mini-game-winner-celebration.component';
import { canClaimMiniGameCelebration } from './mini-game.logic';
import { MiniGameActionSuccess, MiniGameParticipant, MiniGameSnapshot } from './mini-game.models';

interface MiniGameFeedback {
  id: number;
  message: string;
  tone: ActionFeedbackToastTone;
}

@Component({
  selector: 'app-mini-game-dashboard-section',
  imports: [
    ActionFeedbackToastComponent,
    LucideDices,
    LucidePlus,
    MiniGamePanelComponent,
    MiniGameWinnerCelebrationComponent,
  ],
  template: `
    @if (miniGame.current(); as snapshot) {
      <app-mini-game-panel
        [snapshot]="snapshot"
        [canManage]="miniGame.canManage()"
        [activeAction]="miniGame.action()"
        (join)="join(snapshot)"
        (edit)="edit(snapshot)"
        (reshuffle)="confirmReshuffle(snapshot)"
        (start)="start(snapshot)"
        (revealTurn)="revealTurn(snapshot)"
        (revealRiver)="revealRiver(snapshot)"
        (completeGame)="complete(snapshot)"
        (deleteGame)="confirmDelete(snapshot)"
        (removePlayer)="confirmRemove(snapshot, $event)"
        (openDetail)="openDetail(snapshot)"
      />
    } @else if (canShowCreate() && !miniGame.loading()) {
      <section class="mini-game-empty-section">
        <div class="mini-game-empty-heading">
          <svg lucideDices [strokeWidth]="2.1" aria-hidden="true"></svg>
          <h2>Mini game</h2>
        </div>
        <div class="mini-game-empty-action">
          <button type="button" (click)="create()">
            <svg lucidePlus [strokeWidth]="2.2" aria-hidden="true"></svg>
            Create mini game
          </button>
        </div>
      </section>
    }

    @if (feedback(); as message) {
      <app-action-feedback-toast
        [attr.data-feedback-id]="message.id"
        [message]="message.message"
        [tone]="message.tone"
      />
    }

    @if (celebration(); as completedGame) {
      <app-mini-game-winner-celebration
        [snapshot]="completedGame"
        (dismiss)="dismissCelebration()"
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      :host:empty {
        display: none;
      }

      .mini-game-empty-section {
        display: grid;
        gap: 0.9rem;
        border-top: 1px solid rgb(255 255 255 / 0.08);
        padding: 1rem 0;
      }

      .mini-game-empty-heading {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        color: rgb(110 231 183);
      }

      .mini-game-empty-heading svg {
        width: 1.15rem;
        height: 1.15rem;
      }

      .mini-game-empty-heading h2 {
        margin: 0;
        color: rgb(248 250 252);
        font-size: 0.9rem;
        line-height: 1.1;
      }

      .mini-game-empty-action {
        display: flex;
        justify-content: center;
      }

      .mini-game-empty-action button {
        display: inline-flex;
        min-height: 2.45rem;
        align-items: center;
        gap: 0.38rem;
        border: 0;
        border-radius: 0.42rem;
        background: rgb(52 211 153);
        padding: 0.58rem 0.72rem;
        color: rgb(3 18 14);
        font-size: 0.72rem;
        font-weight: 820;
      }

      .mini-game-empty-action button svg {
        width: 0.88rem;
        height: 0.88rem;
      }

      @media (min-width: 640px) {
        .mini-game-empty-section {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
        }

        .mini-game-empty-action {
          justify-content: end;
        }
      }
    `,
  ],
})
export class MiniGameDashboardSectionComponent implements OnDestroy {
  readonly showCreate = input(false);
  protected readonly miniGame = inject(MiniGameService);
  private readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly feedback = signal<MiniGameFeedback | null>(null);
  protected readonly celebration = signal<MiniGameSnapshot | null>(null);
  protected readonly canShowCreate = computed(
    () => this.showCreate() && this.authState.profile()?.role === 'HOST',
  );
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackId = 0;
  private readonly celebrationChecks = new Set<string>();

  constructor() {
    effect(() => {
      const snapshot = this.miniGame.current();

      if (
        !snapshot ||
        !canClaimMiniGameCelebration(snapshot) ||
        this.celebrationChecks.has(snapshot.id)
      ) {
        return;
      }

      this.celebrationChecks.add(snapshot.id);
      queueMicrotask(async () => {
        if (await this.miniGame.claimCelebration(snapshot.id)) {
          this.celebration.set(snapshot);
          this.celebrationTimer = setTimeout(() => this.celebration.set(null), 4200);
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
  }

  protected create(): void {
    this.openSettings({ mode: 'create', minPlayers: 2, maxPlayers: 10 }, async (settings) => {
      const result = await this.miniGame.create(
        settings.name,
        settings.minPlayers,
        settings.maxPlayers,
      );
      this.showResult(result, 'Mini-game created.');
    });
  }

  protected edit(snapshot: MiniGameSnapshot): void {
    this.openSettings(
      {
        mode: 'edit',
        name: snapshot.name,
        minPlayers: snapshot.minPlayers,
        maxPlayers: snapshot.maxPlayers,
      },
      async (settings) => {
        const result = await this.miniGame.update(
          snapshot.id,
          settings.name,
          settings.minPlayers,
          settings.maxPlayers,
        );
        this.showResult(result, 'Mini-game updated.');
      },
    );
  }

  protected join(snapshot: MiniGameSnapshot): void {
    void this.runAction(() => this.miniGame.join(snapshot.id), 'You joined the mini-game.');
  }

  protected start(snapshot: MiniGameSnapshot): void {
    void this.runAction(() => this.miniGame.start(snapshot.id), 'Flop revealed.');
  }

  protected revealTurn(snapshot: MiniGameSnapshot): void {
    void this.runAction(() => this.miniGame.revealTurn(snapshot.id), 'Turn revealed.');
  }

  protected revealRiver(snapshot: MiniGameSnapshot): void {
    void this.runAction(() => this.miniGame.revealRiver(snapshot.id), 'River revealed.');
  }

  protected complete(snapshot: MiniGameSnapshot): void {
    void this.runAction(
      () => this.miniGame.archive(snapshot.id),
      'Mini-game completed and saved to history.',
    );
  }

  protected confirmReshuffle(snapshot: MiniGameSnapshot): void {
    this.confirm(
      {
        title: 'Reshuffle all cards?',
        message: 'Every joined player will receive a new public hand.',
        confirmLabel: 'Yes, reshuffle',
        cancelLabel: 'No',
      },
      () => this.runAction(() => this.miniGame.reshuffle(snapshot.id), 'Cards reshuffled.'),
    );
  }

  protected confirmDelete(snapshot: MiniGameSnapshot): void {
    this.confirm(
      {
        title: 'Delete mini-game?',
        message: 'This game will disappear from dashboards and history.',
        confirmLabel: 'Yes, delete',
        cancelLabel: 'No',
        tone: 'danger',
      },
      () => this.runAction(() => this.miniGame.delete(snapshot.id), 'Mini-game deleted.'),
    );
  }

  protected confirmRemove(snapshot: MiniGameSnapshot, participant: MiniGameParticipant): void {
    this.confirm(
      {
        title: `Remove ${participant.displayName}?`,
        message: 'Their cards return to the deck. They can join again before the game starts.',
        confirmLabel: 'Yes, remove',
        cancelLabel: 'No',
        tone: 'danger',
      },
      () =>
        this.runAction(
          () => this.miniGame.remove(snapshot.id, participant.id),
          `${participant.displayName} removed.`,
        ),
    );
  }

  protected openDetail(snapshot: MiniGameSnapshot): void {
    const routeRoot = this.authState.profile()?.role === 'PLAYER' ? '/player' : '/host';
    void this.router.navigate([routeRoot, 'mini-games', snapshot.id]);
  }

  protected dismissCelebration(): void {
    this.celebration.set(null);

    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
  }

  private openSettings(
    data: MiniGameSettingsDialogData,
    save: (settings: MiniGameSettingsDialogResult) => Promise<void>,
  ): void {
    this.dialog
      .open<
        MiniGameSettingsDialogComponent,
        MiniGameSettingsDialogData,
        MiniGameSettingsDialogResult
      >(MiniGameSettingsDialogComponent, {
        data,
        autoFocus: false,
        width: 'calc(100vw - 2rem)',
        maxWidth: '27rem',
      })
      .afterClosed()
      .subscribe((settings) => {
        if (settings) {
          void save(settings).catch((error) => this.showError(error));
        }
      });
  }

  private confirm(data: ConfirmationDialogData, confirmed: () => Promise<void>): void {
    this.dialog
      .open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
        ConfirmationDialogComponent,
        { data, autoFocus: false },
      )
      .afterClosed()
      .subscribe((accepted) => {
        if (accepted) {
          void confirmed().catch((error) => this.showError(error));
        }
      });
  }

  private async runAction(
    action: () => Promise<MiniGameActionSuccess>,
    successMessage: string,
  ): Promise<void> {
    try {
      this.showResult(await action(), successMessage);
    } catch (error) {
      this.showError(error);
    }
  }

  private showResult(result: MiniGameActionSuccess, successMessage: string): void {
    this.showFeedback(result.warning ?? successMessage, result.warning ? 'info' : 'success');
  }

  private showError(error: unknown): void {
    this.showFeedback(
      error instanceof Error ? error.message : 'Unable to update the mini-game.',
      'error',
    );
  }

  private showFeedback(message: string, tone: ActionFeedbackToastTone): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    this.feedback.set({ id: ++this.feedbackId, message, tone });
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), tone === 'error' ? 4200 : 3000);
  }
}
