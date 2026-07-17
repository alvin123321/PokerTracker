import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LucideDices, LucideMinus, LucidePlus } from '@lucide/angular';

export interface MiniGameSettingsDialogData {
  mode: 'create' | 'edit';
  name?: string;
  minPlayers?: number;
  maxPlayers?: number;
}

export interface MiniGameSettingsDialogResult {
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

@Component({
  selector: 'app-mini-game-settings-dialog',
  imports: [FormsModule, LucideDices, LucideMinus, LucidePlus],
  template: `
    <form class="settings-dialog" (submit)="submit($event)">
      <header>
        <span class="settings-icon" aria-hidden="true">
          <svg lucideDices [strokeWidth]="2.1"></svg>
        </span>
        <div>
          <span>Texas Hold'em</span>
          <h2>{{ data.mode === 'create' ? 'Create mini-game' : 'Edit mini-game' }}</h2>
        </div>
      </header>

      <label class="settings-field">
        <span>Game name</span>
        <input
          name="mini-game-name"
          type="text"
          maxlength="40"
          autocomplete="off"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          placeholder="Friday side game"
          autofocus
        />
        <small>{{ name().trim().length }}/40</small>
      </label>

      <div class="settings-player-grid">
        <div class="settings-stepper">
          <span>Minimum</span>
          <div>
            <button type="button" aria-label="Decrease minimum players" (click)="changeMinimum(-1)">
              <svg lucideMinus [strokeWidth]="2.2"></svg>
            </button>
            <strong>{{ minPlayers() }}</strong>
            <button type="button" aria-label="Increase minimum players" (click)="changeMinimum(1)">
              <svg lucidePlus [strokeWidth]="2.2"></svg>
            </button>
          </div>
        </div>

        <div class="settings-stepper">
          <span>Maximum</span>
          <div>
            <button type="button" aria-label="Decrease maximum players" (click)="changeMaximum(-1)">
              <svg lucideMinus [strokeWidth]="2.2"></svg>
            </button>
            <strong>{{ maxPlayers() }}</strong>
            <button type="button" aria-label="Increase maximum players" (click)="changeMaximum(1)">
              <svg lucidePlus [strokeWidth]="2.2"></svg>
            </button>
          </div>
        </div>
      </div>

      @if (validationMessage(); as message) {
        <p class="settings-error" role="alert">{{ message }}</p>
      }

      <footer>
        <button type="button" class="settings-cancel" (click)="dialogRef.close()">Cancel</button>
        <button type="submit" class="settings-submit" [disabled]="!valid()">
          {{ data.mode === 'create' ? 'Create game' : 'Save changes' }}
        </button>
      </footer>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
        box-sizing: border-box;
        width: 100%;
        max-width: 27rem;
      }

      .settings-dialog {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        background: rgb(9 12 15);
        padding: 1rem;
        color: rgb(248 250 252);
      }

      header {
        display: flex;
        align-items: center;
        gap: 0.72rem;
      }

      .settings-icon {
        display: grid;
        width: 2.65rem;
        height: 2.65rem;
        flex: 0 0 auto;
        place-items: center;
        border: 1px solid rgb(52 211 153 / 0.22);
        border-radius: 0.48rem;
        background: rgb(16 185 129 / 0.09);
        color: rgb(110 231 183);
      }

      .settings-icon svg {
        width: 1.2rem;
        height: 1.2rem;
      }

      header span:not(.settings-icon) {
        color: rgb(110 231 183);
        font-size: 0.6rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      h2 {
        margin: 0.18rem 0 0;
        font-size: 1.08rem;
        line-height: 1.15;
      }

      .settings-field {
        position: relative;
        display: grid;
        gap: 0.38rem;
        margin-top: 1.1rem;
      }

      .settings-field > span,
      .settings-stepper > span {
        color: rgb(148 163 184);
        font-size: 0.65rem;
        font-weight: 750;
        text-transform: uppercase;
      }

      .settings-field input {
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.11);
        border-radius: 0.42rem;
        outline: none;
        background: rgb(255 255 255 / 0.045);
        padding: 0.78rem 3rem 0.78rem 0.78rem;
        color: white;
        font-size: 0.9rem;
      }

      .settings-field input:focus {
        border-color: rgb(52 211 153 / 0.62);
        box-shadow: 0 0 0 3px rgb(16 185 129 / 0.1);
      }

      .settings-field small {
        position: absolute;
        right: 0.68rem;
        bottom: 0.82rem;
        color: rgb(255 255 255 / 0.3);
        font-size: 0.58rem;
      }

      .settings-player-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.68rem;
        margin-top: 0.85rem;
      }

      .settings-stepper {
        display: grid;
        gap: 0.4rem;
      }

      .settings-stepper > div {
        display: grid;
        grid-template-columns: 2.4rem minmax(2rem, 1fr) 2.4rem;
        min-height: 2.75rem;
        align-items: center;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.42rem;
        background: rgb(255 255 255 / 0.035);
      }

      .settings-stepper button {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        border: 0;
        background: transparent;
        color: rgb(148 163 184);
      }

      .settings-stepper button:first-child {
        border-right: 1px solid rgb(255 255 255 / 0.08);
      }

      .settings-stepper button:last-child {
        border-left: 1px solid rgb(255 255 255 / 0.08);
      }

      .settings-stepper svg {
        width: 0.9rem;
        height: 0.9rem;
      }

      .settings-stepper strong {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 1rem;
        text-align: center;
      }

      .settings-error {
        margin: 0.75rem 0 0;
        color: rgb(252 165 165);
        font-size: 0.7rem;
      }

      footer {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
        margin-top: 1.05rem;
      }

      footer button {
        min-height: 2.75rem;
        border-radius: 0.42rem;
        font-size: 0.78rem;
        font-weight: 800;
      }

      .settings-cancel {
        border: 1px solid rgb(255 255 255 / 0.1);
        background: rgb(255 255 255 / 0.04);
        color: rgb(203 213 225);
      }

      .settings-submit {
        border: 0;
        background: rgb(52 211 153);
        color: rgb(3 18 14);
      }

      .settings-submit:disabled {
        opacity: 0.38;
      }
    `,
  ],
})
export class MiniGameSettingsDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<MiniGameSettingsDialogComponent, MiniGameSettingsDialogResult>,
  );
  protected readonly data = inject<MiniGameSettingsDialogData>(MAT_DIALOG_DATA);
  protected readonly name = signal(this.data.name ?? '');
  protected readonly minPlayers = signal(this.data.minPlayers ?? 1);
  protected readonly maxPlayers = signal(this.data.maxPlayers ?? 10);
  protected readonly validationMessage = computed(() => {
    const nameLength = this.name().trim().length;

    if (nameLength > 0 && nameLength < 2) {
      return 'Use at least 2 characters for the game name.';
    }

    if (this.minPlayers() > this.maxPlayers()) {
      return 'Minimum players cannot exceed maximum players.';
    }

    return null;
  });
  protected readonly valid = computed(
    () =>
      this.name().trim().length >= 2 &&
      this.name().trim().length <= 40 &&
      this.minPlayers() >= 1 &&
      this.minPlayers() <= 10 &&
      this.maxPlayers() >= 2 &&
      this.maxPlayers() <= 10 &&
      this.minPlayers() <= this.maxPlayers(),
  );

  protected changeMinimum(delta: number): void {
    this.minPlayers.update((value) => Math.min(10, Math.max(1, value + delta)));
  }

  protected changeMaximum(delta: number): void {
    this.maxPlayers.update((value) => Math.min(10, Math.max(2, value + delta)));
  }

  protected submit(event: Event): void {
    event.preventDefault();

    if (!this.valid()) {
      return;
    }

    this.dialogRef.close({
      name: this.name().trim(),
      minPlayers: this.minPlayers(),
      maxPlayers: this.maxPlayers(),
    });
  }
}
