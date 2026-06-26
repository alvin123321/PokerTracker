import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SessionPlayer } from '../data/poker-store.service';

export interface RebuyDialogData {
  player: SessionPlayer;
}

export interface RebuyDialogResult {
  amount: number;
  comment: string;
}

const presetAmounts = [200, 300, 400, 500, 1000];

@Component({
  selector: 'app-rebuy-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="w-[min(94vw,30rem)] space-y-4 bg-neutral-950 p-4 text-neutral-50 sm:space-y-5 sm:p-5">
      <div>
        <h2 class="text-xl font-semibold">Rebuy</h2>
        <p class="mt-1 text-sm text-neutral-400">{{ data.player.name }} total buy-in updates instantly.</p>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        @for (amount of presets; track amount) {
          <button
            type="button"
            class="rounded-lg bg-emerald-400 px-4 py-4 text-lg font-bold text-neutral-950 transition hover:bg-emerald-300 sm:py-5"
            (click)="selectAmount(amount)"
          >
            {{ amount | currency: 'USD' : 'symbol' : '1.0-0' }}
          </button>
        }
      </div>

      <div>
        <label class="block text-sm font-medium text-neutral-200" for="rebuyComment">Comment</label>
        <textarea
          id="rebuyComment"
          rows="2"
          [formControl]="comment"
          class="mt-2 w-full resize-none rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none transition focus:border-emerald-300"
          placeholder="Optional note"
        ></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-neutral-200" for="customRebuy">Custom amount</label>
        <div class="mt-2 flex gap-2">
          <input
            id="customRebuy"
            type="number"
            min="1"
            step="1"
            [formControl]="customAmount"
            class="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
            placeholder="Amount"
          />
          <button
            type="button"
            [disabled]="customAmount.invalid"
            class="rounded-lg bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            (click)="selectAmount(customAmount.value)"
          >
            Add
          </button>
        </div>
      </div>

      <button
        type="button"
        class="w-full rounded-lg border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white/10"
        (click)="dialogRef.close()"
      >
        Cancel
      </button>
    </section>
  `
})
export class RebuyDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<RebuyDialogComponent>);
  protected readonly data = inject<RebuyDialogData>(MAT_DIALOG_DATA);
  protected readonly presets = presetAmounts;
  protected readonly customAmount = new FormControl(200, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1)]
  });
  protected readonly comment = new FormControl('', {
    nonNullable: true
  });

  protected selectAmount(amount: number): void {
    if (amount > 0) {
      this.dialogRef.close({
        amount,
        comment: this.comment.value.trim()
      } satisfies RebuyDialogResult);
    }
  }
}
