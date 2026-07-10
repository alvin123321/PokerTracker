import {
  CALL_TIME_DURATION_SECONDS,
  CALL_TIME_SYNC_BUFFER_SECONDS,
  timeCallPhase,
  timeCallProgress,
  timeCallSecondsRemaining,
  timeCallStartsInSeconds
} from './time-call.logic';

const startedAt = '2026-07-09T20:00:03.000Z';
const expiresAt = '2026-07-09T20:01:03.000Z';

describe('call time timing logic', () => {
  it('uses a short sync buffer before the live clock starts', () => {
    const now = new Date('2026-07-09T20:00:00.100Z').getTime();

    expect(CALL_TIME_SYNC_BUFFER_SECONDS).toBe(3);
    expect(timeCallPhase(startedAt, expiresAt, now)).toBe('STARTING');
    expect(timeCallStartsInSeconds(startedAt, now)).toBe(3);
    expect(timeCallSecondsRemaining(startedAt, expiresAt, now)).toBe(CALL_TIME_DURATION_SECONDS);
    expect(timeCallProgress(startedAt, expiresAt, now)).toBe(1);
  });

  it('counts down from the full duration once the sync buffer is over', () => {
    const now = new Date('2026-07-09T20:00:03.100Z').getTime();

    expect(timeCallPhase(startedAt, expiresAt, now)).toBe('RUNNING');
    expect(timeCallStartsInSeconds(startedAt, now)).toBe(0);
    expect(timeCallSecondsRemaining(startedAt, expiresAt, now)).toBe(CALL_TIME_DURATION_SECONDS);
    expect(timeCallProgress(startedAt, expiresAt, now)).toBeLessThanOrEqual(1);
  });
});
