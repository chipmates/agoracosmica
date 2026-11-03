// The address hash behind the story archive's quota counters.

function toHex16(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer).slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// An unkeyed hash of an IPv4 address can be reversed by trying every address,
// so the counter key is an HMAC under a worker secret.
let hmacKey: { secret: string; key: Promise<CryptoKey> } | null = null;
let warnedMissingSecret = false;

function keyFor(secret: string): Promise<CryptoKey> {
  if (!hmacKey || hmacKey.secret !== secret) {
    hmacKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      ),
    };
  }
  return hmacKey.key;
}

export async function hashIP(
  ip: string,
  secret: string | undefined,
  scope: 'audio-ratelimit' | 'archive-ratelimit' = 'audio-ratelimit',
): Promise<string> {
  const data = new TextEncoder().encode(`${scope}:${ip}`);
  if (secret) {
    return toHex16(await crypto.subtle.sign('HMAC', await keyFor(secret), data));
  }
  // Without the secret, keep the old key shape so audio never breaks.
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn('[rateLimit] IP_HASH_SALT is not set, counter keys use the unkeyed hash');
  }
  return toHex16(await crypto.subtle.digest('SHA-256', data));
}
