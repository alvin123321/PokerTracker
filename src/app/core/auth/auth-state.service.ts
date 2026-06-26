import { computed, inject, Injectable, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';

import { UserProfile, UserRole } from '../models/user.model';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

interface UserProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

interface MockSession {
  user: User;
  profile: UserProfile;
}

const mockSessionStorageKey = 'pokertrack.mockSession';

const nowIso = () => new Date().toISOString();

const mockUsers: Record<string, { password: string; profile: UserProfile }> = {
  admin: {
    password: 'admin',
    profile: {
      id: 'mock-host-admin',
      email: 'admin@pokertrack.local',
      displayName: 'Admin',
      role: 'HOST',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  player: {
    password: 'player',
    profile: {
      id: 'mock-player',
      email: 'player@pokertrack.local',
      displayName: 'Player',
      role: 'PLAYER',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly userSignal = signal<User | null>(null);
  private readonly profileSignal = signal<UserProfile | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly initializedSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private initPromise: Promise<void> | null = null;
  private listenerRegistered = false;

  readonly user = this.userSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly role = computed(() => this.profileSignal()?.role ?? null);
  readonly isConfigured = this.supabaseService.isConfigured;
  readonly isMockAuthEnabled = true;

  initialize(): Promise<void> {
    if (this.initializedSignal()) {
      return Promise.resolve();
    }

    this.initPromise ??= this.loadInitialState();

    return this.initPromise;
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const mockProfile = this.tryMockSignIn(email, password);

      if (mockProfile) {
        return mockProfile;
      }

      if (!this.isConfigured) {
        throw new Error('Invalid development credential.');
      }

      this.assertConfigured();

      const { data, error } = await this.authService.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (!data.session?.user) {
        throw new Error('Supabase did not return an authenticated session.');
      }

      await this.applySession(data.session);

      const profile = this.profileSignal();

      if (!profile) {
        throw new Error('No PokerTrack profile exists for this user.');
      }

      return profile;
    } catch (error) {
      this.errorSignal.set(this.toMessage(error));
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.isConfigured) {
      await this.authService.signOut();
    }

    localStorage.removeItem(mockSessionStorageKey);
    this.userSignal.set(null);
    this.profileSignal.set(null);
  }

  redirectPathForProfile(profile = this.profileSignal()): string {
    return profile?.role === 'HOST' ? '/host/dashboard' : '/player/dashboard';
  }

  private async loadInitialState(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (this.restoreMockSession()) {
        return;
      }

      if (!this.isConfigured) {
        return;
      }

      this.registerAuthListener();

      const { data, error } = await this.authService.getSession();

      if (error) {
        throw error;
      }

      await this.applySession(data.session);
    } catch (error) {
      this.errorSignal.set(this.toMessage(error));
      this.userSignal.set(null);
      this.profileSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
      this.initializedSignal.set(true);
    }
  }

  private registerAuthListener(): void {
    if (this.listenerRegistered) {
      return;
    }

    this.listenerRegistered = true;

    this.authService.onAuthStateChange((_event, session) => {
      void this.applySession(session);
    });
  }

  private async applySession(session: Session | null): Promise<void> {
    const user = session?.user ?? null;
    this.userSignal.set(user);

    if (!user) {
      this.profileSignal.set(null);
      return;
    }

    this.profileSignal.set(await this.loadProfile(user.id));
  }

  private async loadProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseService
      .requireClient()
      .from('users')
      .select('id,email,display_name,role,created_at,updated_at')
      .eq('id', userId)
      .single<UserProfileRow>();

    if (error) {
      throw error;
    }

    return this.mapProfile(data);
  }

  private mapProfile(row: UserProfileRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error('Supabase environment values are missing.');
    }
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Something went wrong.';
  }

  private tryMockSignIn(username: string, password: string): UserProfile | null {
    const normalizedUsername = username.trim().toLowerCase();
    const mockUser = mockUsers[normalizedUsername];

    if (!mockUser || mockUser.password !== password) {
      return null;
    }

    const profile = {
      ...mockUser.profile,
      updatedAt: nowIso()
    };
    const user = this.createMockUser(profile);

    this.userSignal.set(user);
    this.profileSignal.set(profile);
    localStorage.setItem(mockSessionStorageKey, JSON.stringify({ user, profile }));

    return profile;
  }

  private restoreMockSession(): boolean {
    const rawSession = localStorage.getItem(mockSessionStorageKey);

    if (!rawSession) {
      return false;
    }

    try {
      const session = JSON.parse(rawSession) as MockSession;

      if (!session.user?.id || !session.profile?.role) {
        localStorage.removeItem(mockSessionStorageKey);
        return false;
      }

      this.userSignal.set(session.user);
      this.profileSignal.set(session.profile);
      return true;
    } catch {
      localStorage.removeItem(mockSessionStorageKey);
      return false;
    }
  }

  private createMockUser(profile: UserProfile): User {
    return {
      id: profile.id,
      app_metadata: {},
      user_metadata: {
        display_name: profile.displayName,
        role: profile.role
      },
      aud: 'authenticated',
      created_at: profile.createdAt,
      email: profile.email
    };
  }
}
