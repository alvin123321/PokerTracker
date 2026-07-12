import { initialExpandedTableIds } from './active-session-display.logic';

describe('active session table expansion', () => {
  it('opens only the first table by default', () => {
    expect(initialExpandedTableIds([{ id: 'first' }, { id: 'second' }])).toEqual(['first']);
  });
});
