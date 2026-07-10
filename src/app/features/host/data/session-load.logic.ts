export type SessionLoadEffectAction =
  | 'WAIT_FOR_AUTH'
  | 'LOAD_LOCAL_SESSIONS'
  | 'LOAD_SUPABASE_SESSIONS'
  | 'SKIP_CURRENT_SUPABASE_USER';

export interface SessionLoadEffectInput {
  initialized: boolean;
  userId: string | null;
  usesSupabase: boolean;
  loadedSupabaseUserId: string | null;
}

export function sessionLoadEffectAction(input: SessionLoadEffectInput): SessionLoadEffectAction {
  if (!input.initialized) {
    return 'WAIT_FOR_AUTH';
  }

  if (!input.usesSupabase) {
    return 'LOAD_LOCAL_SESSIONS';
  }

  if (input.loadedSupabaseUserId === input.userId) {
    return 'SKIP_CURRENT_SUPABASE_USER';
  }

  return 'LOAD_SUPABASE_SESSIONS';
}
