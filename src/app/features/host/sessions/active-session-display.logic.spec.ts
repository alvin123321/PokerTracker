import { allPlayersCashedOut, initialExpandedTableIds } from './active-session-display.logic';

describe('active session table expansion', () => {
  it('opens only the first table by default', () => {
    expect(initialExpandedTableIds([{ id: 'first' }, { id: 'second' }])).toEqual(['first']);
  });

  it('only allows closing after every player has cashed out', () => {
    expect(allPlayersCashedOut([{ status: 'COMPLETED' }, { status: 'COMPLETED' }])).toBeTrue();
    expect(allPlayersCashedOut([{ status: 'COMPLETED' }, { status: 'ACTIVE' }])).toBeFalse();
  });
});
