import { shouldCreateSupabaseClient } from './supabase-environment.logic';

describe('Supabase environment safety', () => {
  const productionUrl = 'https://rfyaqfecnkwrlcdfmmaj.supabase.co';

  it('blocks the production project from every local preview hostname', () => {
    for (const hostname of [
      'localhost',
      '127.0.0.1',
      '::1',
      '192.168.1.74',
      '10.0.0.8',
      '172.16.0.2',
      '172.31.255.254',
      'pokertrack.local',
    ]) {
      expect(shouldCreateSupabaseClient(hostname, productionUrl)).withContext(hostname).toBeFalse();
    }
  });

  it('allows the production project from a public deployed hostname', () => {
    expect(shouldCreateSupabaseClient('poker-tracker.example.com', productionUrl)).toBeTrue();
  });

  it('allows a local Supabase project from a local preview hostname', () => {
    expect(shouldCreateSupabaseClient('localhost', 'http://127.0.0.1:54321')).toBeTrue();
  });

  it('rejects missing and malformed Supabase URLs', () => {
    expect(shouldCreateSupabaseClient('localhost', '')).toBeFalse();
    expect(shouldCreateSupabaseClient('localhost', 'not-a-url')).toBeFalse();
  });
});
