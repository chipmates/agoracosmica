// Cloudflare Turnstile server-side verification

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

// Production hostnames only. Local dev never reaches this check: session.ts
// accepts 'dev-test-token' from loopback when TURNSTILE_SECRET_KEY is unset,
// so verification is bypassed entirely. A 'localhost' entry here would only
// let an attacker replay tokens solved on their own localhost-bound widget.
const EXPECTED_HOSTNAMES = [
  'agoracosmica.org',
  'www.agoracosmica.org',
];

// Sends the secret and the token only. siteverify's remoteip field is
// optional, and leaving it out keeps the visitor's address out of the request.
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
): Promise<{ success: boolean; error?: string }> {
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!response.ok) {
    return { success: false, error: 'Turnstile verification service unavailable' };
  }

  const result: TurnstileVerifyResponse = await response.json();

  if (!result.success) {
    return {
      success: false,
      error: `Verification failed: ${result['error-codes']?.join(', ') || 'unknown'}`,
    };
  }

  // Validate hostname to prevent cross-site token reuse. Siteverify names the
  // hostname on every success (test keys: example.com), so none is a failure.
  if (!result.hostname || !EXPECTED_HOSTNAMES.includes(result.hostname)) {
    return {
      success: false,
      error: 'Turnstile hostname mismatch',
    };
  }

  return { success: true };
}
