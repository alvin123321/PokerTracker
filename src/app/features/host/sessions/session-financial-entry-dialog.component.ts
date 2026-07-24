import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { LucideChevronDown } from '@lucide/angular';

import {
  RegisteredPlayerOption,
  SessionFinancialEntry,
  SessionFinancialEntryType
} from '../data/poker-store.service';

export interface SessionFinancialEntryDialogData {
  mode: 'add' | 'edit';
  entry?: SessionFinancialEntry;
  isHostAdmin: boolean;
  currentUserId: string;
  managers: RegisteredPlayerOption[];
}

export interface SessionFinancialEntryDialogResult {
  entryType: SessionFinancialEntryType;
  amount: number;
  managerUserId: string | null;
}

@Component({
  selector: 'app-session-financial-entry-dialog',
  imports: [LucideChevronDown, MatMenuModule, ReactiveFormsModule],
  template: `
    <section class="w-[min(94vw,28rem)] space-y-5 bg-neutral-950 p-4 text-neutral-50 sm:p-5">
      <div>
        <h2 class="text-xl font-semibold">
          {{ data.mode === 'edit' ? 'Edit entry' : 'Add tips or rake' }}
        </h2>
        <p class="mt-1 text-sm text-neutral-400">
          Each change remains in the session accounting history.
        </p>
      </div>

      @if (data.mode === 'add') {
        <div>
          <p class="mb-2 text-sm font-medium text-neutral-200">Entry type</p>
          <div class="grid grid-cols-2 rounded-lg border border-white/10 bg-neutral-900 p-1">
            <button
              type="button"
              class="rounded-md px-3 py-2.5 text-sm font-semibold transition"
              [class.bg-emerald-400]="entryType.value === 'TIP'"
              [class.text-neutral-950]="entryType.value === 'TIP'"
              [class.text-neutral-300]="entryType.value !== 'TIP'"
              (click)="entryType.setValue('TIP')"
            >
              Tips
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-2.5 text-sm font-semibold transition"
              [class.bg-sky-300]="entryType.value === 'RAKE'"
              [class.text-neutral-950]="entryType.value === 'RAKE'"
              [class.text-neutral-300]="entryType.value !== 'RAKE'"
              (click)="entryType.setValue('RAKE')"
            >
              Rake
            </button>
          </div>
        </div>
      }

      @if (
        data.isHostAdmin &&
        entryType.value === 'TIP' &&
        data.mode === 'add'
      ) {
        <p class="block text-sm font-medium text-neutral-200">Manager</p>
        <button
          type="button"
          aria-label="Choose manager"
          [matMenuTriggerFor]="managerMenu"
          class="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 text-left text-white outline-none transition hover:border-emerald-300/50 focus-visible:border-emerald-300"
        >
          <span class="min-w-0 truncate">{{ selectedManagerName() }}</span>
          <svg
            lucideChevronDown
            class="h-4 w-4 shrink-0 text-neutral-400"
            [strokeWidth]="2"
            aria-hidden="true"
          ></svg>
        </button>
        <mat-menu #managerMenu="matMenu" class="mini-game-menu">
          @for (manager of data.managers; track manager.id) {
            <button
              type="button"
              mat-menu-item
              [attr.aria-current]="managerUserId.value === manager.id ? 'true' : null"
              (click)="managerUserId.setValue(manager.id)"
            >
              <span>{{ manager.displayName ?? manager.username }}</span>
            </button>
          }
        </mat-menu>
      }

      <label class="block text-sm font-medium text-neutral-200" for="financialAmount">
        Amount
      </label>
      <input
        id="financialAmount"
        type="number"
        min="0.01"
        step="0.01"
        inputmode="decimal"
        [formControl]="amount"
        class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        placeholder="0"
      />

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
          (click)="dialogRef.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          [disabled]="!canSubmit()"
          class="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="submit()"
        >
          {{ data.mode === 'edit' ? 'Save' : 'Add entry' }}
        </button>
      </div>
    </section>
  `
})
export class SessionFinancialEntryDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<SessionFinancialEntryDialogComponent, SessionFinancialEntryDialogResult>
  );
  protected readonly data = inject<SessionFinancialEntryDialogData>(MAT_DIALOG_DATA);
  protected readonly entryType = new FormControl<SessionFinancialEntryType>(
    this.data.entry?.entryType ?? 'TIP',
    { nonNullable: true }
  );
  protected readonly amount = new FormControl<number | null>(this.data.entry?.amount ?? null, {
    validators: [Validators.required, Validators.min(0.01)]
  });
  protected readonly managerUserId = new FormControl(
    this.data.entry?.managerUserId ?? (this.data.isHostAdmin ? '' : this.data.currentUserId),
    { nonNullable: true }
  );

  protected canSubmit(): boolean {
    if (this.amount.invalid) {
      return false;
    }

    return !(
      this.data.mode === 'add' &&
      this.data.isHostAdmin &&
      this.entryType.value === 'TIP' &&
      !this.managerUserId.value
    );
  }

  protected selectedManagerName(): string {
    const manager = this.data.managers.find(
      (option) => option.id === this.managerUserId.value
    );

    return manager?.displayName ?? manager?.username ?? 'Select manager';
  }

  protected submit(): void {
    if (!this.canSubmit() || this.amount.value === null) {
      return;
    }

    this.dialogRef.close({
      entryType: this.entryType.value,
      amount: this.amount.value,
      managerUserId:
        this.entryType.value === 'TIP'
          ? this.data.isHostAdmin
            ? this.managerUserId.value
            : this.data.currentUserId
          : null
    });
  }
}
