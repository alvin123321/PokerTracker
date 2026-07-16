export const sessionOverviewRefreshIntervalMs = 5000;

export function sessionRealtimeTables(): readonly string[] {
  return [
    'sessions',
    'session_tables',
    'players',
    'session_players',
    'transactions',
    'time_calls',
    'active_table_revisions'
  ];
}

export function shouldReconnectRealtimeChannel(status: string): boolean {
  return status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
}
