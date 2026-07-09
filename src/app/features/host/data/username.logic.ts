export const pokerTrackUsernamePattern = /^[a-z0-9][a-z0-9_-]{1,31}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidPokerTrackUsername(username: string): boolean {
  return pokerTrackUsernamePattern.test(normalizeUsername(username));
}

export function usernameFromDisplayName(
  displayName: string,
  fallbackSuffix = Date.now().toString(36)
): string {
  const normalized = normalizeUsername(displayName)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return normalized.length >= 2 ? normalized : `player-${fallbackSuffix}`;
}

export function localPlayerSlug(name: string): string {
  const normalized = normalizeUsername(name)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return normalized.length >= 2 ? normalized : 'player';
}
