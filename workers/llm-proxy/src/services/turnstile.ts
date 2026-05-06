// Cloudflare Turnstile server-side verification

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

const EXPECTED_HOSTNAMES = [
  'agoracosmica.org',
  'www.agoracosmica.org',
  'localhost',
];

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIP?: string
): Promise<{ success: boolean; error?: string }> {
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (remoteIP) {
    formData.append('remoteip', remoteIP);
  }

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

  // Validate hostname to prevent cross-site token reuse
  if (result.hostname && !EXPECTED_HOSTNAMES.includes(result.hostname)) {
    return {
      success: false,
      error: 'Turnstile hostname mismatch',
    };
  }

  return { success: true };
}
