import { InjectionToken } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { shouldCreateSupabaseClient } from './supabase-environment.logic';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient | null>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const appHostname = typeof window === 'undefined' ? '' : window.location.hostname;
    const canCreateClient =
      Boolean(environment.supabaseUrl) &&
      shouldCreateSupabaseClient(appHostname, environment.supabaseUrl);

    if (
      !environment.supabaseUrl ||
      !environment.supabaseAnonKey ||
      !canCreateClient
    ) {
      if (environment.supabaseUrl && !canCreateClient) {
        console.error('PokerTracker blocked a remote Supabase client from a local preview origin.');
      }
      return null;
    }

    return createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  },
});
