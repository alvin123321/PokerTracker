import { sessionRealtimeTables, shouldReconnectRealtimeChannel } from './realtime.logic';

describe('realtime connection logic', () => {
  it('reconnects on stale or failed channel statuses', () => {
    expect(shouldReconnectRealtimeChannel('CHANNEL_ERROR')).toBeTrue();
    expect(shouldReconnectRealtimeChannel('TIMED_OUT')).toBeTrue();
    expect(shouldReconnectRealtimeChannel('CLOSED')).toBeTrue();
  });

  it('does not reconnect for a healthy subscription status', () => {
    expect(shouldReconnectRealtimeChannel('SUBSCRIBED')).toBeFalse();
  });

  it('includes session tables and active table revisions in the refresh subscription', () => {
    expect(sessionRealtimeTables()).toContain('active_table_revisions');
    expect(sessionRealtimeTables()).toContain('session_tables');
    expect(sessionRealtimeTables()).toContain('transaction_revisions');
    expect(sessionRealtimeTables()).toContain('session_financial_entries');
  });
});
