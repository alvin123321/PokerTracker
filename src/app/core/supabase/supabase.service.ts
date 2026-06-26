import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from './supabase.client';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  readonly client = inject(SUPABASE_CLIENT);

  readonly isConfigured = this.client !== null;

  requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase environment values are missing.');
    }

    return this.client;
  }
}
