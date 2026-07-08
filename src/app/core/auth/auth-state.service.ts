import { computed, inject, Injectable, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { UserProfile, UserRole } from '../models/user.model';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

interface UserProfileRow {
  id: string;
  display_name: string | null;
  role: UserRole;
  manager_host_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface DevelopmentSession {
  user: User;
  profile: UserProfile;
}

interface LocalRegisteredPlayerOption {
  id: string;
  username: string;
  displayName: string | null;
  role: 'MANAGER' | 'PLAYER';
}

const developmentSessionStorageKey = 'pokertrack.developmentSession';
const legacyMockSessionStorageKey = 'pokertrack.mockSession';
const localRegisteredPlayersStorageKey = 'pokertrack.localRegisteredPlayers.sessionTables.v2';

const nowIso = () => new Date().toISOString();

const developmentUsers: Record<string, { password: string; profile: UserProfile }> = {
  admin: {
    password: 'admin',
    profile: {
      id: 'dev-host-admin',
      displayName: 'Admin',
      role: 'HOST',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  admin1223: {
    password: 'admin1223',
    profile: {
      id: 'dev-host-admin',
      displayName: 'Admin',
      role: 'HOST',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  manager: {
    password: 'manager',
    profile: {
      id: 'dev-manager',
      displayName: 'Manager',
      role: 'MANAGER',
      managerHostId: 'dev-host-admin',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  manager123: {
    password: 'manager123',
    profile: {
      id: 'dev-manager',
      displayName: 'Manager',
      role: 'MANAGER',
      managerHostId: 'dev-host-admin',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  player: {
    password: 'player',
    profile: {
      id: 'dev-player',
      displayName: 'Player',
      role: 'PLAYER',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  },
  player123: {
    password: 'player123',
    profile: {
      id: 'dev-player',
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
  readonly isHostAdmin = computed(() => this.role() === 'HOST');
  readonly isTableOperator = computed(() => this.role() === 'HOST' || this.role() === 'MANAGER');
  readonly isConfigured = this.supabaseService.isConfigured;
  readonly isDevelopmentAuthEnabled = !environment.production;

  initialize(): Promise<void> {
    if (this.initializedSignal()) {
      return Promise.resolve();
    }

    this.initPromise ??= this.loadInitialState();

    return this.initPromise;
  }

  async signIn(loginName: string, password: string): Promise<UserProfile> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const developmentProfile = this.isDevelopmentAuthEnabled
        ? this.tryDevelopmentSignIn(loginName, password)
        : null;

      if (developmentProfile) {
        return developmentProfile;
      }

      if (!this.isConfigured) {
        throw new Error('Invalid development credential.');
      }

      this.assertConfigured();

      const email = this.toSupabaseEmail(loginName);
      const { data, error } = await this.authService.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (!data.session?.user) {
        throw new Error('Supabase did not return an authenticated session.');
      }

      await this.applySession(data.session);
      this.clearDevelopmentSession();

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

    this.clearDevelopmentSession();
    this.userSignal.set(null);
    this.profileSignal.set(null);
  }

  redirectPathForProfile(profile = this.profileSignal()): string {
    return profile?.role === 'HOST' || profile?.role === 'MANAGER'
      ? '/host/dashboard'
      : '/player/dashboard';
  }

  private async loadInitialState(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (this.isConfigured) {
        this.registerAuthListener();

        const { data, error } = await this.authService.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          this.clearDevelopmentSession();
          await this.applySession(data.session);
          return;
        }
      }

      if (this.isDevelopmentAuthEnabled && this.restoreDevelopmentSession()) {
        return;
      }
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
      .select('id,display_name,role,manager_host_id,created_at,updated_at')
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
      displayName: row.display_name,
      role: row.role,
      managerHostId: row.manager_host_id ?? null,
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
    return error instanceof Error ? error.message : 'Unable to complete sign in.';
  }

  private tryDevelopmentSignIn(username: string, password: string): UserProfile | null {
    const normalizedUsername = username.trim().toLowerCase();
    const developmentUser = developmentUsers[normalizedUsername];

    if (!developmentUser || developmentUser.password !== password) {
      return this.tryLocalRegisteredDevelopmentSignIn(normalizedUsername, password);
    }

    const profile = {
      ...developmentUser.profile,
      updatedAt: nowIso()
    };
    const user = this.createDevelopmentUser(profile);

    this.userSignal.set(user);
    this.profileSignal.set(profile);
    localStorage.setItem(developmentSessionStorageKey, JSON.stringify({ user, profile }));
    localStorage.removeItem(legacyMockSessionStorageKey);

    return profile;
  }

  private tryLocalRegisteredDevelopmentSignIn(
    normalizedUsername: string,
    password: string
  ): UserProfile | null {
    if (password !== '123456') {
      return null;
    }

    const player = this.loadLocalRegisteredDevelopmentPlayers().find((registeredPlayer) => {
      const displayName = registeredPlayer.displayName?.trim().toLowerCase() ?? '';
      const username = registeredPlayer.username.trim().toLowerCase();
      const displayNameSlug = displayName.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

      return (
        normalizedUsername === username ||
        normalizedUsername === displayName ||
        normalizedUsername === displayNameSlug
      );
    });

    if (!player) {
      return null;
    }

    const profile: UserProfile = {
      id: player.id,
      displayName: player.displayName ?? player.username,
      role: player.role,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const user = this.createDevelopmentUser(profile);

    this.userSignal.set(user);
    this.profileSignal.set(profile);
    localStorage.setItem(developmentSessionStorageKey, JSON.stringify({ user, profile }));
    localStorage.removeItem(legacyMockSessionStorageKey);

    return profile;
  }

  private loadLocalRegisteredDevelopmentPlayers(): LocalRegisteredPlayerOption[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const rawPlayers = localStorage.getItem(localRegisteredPlayersStorageKey);

    if (!rawPlayers) {
      return [];
    }

    try {
      return (JSON.parse(rawPlayers) as LocalRegisteredPlayerOption[]).filter(
        (player) => player.id && player.username
      );
    } catch {
      return [];
    }
  }

  private toSupabaseEmail(loginName: string): string {
    const normalizedLoginName = loginName.trim().toLowerCase();

    if (normalizedLoginName.includes('@')) {
      return normalizedLoginName;
    }

    return `${normalizedLoginName}@pokertrack.local`;
  }

  private restoreDevelopmentSession(): boolean {
    const rawSession =
      localStorage.getItem(developmentSessionStorageKey) ??
      localStorage.getItem(legacyMockSessionStorageKey);

    if (!rawSession) {
      return false;
    }

    try {
      const session = JSON.parse(rawSession) as DevelopmentSession;

      if (!session.user?.id || !session.profile?.role) {
        this.clearDevelopmentSession();
        return false;
      }

      this.userSignal.set(session.user);
      this.profileSignal.set(session.profile);
      localStorage.setItem(developmentSessionStorageKey, JSON.stringify(session));
      localStorage.removeItem(legacyMockSessionStorageKey);
      return true;
    } catch {
      this.clearDevelopmentSession();
      return false;
    }
  }

  private createDevelopmentUser(profile: UserProfile): User {
    return {
      id: profile.id,
      app_metadata: {},
      user_metadata: {
        display_name: profile.displayName,
        role: profile.role
      },
      aud: 'authenticated',
      created_at: profile.createdAt,
      email: `${profile.id}@pokertrack.local`
    };
  }

  private clearDevelopmentSession(): void {
    localStorage.removeItem(developmentSessionStorageKey);
    localStorage.removeItem(legacyMockSessionStorageKey);
  }
}
