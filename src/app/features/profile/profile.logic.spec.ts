import {
  displayNameInitials,
  nameChangedToastMessage,
  normalizeDisplayName,
  passwordUpdatedToastMessage,
  validatePasswordChange
} from './profile.logic';

describe('profile logic', () => {
  it('normalizes display names to compact spacing', () => {
    expect(normalizeDisplayName('  Alvin   Chen  ')).toBe('Alvin Chen');
  });

  it('uses clean initials from a display name', () => {
    expect(displayNameInitials('alvin chen')).toBe('AC');
    expect(displayNameInitials('Gene')).toBe('GE');
    expect(displayNameInitials(null)).toBe('PT');
  });

  it('requires a strong matching new password', () => {
    expect(validatePasswordChange('')).toBe('Enter a new password.');
    expect(validatePasswordChange('12345')).toBe('Password must be at least 6 characters.');
    expect(validatePasswordChange('123456')).toBeNull();
  });

  it('uses direct profile update confirmation copy', () => {
    expect(passwordUpdatedToastMessage()).toBe('Password is updated.');
    expect(nameChangedToastMessage()).toBe('Name is changed.');
  });
});
