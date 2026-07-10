export const CALL_TIME_LIMIT = 3;
export const CALL_TIME_DURATION_SECONDS = 60;
export const CALL_TIME_SYNC_BUFFER_SECONDS = 3;

export type TimeCallPhase = 'STARTING' | 'RUNNING' | 'ENDED';

export function timeCallPhase(startedAt: string, expiresAt: string, nowMs: number): TimeCallPhase {
  const startMs = new Date(startedAt).getTime();
  const expireMs = new Date(expiresAt).getTime();

  if (nowMs < startMs) {
    return 'STARTING';
  }

  if (nowMs >= expireMs) {
    return 'ENDED';
  }

  return 'RUNNING';
}

export function timeCallStartsInSeconds(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(startedAt).getTime() - nowMs) / 1000));
}

export function timeCallSecondsRemaining(
  startedAt: string,
  expiresAt: string,
  nowMs: number
): number {
  const startMs = new Date(startedAt).getTime();
  const expireMs = new Date(expiresAt).getTime();

  if (nowMs < startMs) {
    return Math.max(0, Math.ceil((expireMs - startMs) / 1000));
  }

  return Math.max(0, Math.ceil((expireMs - nowMs) / 1000));
}

export function timeCallProgress(startedAt: string, expiresAt: string, nowMs: number): number {
  const startMs = new Date(startedAt).getTime();
  const expireMs = new Date(expiresAt).getTime();
  const duration = Math.max(1, expireMs - startMs);

  if (nowMs < startMs) {
    return 1;
  }

  return Math.max(0, Math.min(1, (expireMs - nowMs) / duration));
}
