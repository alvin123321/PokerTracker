import { sessionLoadEffectAction } from './session-load.logic';

describe('sessionLoadEffectAction', () => {
  it('waits until auth is initialized', () => {
    expect(
      sessionLoadEffectAction({
        initialized: false,
        userId: null,
        usesSupabase: false,
        loadedSupabaseUserId: null
      })
    ).toBe('WAIT_FOR_AUTH');
  });

  it('loads local sessions for development users so empty states can render', () => {
    expect(
      sessionLoadEffectAction({
        initialized: true,
        userId: 'dev-host-admin',
        usesSupabase: false,
        loadedSupabaseUserId: null
      })
    ).toBe('LOAD_LOCAL_SESSIONS');
  });

  it('loads Supabase sessions for a new Supabase user', () => {
    expect(
      sessionLoadEffectAction({
        initialized: true,
        userId: 'real-user',
        usesSupabase: true,
        loadedSupabaseUserId: null
      })
    ).toBe('LOAD_SUPABASE_SESSIONS');
  });

  it('skips duplicate Supabase loads for the same user', () => {
    expect(
      sessionLoadEffectAction({
        initialized: true,
        userId: 'real-user',
        usesSupabase: true,
        loadedSupabaseUserId: 'real-user'
      })
    ).toBe('SKIP_CURRENT_SUPABASE_USER');
  });
});
