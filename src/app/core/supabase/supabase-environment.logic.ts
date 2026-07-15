const localHostnamePattern = /(^|\.)localhost$/i;
const localDomainPattern = /\.local$/i;

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

  const octets = normalized.split('.').map((part) => Number(part));

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
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

  const endpointIsCloudSupabase = endpoint.hostname.toLowerCase().endsWith('.supabase.co');

  return !(isLocalPreviewHostname(appHostname) && endpointIsCloudSupabase);
}
