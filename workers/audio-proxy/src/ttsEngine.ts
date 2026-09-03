/**
 * English runs on two stacks. Qwen carries the default cast, Kokoro is the one
 * that is always there, so an English request for a Qwen voice can be re-asked
 * as the matching Kokoro voice when no origin will serve it.
 *
 * German is Qwen-only and has no counterpart, so it never degrades here.
 */

/**
 * Qwen English voice id → the Kokoro id closest to it. Paired by rank within a
 * gender, so a council that degrades mid-flight keeps four distinct voices
 * rather than collapsing onto one.
 *
 * Keep this in step with the client cast (`QWEN_ENGLISH_TECHNICAL_VOICES` and
 * `ENGLISH_TECHNICAL_VOICES`): a Qwen voice missing from this map simply has no
 * fallback and fails the way any other request does.
 */
export const QWEN_EN_TO_KOKORO: Record<string, string> = {
  // Female
  en_lyra: 'af_heart',
  en_andromeda: 'af_bella',
  en_astra: 'af_nova',
  en_vega: 'af_aoede(100)+af_heart(50)',
  en_ceres: 'af_heart(20)+bf_emma(80)',
  // Male
  en_solaris: 'am_michael(75)+af_heart(25)',
  en_phoenix: 'bm_george(75)+af_nicole(25)',
  en_hyperion: 'am_liam(75)+af_nicole(25)',
  en_umbra: 'bm_lewis(100)+af_nicole(50)',
  en_corvus: 'am_onyx(75)+af_heart(25)',
};

export function isQwenEnglishVoice(voice: unknown): voice is string {
  return typeof voice === 'string' && voice in QWEN_EN_TO_KOKORO;
}

/**
 * Same request, Kokoro voice. Returns null when the request was not an English
 * Qwen one, so the caller can skip the retry entirely.
 */
export function buildKokoroFallbackBody(
  parsedBody: Record<string, unknown> | null,
): ArrayBuffer | null {
  if (!parsedBody) return null;
  if (parsedBody.language === 'German') return null;

  const voice = parsedBody.voice;
  if (!isQwenEnglishVoice(voice)) return null;

  const degraded = { ...parsedBody, voice: QWEN_EN_TO_KOKORO[voice] };
  const encoded = new TextEncoder().encode(JSON.stringify(degraded));
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer;
}
