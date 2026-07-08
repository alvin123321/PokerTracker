export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function displayNameInitials(displayName: string | null | undefined): string {
  const cleanName = normalizeDisplayName(displayName ?? '');

  if (!cleanName) {
    return 'PT';
  }

  const parts = cleanName.split(' ');

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function validatePasswordChange(password: string): string | null {
  if (!password) {
    return 'Enter a new password.';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  return null;
}

export function passwordUpdatedToastMessage(): string {
  return 'Password is updated.';
}

export function nameChangedToastMessage(): string {
  return 'Name is changed.';
}
