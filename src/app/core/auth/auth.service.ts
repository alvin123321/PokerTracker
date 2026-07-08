import { inject, Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  Session,
  SignInWithPasswordCredentials,
  UserAttributes
} from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  readonly isConfigured = this.supabaseService.isConfigured;

  getSession() {
    return this.supabaseService.requireClient().auth.getSession();
  }

  signInWithPassword(credentials: SignInWithPasswordCredentials) {
    return this.supabaseService.requireClient().auth.signInWithPassword(credentials);
  }

  updateUser(attributes: UserAttributes) {
    return this.supabaseService.requireClient().auth.updateUser(attributes);
  }

  signOut() {
    return this.supabaseService.requireClient().auth.signOut();
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabaseService.requireClient().auth.onAuthStateChange(callback);
  }
}
