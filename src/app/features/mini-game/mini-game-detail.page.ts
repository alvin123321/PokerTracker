import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideSpade } from '@lucide/angular';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { MiniGamePanelComponent } from './mini-game-panel.component';
import { MiniGameSnapshot } from './mini-game.models';
import { MiniGameService } from './mini-game.service';

@Component({
  selector: 'app-mini-game-detail-page',
  imports: [
    LucideArrowLeft,
    LucideSpade,
    MiniGamePanelComponent,
    RouterLink,
  ],
  template: `
    <section class="mini-detail-page">
      <a
        class="mini-detail-back"
        [routerLink]="backPath()"
        [queryParams]="backQueryParams()"
        aria-label="Back to mini-game history"
      >
        <svg lucideArrowLeft [strokeWidth]="2.2" aria-hidden="true"></svg>
        <span>Mini-game history</span>
      </a>

      @if (loading()) {
        <div class="mini-detail-state" aria-live="polite">
          <svg lucideSpade [strokeWidth]="1.8" aria-hidden="true"></svg>
          <strong>Loading game</strong>
        </div>
      } @else if (snapshot(); as game) {
        <app-mini-game-panel [snapshot]="game" [readOnly]="true" [showDetailButton]="false" />
      } @else {
        <div class="mini-detail-state">
          <svg lucideSpade [strokeWidth]="1.8" aria-hidden="true"></svg>
          <strong>Mini-game not found</strong>
          <span>{{ miniGame.error() ?? 'This result is not available.' }}</span>
        </div>
      }
    </section>

  `,
  styles: [
    `
      :host {
        display: block;
      }

      .mini-detail-page {
        display: grid;
        width: min(100%, 54rem);
        gap: 0.8rem;
        margin-inline: auto;
      }

      .mini-detail-back {
        display: inline-flex;
        width: fit-content;
        min-height: 2.5rem;
        align-items: center;
        gap: 0.45rem;
        border-radius: 0.4rem;
        padding: 0.45rem 0.1rem;
        color: rgb(110 231 183);
        font-size: 0.76rem;
        font-weight: 750;
        text-decoration: none;
      }

      .mini-detail-back svg {
        width: 1rem;
        height: 1rem;
      }

      .mini-detail-state {
        display: grid;
        min-height: 14rem;
        place-items: center;
        align-content: center;
        gap: 0.48rem;
        border: 1px dashed rgb(255 255 255 / 0.12);
        border-radius: 0.5rem;
        background: rgb(255 255 255 / 0.025);
        padding: 1.5rem;
        color: rgb(161 161 170);
        text-align: center;
        font-size: 0.75rem;
      }

      .mini-detail-state svg {
        width: 1.5rem;
        height: 1.5rem;
        color: rgb(251 191 36 / 0.74);
      }

      .mini-detail-state strong {
        color: white;
        font-size: 1rem;
      }

      .mini-detail-state span {
        color: rgb(113 113 122);
      }
    `,
  ],
})
export class MiniGameDetailPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  protected readonly miniGame = inject(MiniGameService);
  protected readonly loading = signal(true);
  protected readonly snapshot = signal<MiniGameSnapshot | null>(null);
  protected readonly backPath = computed(() =>
    this.authState.role() === 'PLAYER' ? '/player/dashboard' : '/host/sessions/history',
  );
  protected readonly backQueryParams = computed(() =>
    this.authState.role() === 'PLAYER'
      ? { tab: 'history', view: 'mini-games' }
      : { view: 'mini-games' },
  );

  async ngOnInit(): Promise<void> {
    const gameId = this.route.snapshot.paramMap.get('id');

    if (!gameId) {
      this.loading.set(false);
      return;
    }

    const snapshot = await this.miniGame.loadDetail(gameId);
    this.snapshot.set(snapshot);
    this.loading.set(false);
  }
}
