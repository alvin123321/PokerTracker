import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { shouldCreateSupabaseClient } from './supabase-environment.logic';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient | null>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const appHostname = typeof window === 'undefined' ? '' : window.location.hostname;

    if (
      !environment.supabaseUrl ||
      !environment.supabaseAnonKey ||
      !shouldCreateSupabaseClient(appHostname, environment.supabaseUrl)
    ) {
      if (
        environment.supabaseUrl &&
        !shouldCreateSupabaseClient(appHostname, environment.supabaseUrl)
      ) {
        console.error('PokerTracker blocked a cloud Supabase client from a local preview origin.');
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
