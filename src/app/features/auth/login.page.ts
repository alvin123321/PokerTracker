import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-50">
      <section
        class="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">PokerTrack</p>
          <h1 class="mt-4 max-w-2xl text-4xl font-semibold leading-tight md:text-6xl">
            Live poker session management for fast-moving hosts.
          </h1>
          <p class="mt-5 max-w-xl text-base leading-7 text-neutral-300">
            Sign in to continue to your host or player dashboard.
          </p>
        </div>

        <form
          class="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-white">Sign in</h2>
            <p class="text-sm text-neutral-400">Use a development credential to preview the app.</p>
          </div>

          @if (authState.isMockAuthEnabled) {
            <div class="mt-5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-50">
              Development login: admin/admin for host, player/player for player.
            </div>
          }

          @if (errorMessage()) {
            <div class="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {{ errorMessage() }}
            </div>
          }

          <label class="mt-6 block text-sm font-medium text-neutral-200" for="username">Login name</label>
          <input
            id="username"
            type="text"
            autocomplete="username"
            formControlName="username"
            class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300"
            placeholder="admin"
          />

          <label class="mt-4 block text-sm font-medium text-neutral-200" for="password">Password</label>
          <input
            id="password"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300"
            placeholder="Password"
          />

          <button
            type="submit"
            [disabled]="form.invalid || authState.loading()"
            class="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            @if (authState.loading()) {
              Signing in...
            } @else {
              Sign in
            }
          </button>
        </form>
      </section>
    </main>
  `
})
export class LoginPage {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly errorMessage = computed(() => this.authState.error());

  protected readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();

    try {
      const profile = await this.authState.signIn(username, password);
      await this.router.navigateByUrl(this.destinationFor(profile));
    } catch {
      this.form.controls.password.reset();
    }
  }

  private destinationFor(profile: UserProfile): string {
    const fallback = this.authState.redirectPathForProfile(profile);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    if (!returnUrl?.startsWith('/')) {
      return fallback;
    }

    if (profile.role === 'HOST' && returnUrl.startsWith('/host')) {
      return returnUrl;
    }

    if (profile.role === 'PLAYER' && returnUrl.startsWith('/player')) {
      return returnUrl;
    }

    return fallback;
  }
}
