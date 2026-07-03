import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SessionPlayer } from '../data/poker-store.service';

export interface CashOutDialogData {
  player: SessionPlayer;
  mode?: 'record' | 'edit';
}

@Component({
  selector: 'app-cash-out-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="w-[min(94vw,28rem)] space-y-4 bg-neutral-950 p-4 text-neutral-50 sm:space-y-5 sm:p-5">
      <div>
        <h2 class="text-xl font-semibold">{{ data.mode === 'edit' ? 'Edit cash out' : 'Cash out' }}</h2>
        <p class="mt-1 text-sm text-neutral-400">
          {{ data.player.name }} buy-in total is
          {{ data.player.totalBuyIn | currency: 'USD' : 'symbol' : '1.0-0' }}.
        </p>
      </div>

      <label class="block text-sm font-medium text-neutral-200" for="cashOut">Cash-out amount</label>
      <input
        id="cashOut"
        type="number"
        min="0"
        step="1"
        inputmode="decimal"
        [formControl]="cashOut"
        class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        placeholder="0"
        (focus)="clearDefaultCashOut()"
      />

      <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4">
        <p class="text-sm text-neutral-400">Projected net</p>
        <p class="mt-1 text-2xl font-semibold" [class.text-red-300]="projectedNet() < 0" [class.text-emerald-300]="projectedNet() >= 0">
          {{ projectedNet() | currency: 'USD' : 'symbol' : '1.0-0' }}
        </p>
      </div>

      <div>
        <button
          type="button"
          [disabled]="cashOut.invalid"
          class="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="submit()"
        >
          {{ data.mode === 'edit' ? 'Save' : 'Complete' }}
        </button>
      </div>
    </section>
  `
})
export class CashOutDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<CashOutDialogComponent>);
  protected readonly data = inject<CashOutDialogData>(MAT_DIALOG_DATA);
  protected readonly cashOut = new FormControl<number | null>(
    this.data.mode === 'edit' ? this.data.player.cashOut : 0,
    {
    validators: [Validators.required, Validators.min(0)]
    }
  );

  protected projectedNet(): number {
    return (this.cashOut.value ?? 0) - this.data.player.totalBuyIn;
  }

  protected clearDefaultCashOut(): void {
    if (this.cashOut.value === 0) {
      this.cashOut.setValue(null);
    }
  }

  protected submit(): void {
    if (this.cashOut.valid && this.cashOut.value !== null) {
      this.dialogRef.close(this.cashOut.value);
    }
  }
}
