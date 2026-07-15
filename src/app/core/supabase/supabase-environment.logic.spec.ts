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
      '169.254.10.20',
      '100.64.10.20',
      'pokertrack.local',
      'pokertrack.internal',
      'ALVIN-PC',
      '[fc00::1234]',
      '[fe80::1234]',
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

  it('blocks every remote Supabase endpoint from a local preview hostname', () => {
    expect(shouldCreateSupabaseClient('ALVIN-PC', 'https://database.example.com')).toBeFalse();
  });

  it('rejects missing and malformed Supabase URLs', () => {
    expect(shouldCreateSupabaseClient('localhost', '')).toBeFalse();
    expect(shouldCreateSupabaseClient('localhost', 'not-a-url')).toBeFalse();
  });
});
