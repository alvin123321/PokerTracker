export const sessionOverviewRefreshIntervalMs = 5000;

export function shouldReconnectRealtimeChannel(status: string): boolean {
  return status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
}
