const localHostnamePattern = /(^|\.)localhost$/i;
const localDomainPattern = /\.(?:home|internal|lan|local|localdomain)$/i;

export function isLocalPreviewHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();

  if (
    !normalized ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    localHostnamePattern.test(normalized) ||
    localDomainPattern.test(normalized)
  ) {
    return true;
  }

  if (!normalized.includes('.') && !normalized.includes(':')) {
    return true;
  }

  if (normalized.includes(':')) {
    if (normalized.startsWith('::ffff:')) {
      return isLocalPreviewHostname(normalized.slice('::ffff:'.length));
    }

    const firstHextet = Number.parseInt(normalized.split(':', 1)[0], 16);
    return (
      Number.isInteger(firstHextet) &&
      ((firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
        (firstHextet >= 0xfe80 && firstHextet <= 0xfebf))
    );
  }

  const octets = normalized.split('.').map((part) => Number(part));

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function shouldCreateSupabaseClient(appHostname: string, supabaseUrl: string): boolean {
  let endpoint: URL;

  try {
    endpoint = new URL(supabaseUrl);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    return false;
  }

  return !isLocalPreviewHostname(appHostname) || isLocalPreviewHostname(endpoint.hostname);
}
