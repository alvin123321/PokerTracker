import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <main
      class="login-shell min-h-dvh bg-neutral-950 text-neutral-50"
      [class.login-shell-leaving]="isLeaving()"
    >
      <section
        class="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-8 px-5 py-8 sm:gap-10 sm:py-10 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div class="login-copy">
          <div class="flex items-center gap-3">
            <p class="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">PokerTrack</p>
            <span class="rounded-full border border-emerald-300/30 px-2.5 py-1 text-xs font-semibold text-emerald-100">
              v1.1
            </span>
          </div>
          <h1 class="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-white md:text-6xl">
            Live poker session management for fast-moving hosts.
          </h1>
          <p class="mt-5 max-w-xl text-base leading-7 text-neutral-300">
            Sign in to continue to your host or player dashboard.
          </p>
          <div class="mt-6 hidden grid-cols-3 gap-3 text-sm text-neutral-400 sm:grid">
            <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <p class="font-semibold text-white">Fast</p>
              <p class="mt-1">One-tap rebuy flow.</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <p class="font-semibold text-white">Private</p>
              <p class="mt-1">Player-only history.</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <p class="font-semibold text-white">Live</p>
              <p class="mt-1">Synced to Supabase.</p>
            </div>
          </div>
        </div>

        <form
          class="login-card rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-white">Sign in</h2>
            <p class="text-sm text-neutral-400">Use your PokerTrack login name to continue.</p>
          </div>

          @if (authState.isDevelopmentAuthEnabled) {
            <div class="mt-5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-50">
              Development login: admin1223/admin1223 for host, player123/player123 for player.
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
            placeholder="admin1223"
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
            [disabled]="form.invalid || authState.loading() || isLeaving()"
            class="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-emerald-900/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 disabled:shadow-none"
          >
            @if (isLeaving()) {
              Opening dashboard...
            } @else if (authState.loading()) {
              Signing in...
            } @else {
              Sign in
            }
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [
    `
      .login-shell {
        animation: login-shell-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .login-copy {
        animation: login-panel-in 480ms 80ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .login-card {
        animation: login-panel-in 520ms 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .login-shell-leaving {
        animation: login-shell-out 280ms cubic-bezier(0.4, 0, 1, 1) both;
      }

      @keyframes login-shell-in {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      @keyframes login-panel-in {
        from {
          opacity: 0;
          transform: translateY(0.75rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes login-shell-out {
        from {
          opacity: 1;
          transform: scale(1);
        }

        to {
          opacity: 0;
          transform: scale(0.985);
        }
      }
    `
  ]
})
export class LoginPage {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly errorMessage = computed(() => this.authState.error());
  protected readonly isLeaving = signal(false);

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
      this.isLeaving.set(true);
      await this.waitForExitAnimation();
      await this.router.navigateByUrl(this.destinationFor(profile));
    } catch {
      this.isLeaving.set(false);
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

  private waitForExitAnimation(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 260));
  }
}
