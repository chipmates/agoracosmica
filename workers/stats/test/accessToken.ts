// Access JWTs for the tests: a local RSA key pair stands in for the team's
// published keys, and certsAnswer() answers the key set's address, so no test
// asks Cloudflare.

export const TEAM_DOMAIN = 'test-team.cloudflareaccess.com';
export const ISSUER = 'https://' + TEAM_DOMAIN;
export const CERTS_URL = ISSUER + '/cdn-cgi/access/certs';
export const AUD = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
export const KID = 'test-kid-1';

export interface Signer { kid: string; privateKey: CryptoKey; jwk: JsonWebKey & { kid: string } }

export async function makeSigner(kid = KID): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { kid, privateKey: pair.privateKey, jwk: { kty: 'RSA', n: pub.n, e: pub.e, alg: 'RS256', use: 'sig', kid } };
}

const enc = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const part = (value: unknown): string => enc(new TextEncoder().encode(JSON.stringify(value)));

/** A signed token. Claims default to a person's login, valid for ten minutes. */
export async function signToken(signer: Signer, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    aud: [AUD], email: 'owner@example.invalid', exp: now + 600, iat: now, nbf: now, iss: ISSUER,
    type: 'app', identity_nonce: 'nonce', sub: '7d0a3b5c-0000-4000-8000-000000000001', country: 'DE', ...claims,
  };
  for (const k of Object.keys(body)) if ((body as Record<string, unknown>)[k] === undefined) delete (body as Record<string, unknown>)[k];
  const head = part({ alg: 'RS256', kid: signer.kid, typ: 'JWT', ...header });
  const payload = part(body);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer.privateKey, new TextEncoder().encode(head + '.' + payload)));
  return head + '.' + payload + '.' + enc(sig);
}

/** A service token's JWT, shaped as Access issues one: a common name, an empty subject, no email. */
export function serviceClaims(): Record<string, unknown> {
  return { email: undefined, identity_nonce: undefined, country: undefined, sub: '', common_name: '0123456789abcdef0123456789abcdef.access' };
}

/** The key set's answer for the given signers, as Access publishes it. */
export function certsAnswer(...signers: Signer[]): Response {
  return Response.json({ keys: signers.map((s) => s.jwk), public_cert: { kid: signers[0]?.kid, cert: '' }, public_certs: [] });
}
