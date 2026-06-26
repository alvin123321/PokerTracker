import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  details?: string[];
}

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <section class="w-[min(94vw,30rem)] space-y-4 bg-neutral-950 p-4 text-neutral-50 sm:space-y-5 sm:p-5">
      <div>
        <h2 class="text-xl font-semibold">{{ data.title }}</h2>
        <p class="mt-2 text-sm leading-6 text-neutral-400">{{ data.message }}</p>
      </div>

      @if (data.details?.length) {
        <div class="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          @for (detail of data.details; track detail) {
            <p class="text-sm text-neutral-300">{{ detail }}</p>
          }
        </div>
      }

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white/10"
          (click)="dialogRef.close(false)"
        >
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        @if (data.tone === 'danger') {
          <button
            type="button"
            class="rounded-lg bg-red-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-red-300"
            (click)="dialogRef.close(true)"
          >
            {{ data.confirmLabel }}
          </button>
        } @else {
          <button
            type="button"
            class="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300"
            (click)="dialogRef.close(true)"
          >
            {{ data.confirmLabel }}
          </button>
        }
      </div>
    </section>
  `
})
export class ConfirmationDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent, boolean>);
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
}
