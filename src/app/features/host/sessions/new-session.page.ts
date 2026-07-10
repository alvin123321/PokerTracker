import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PokerStoreService } from '../data/poker-store.service';

@Component({
  selector: 'app-new-session-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <p class="text-sm font-medium uppercase text-emerald-300">Session</p>
        <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">New Session</h1>
      </div>

      <form
        class="new-session-form rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5"
        [formGroup]="form"
      >
        @if (errorMessage()) {
          <div class="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ errorMessage() }}
          </div>
        }

        <label class="block text-sm font-medium text-neutral-200" for="sessionName">Session name</label>
        <input
          id="sessionName"
          formControlName="name"
          class="new-session-input mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-emerald-300"
          placeholder="July 15 Game"
        />

        <label class="mt-5 block text-sm font-medium text-neutral-200" for="sessionDate">Date</label>
        <input
          id="sessionDate"
          type="date"
          formControlName="sessionDate"
          class="new-session-input mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-emerald-300"
        />

        <div class="mt-6 grid grid-cols-2 gap-3">
          <a
            routerLink="/host/dashboard"
            class="inline-flex items-center justify-center rounded-lg border border-white/10 px-5 py-4 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
          >
            Cancel
          </a>
          <button
            type="button"
            [disabled]="form.invalid || saving()"
            class="rounded-lg bg-emerald-400 px-5 py-4 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            (click)="createSession()"
          >
            @if (saving()) {
              Starting...
            } @else {
              Start session
            }
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      .new-session-form {
        min-width: 0;
      }

      .new-session-input {
        display: block;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
      }

      .new-session-input[type='date'] {
        inline-size: 100%;
      }
    `
  ]
})
export class NewSessionPage {
  private readonly store = inject(PokerStoreService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly defaultSessionDate = this.today();
  private lastGeneratedSessionName = this.defaultSessionName(this.defaultSessionDate);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl(this.lastGeneratedSessionName, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    sessionDate: new FormControl(this.defaultSessionDate, {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  constructor() {
    this.form.controls.sessionDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sessionDate) => {
        const currentName = this.form.controls.name.value.trim();
        const nextGeneratedName = this.defaultSessionName(sessionDate);

        if (!currentName || currentName === this.lastGeneratedSessionName) {
          this.form.controls.name.setValue(nextGeneratedName);
        }

        this.lastGeneratedSessionName = nextGeneratedName;
      });
  }

  protected async createSession(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const value = this.form.getRawValue();
      await this.store.createSession(value.name, value.sessionDate);

      await this.router.navigate(['/host/dashboard']);
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private today(): string {
    const date = new Date();
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    return offsetDate.toISOString().slice(0, 10);
  }

  private defaultSessionName(sessionDate: string): string {
    const [year, month, day] = sessionDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric'
    }).format(date);

    return `${label} Game`;
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to create session.';
  }
}
