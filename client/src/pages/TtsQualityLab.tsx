// TtsQualityLab — A/B testing for the live TTS chunking + playback pipeline.
// Renders the same passage through 4 variants and lets you compare them by ear.
//
// Distinct from TTSBench (which measures provider latency / RT factor):
// this page tests *perceived quality* of how we chunk + concatenate live audio.
//
// Route: /test/tts-quality (dev only)

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ENGLISH_TECHNICAL_VOICES, ENGLISH_VOICE_INFO,
  GERMAN_TECHNICAL_VOICES, GERMAN_VOICE_INFO,
  type EnglishVoice, type GermanVoice
} from '../services/audio/voices/voiceDefinitions';

type Lang = 'en' | 'de';

interface RenderedChunk {
  text: string;
  url: string;            // object URL for the response blob
  blob: Blob;
  bytes: number;
  renderMs: number;       // wall time for this single TTS call
  audioDurationS: number; // measured from <audio> metadata
  words: number;          // word count of the chunk text
  wpm: number;            // words / (audioDurationS / 60)
  inferenceMs?: number;   // X-Inference-Ms header if present
  backend?: string;       // X-TTS-Backend header
  model?: string;         // X-Model header
}

interface Variant {
  id: string;
  label: string;
  description: string;
  speed: number;
  gapMs: number;
  chunks: RenderedChunk[];
  totalRenderMs: number;
  status: 'idle' | 'rendering' | 'ready' | 'error';
  error?: string;
}

// ----- Sample passages (same length tier in both languages) -----

const PRESETS: Record<Lang, Array<{ name: string; text: string }>> = {
  en: [
    {
      name: 'Short response (~210 chars, ~1-2 chunks) — typical opener',
      text: 'You heard how that iron struck my head. How the darkness pressed down heavy as winter quilts. The overseer called me damaged goods through the walls. Not worth half. But Mama was singing in my ear.'
    },
    {
      name: 'Production-typical (~430 chars, 2-3 chunks) — Tubman, "lies for what they are"',
      text: 'Start by hearing the lies for what they are. The overseer called me damaged. But Mama said I belonged to God. Every day I weighed one against the other. You do the same. When the world tells you you’re not enough, name that as false. Then speak your truth back, even if it shakes. Mine was simple: I am free inside. Say it till your bones believe it. Does that make sense?'
    },
    {
      name: 'Production-typical (~470 chars, 2-3 chunks) — Tubman, "Who’s your mirror?"',
      text: 'It don’t hurt less doing it alone. It hurts more. But Mama’s voice stayed with me because I wasn’t truly alone. Find your people. The ones who hum your song when you can’t sing. James said I had iron in me, not because he saw my wound, but because he saw my worth when I couldn’t. You need at least one person who reflects your dignity back to you. Without that mirror, it’s harder to see yourself clear. Who’s your mirror?'
    },
    {
      name: 'Long response (~720 chars, 4-5 chunks) — stress test',
      text: 'The crisis of meaning in our modern age is not merely a philosophical abstraction. It is a lived reality that touches every human soul. When we strip away the ancient mythologies, the religious frameworks, the tribal identities that once gave our ancestors a sense of cosmic belonging, what remains? A void. An abyss of purposelessness that no amount of material comfort can fill. I have seen this in my patients, time and again. Successful men and women, surrounded by every luxury, yet hollow at their core. They come to me not with neuroses born of repression, but with a deeper malady. The sense that their lives lack meaning. That they are actors on a stage without a script. We must learn, then, to write our own scripts.'
    },
  ],
  de: [
    {
      name: 'Kurze Antwort (~340 Zeichen, ~2 Chunks) — Tubman, "Innere Freiheit"',
      text: 'Innere Freiheit heißt: Niemand bestimmt dein Wert. Weder Macht, noch Angst, noch Lügen. Du musst dich selbst erkennen, bevor die Welt dich sieht. Erst im Stillen entscheiden: Ich bin frei. Dann erst kannst du handeln, ohne zu brechen. Es ist kein Zustand, sondern ein tägliches Ja zu dir selbst, auch wenn alles dagegen spricht. Verstanden?'
    },
    {
      name: 'Produktions-typisch (~430 Zeichen, 2-3 Chunks) — Tubman, "Standfestigkeit"',
      text: 'Es entsteht Standfestigkeit. Nicht starr wie ein Baum, der bricht im Sturm. Sondern tief verwurzelt wie das Schilfrohr, es beugt sich, aber es reißt nicht los. Weil die Wurzel weiß, wo sie hingehört. Diese Gewissheit gibt Entschlossenheit, ja. Aber sie kommt aus der Ruhe, nicht aus dem Zorn. Mein inneres Ja zur Freiheit ließ mich gehen, als alle Wege verschlossen waren. Wo steht deine Wurzel?'
    },
    {
      name: 'Produktions-typisch (~530 Zeichen, 3 Chunks) — Tubman, "Bläse" politisch',
      text: 'Dann arbeite nicht an der Blase, sondern am Boden drumherum. Ich überzeugte keine Sklavenhalter. Aber ich fand Menschen in der Mitte, die zweifelten. Sprich zu den Zuhörern, nicht zum Redner. Hilf einem Nachbarn mit Lebensmitteln, wenn er krank ist. Sei sichtbar freundlich, wo andere ausschließen. Die Blase zerbricht nicht durch Schlagen, sondern durch das Licht, das langsam eindringt. Was kannst du heute tun, das kein Argument braucht, nur Menschlichkeit?'
    },
    {
      name: 'Lange Antwort (~700 Zeichen, 4-5 Chunks) — Stress-Test',
      text: 'Die Sinnkrise unserer modernen Zeit ist nicht bloß eine philosophische Abstraktion. Sie ist eine gelebte Realität, die jede Seele berührt. Wenn wir die alten Mythologien abstreifen, die religiösen Rahmenwerke, die Stammesidentitäten, die einst unseren Vorfahren ein Gefühl kosmischer Zugehörigkeit gaben, was bleibt dann? Eine Leere. Ein Abgrund der Sinnlosigkeit, den kein Maß an materiellem Komfort füllen kann. Ich habe dies bei meinen Patienten immer wieder gesehen. Erfolgreiche Männer und Frauen, umgeben von jedem Luxus, und doch in ihrem Kern hohl.'
    },
  ],
};

// ----- Inline chunker (mirrors production logic but parameterised so we can
// reproduce both pre-fix and post-fix behaviour without touching TextChunker) -----

interface ChunkOpts {
  firstChunkFloor: number;
  secondChunkFloor: number;
  targetChars: number;
  maxChars: number;
}

function extractSentences(text: string): string[] {
  const pattern = /([^.!?。！？]+[.!?。！？])([\s\n]*)/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    sentences.push(match[1] + match[2]);
    lastIndex = pattern.lastIndex;
  }
  const leftover = text.slice(lastIndex).trim();
  if (leftover) sentences.push(leftover);
  return sentences;
}

function chunkText(text: string, opts: ChunkOpts): string[] {
  const sentences = extractSentences(text);
  const chunks: string[] = [];
  const queue = [...sentences];
  let chunkIdx = 1;

  while (queue.length > 0) {
    const target = chunkIdx === 1
      ? opts.firstChunkFloor
      : chunkIdx === 2
        ? opts.secondChunkFloor
        : opts.targetChars;

    let accumulated = '';
    let count = 0;
    for (let i = 0; i < queue.length; i++) {
      const candidate = accumulated + queue[i];
      if (candidate.length > opts.maxChars && count > 0) break;
      accumulated = candidate;
      count++;
      if (accumulated.length >= target) break;
    }

    if (count === 0) {
      // queue head is itself oversized — emit it anyway so we don't loop
      chunks.push(queue[0]);
      queue.shift();
    } else {
      chunks.push(accumulated.trim());
      queue.splice(0, count);
    }
    chunkIdx++;
  }

  return chunks;
}

/**
 * Tail-merge chunker: same as chunkText, but if the LAST chunk is below
 * `tailThreshold` chars AND merging it into the previous chunk stays under
 * `gatewayCap`, fold the tail into the prior chunk. Surgical fix for the
 * "Does that make sense?" problem where short trailing questions render
 * ~20% faster than the engine ceiling.
 */
function chunkTextWithTailMerge(
  text: string,
  opts: ChunkOpts,
  tailThreshold: number,
  gatewayCap: number,
): string[] {
  const chunks = chunkText(text, opts);
  if (chunks.length < 2) return chunks;
  const tail = chunks[chunks.length - 1];
  if (tail.length >= tailThreshold) return chunks;
  const prev = chunks[chunks.length - 2];
  const merged = `${prev.trimEnd()} ${tail.trimStart()}`;
  if (merged.length > gatewayCap) return chunks; // safety: don't blow gateway cap
  return [...chunks.slice(0, -2), merged];
}

// ----- Playback with custom inter-chunk gap -----

/** Mirrors audioQueueManager's per-backend multiplier so lab playback reflects
 * what production users actually hear (TTS-2c). Stays in sync with the table
 * in audioQueueManager.ts.
 *
 * Lab uses the default-slider behaviour (1.0 → backend default applied).
 * The lab doesn't read the user's app speed slider — for that, test live
 * conversations in the actual app where slider ≠ 1.0 passes through as a
 * literal playbackRate override.
 */
function backendPlaybackMultiplier(backend?: string): number {
  const b = (backend ?? '').toLowerCase();
  if (b.includes('kokoro')) return 0.9;
  if (b.includes('qwen')) return 0.95;
  if (b.includes('f5')) return 0.9;
  return 1.0;
}

async function playSequence(
  chunks: Array<{ url: string; backend?: string }>,
  gapMs: number,
  signal: AbortSignal,
  onChunkChange?: (idx: number) => void
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) return;
    onChunkChange?.(i);
    const audio = new Audio(chunks[i].url);
    audio.preload = 'auto';
    audio.playbackRate = backendPlaybackMultiplier(chunks[i].backend);
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    await new Promise<void>((resolve) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); resolve(); };
      const onAbort = () => { audio.pause(); cleanup(); resolve(); };
      signal.addEventListener('abort', onAbort, { once: true });
      audio.play().catch(() => { cleanup(); resolve(); });
    });
    if (i < chunks.length - 1 && gapMs > 0 && !signal.aborted) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, gapMs);
        signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      });
    }
  }
}

// ----- Helpers -----

const langLabel = (l: Lang): 'English' | 'German' => l === 'en' ? 'English' : 'German';

const chunkSizeStr = (chunks: RenderedChunk[]) => chunks.map(c => c.text.length).join(', ');

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

/** Load <audio> metadata to read the actual decoded duration. */
async function measureAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.ondurationchange = null;
    };
    audio.onloadedmetadata = () => {
      // Some browsers report Infinity until durationchange fires
      if (isFinite(audio.duration) && audio.duration > 0) {
        cleanup();
        resolve(audio.duration);
      }
    };
    audio.ondurationchange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        cleanup();
        resolve(audio.duration);
      }
    };
    audio.onerror = () => { cleanup(); resolve(0); };
    setTimeout(() => { cleanup(); resolve(0); }, 5000); // safety timeout
    audio.src = url;
  });
}

/** Engine label colour-coded for the variant card. */
const backendBadge = (backend?: string): { text: string; color: string } => {
  if (!backend) return { text: '?', color: '#888' };
  const lower = backend.toLowerCase();
  if (lower.includes('kokoro')) return { text: backend, color: '#7ec8a8' };
  if (lower.includes('qwen')) return { text: backend, color: '#a78bd9' };
  if (lower.includes('f5')) return { text: backend, color: '#d9a878' };
  return { text: backend, color: '#aaa' };
};

/** Variant-level WPM: total words across chunks / total audio duration (excludes inter-chunk gaps). */
function variantWpm(chunks: RenderedChunk[]): number {
  const totalWords = chunks.reduce((s, c) => s + c.words, 0);
  const totalDur = chunks.reduce((s, c) => s + c.audioDurationS, 0);
  if (totalDur <= 0) return 0;
  return totalWords / (totalDur / 60);
}

function variantTotalAudioS(chunks: RenderedChunk[]): number {
  return chunks.reduce((s, c) => s + c.audioDurationS, 0);
}

/** Sort variant keys for stable display: by base type (oneshot first) then by language+backend. */
const BASE_ORDER = ['oneshot', 'production', 'prefix', 'custom', 'tailmerge'];
function orderedVariantKeys(variants: Record<string, Variant>): string[] {
  const keys = Object.keys(variants);
  return keys.sort((a, b) => {
    const baseA = a.split('__')[0];
    const baseB = b.split('__')[0];
    const idxA = BASE_ORDER.indexOf(baseA);
    const idxB = BASE_ORDER.indexOf(baseB);
    if (idxA !== idxB) return idxA - idxB;
    return a.localeCompare(b);
  });
}

// ----- The page -----

export function TtsQualityLab() {
  const [language, setLanguage] = useState<Lang>('en');
  const [voice, setVoice] = useState<string>(ENGLISH_TECHNICAL_VOICES.orion);
  const [text, setText] = useState<string>(PRESETS.en[1].text);
  const [presetIdx, setPresetIdx] = useState<number>(1);

  // Custom variant inputs
  const [customSpeed, setCustomSpeed] = useState<number>(0.95);
  const [customGapMs, setCustomGapMs] = useState<number>(200);
  const [customFirstFloor, setCustomFirstFloor] = useState<number>(140);
  const [customSecondFloor, setCustomSecondFloor] = useState<number>(140);
  const [customTarget, setCustomTarget] = useState<number>(200);

  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [playingChunk, setPlayingChunk] = useState<number | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);

  // Backend override (admin-only, FSN1 only, requires ALLOW_BACKEND_OVERRIDE=true
  // on the gateway — see server handover from 2026-05-02). Default 'auto' sends
  // no header and lets the gateway's normal routing pick: Kokoro for EN, Qwen3
  // (default) or F5 (load fallback) for DE.
  const [forceBackend, setForceBackend] = useState<'auto' | 'kokoro' | 'qwen3' | 'f5'>('auto');

  // Speed sweep diagnostic — sends same short text at multiple speed values to
  // detect engine speed-honour behaviour (3 hypotheses: honours, ignores, or
  // rejects-and-cascades).
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepResults, setSweepResults] = useState<Array<{
    speed: number;
    backend: string | undefined;
    audioDurationS: number;
    renderMs: number;
    error?: string;
  }>>([]);

  // Default voice when language flips
  useEffect(() => {
    setVoice(language === 'en' ? ENGLISH_TECHNICAL_VOICES.orion : GERMAN_TECHNICAL_VOICES.solaris);
  }, [language]);

  // Update text when preset changes
  useEffect(() => {
    setText(PRESETS[language][presetIdx].text);
  }, [language, presetIdx]);

  const voiceOptions = useMemo(() => {
    if (language === 'en') {
      return Object.entries(ENGLISH_TECHNICAL_VOICES).map(([name, id]) => ({
        id,
        label: `${ENGLISH_VOICE_INFO[name as EnglishVoice].name} (${ENGLISH_VOICE_INFO[name as EnglishVoice].gender})`
      }));
    }
    return Object.entries(GERMAN_TECHNICAL_VOICES).map(([name, id]) => ({
      id,
      label: `${GERMAN_VOICE_INFO[name as GermanVoice].name} (${GERMAN_VOICE_INFO[name as GermanVoice].gender}, ${GERMAN_VOICE_INFO[name as GermanVoice].character})`
    }));
  }, [language]);

  // Stop any active playback before unmount or before kicking off new playback
  const stopPlayback = useCallback(() => {
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
    setPlaying(null);
    setPlayingChunk(null);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // Render helpers ----

  const renderOneShotChunk = async (chunkText: string, speed: number, sessionTag: string): Promise<RenderedChunk> => {
    // Direct fetch (bypassing selfHostedTTS) so we can surface the raw response
    // body when the gateway 500s. selfHostedTTS swallows non-400/429 bodies.
    const t0 = performance.now();
    const requestBody = {
      input: chunkText,
      voice,
      language: language === 'en' ? 'English' : 'German',
      response_format: 'webm',
      speed,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionTag,
    };
    if (forceBackend !== 'auto') {
      // Vite proxy forwards browser headers; gateway requires X-Admin-Token
      // (added server-side in vite.config.mjs proxy headers) AND its own
      // ADMIN_TOKEN env match before honouring the override.
      headers['X-Force-Backend'] = forceBackend;
    }
    const response = await fetch('/v1/audio/speech', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let bodyText = '';
      try { bodyText = await response.text(); } catch { /* ignore */ }
      const body = bodyText.length > 240 ? bodyText.slice(0, 240) + '…' : bodyText;
      console.error('[TtsQualityLab] /v1/audio/speech failed', {
        status: response.status,
        statusText: response.statusText,
        body,
        request: requestBody,
      });
      throw new Error(
        `${response.status} ${response.statusText || 'error'}${body ? ` — ${body}` : ' — empty body (proxy/gateway connection issue)'}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const renderMs = performance.now() - t0;

    const contentType = response.headers.get('content-type') || 'audio/webm';
    const isWebm = contentType.includes('webm') || contentType.includes('opus') || contentType.includes('ogg');
    const mimeType = isWebm ? 'audio/webm;codecs=opus' : 'audio/mpeg';
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audioDurationS = await measureAudioDuration(url);
    const words = countWords(chunkText);
    const wpm = audioDurationS > 0 ? words / (audioDurationS / 60) : 0;
    const backend = response.headers.get('X-TTS-Backend') || response.headers.get('X-Model') || undefined;
    return { text: chunkText, url, blob, bytes: blob.size, renderMs, audioDurationS, words, wpm, backend };
  };

  // Compose a stable variant key that includes the backend + language so that
  // re-rendering the same logical variant with a different backend (e.g.
  // qwen3 → f5) accumulates as a new entry instead of overwriting. Lets you
  // A/B compare engines side-by-side.
  const variantKey = (baseId: string) => `${baseId}__${language}__${forceBackend}`;
  const variantSuffix = () => `[${language.toUpperCase()}/${forceBackend === 'auto' ? `auto-${language === 'en' ? 'kokoro' : 'qwen3'}` : forceBackend}]`;

  const renderVariant = async (
    baseId: string,
    label: string,
    description: string,
    chunkTexts: string[],
    speed: number,
    gapMs: number,
  ) => {
    const id = variantKey(baseId);
    const suffix = variantSuffix();
    const fullLabel = `${label} ${suffix}`;
    setVariants(prev => ({
      ...prev,
      [id]: { id, label: fullLabel, description, speed, gapMs, chunks: [], totalRenderMs: 0, status: 'rendering' }
    }));

    try {
      const sessionTag = `lab_${baseId}_${Date.now()}`;
      const chunks: RenderedChunk[] = [];
      const t0 = performance.now();
      // Sequential render — same as live (TTSScheduler caps at 2 concurrent but
      // for clean comparison we render 1 at a time)
      for (let i = 0; i < chunkTexts.length; i++) {
        const c = await renderOneShotChunk(chunkTexts[i], speed, `${sessionTag}_${i + 1}`);
        chunks.push(c);
      }
      const totalRenderMs = performance.now() - t0;
      setVariants(prev => ({
        ...prev,
        [id]: { id, label: fullLabel, description, speed, gapMs, chunks, totalRenderMs, status: 'ready' }
      }));
    } catch (err) {
      console.error(`[TtsQualityLab] ${id} render failed`, err);
      setVariants(prev => ({
        ...prev,
        [id]: {
          id, label: fullLabel, description, speed, gapMs, chunks: [], totalRenderMs: 0,
          status: 'error', error: (err as Error).message
        }
      }));
    }
  };

  const clearAllVariants = () => {
    stopPlayback();
    // Revoke any blob URLs we still hold to free memory
    Object.values(variants).forEach(v => v.chunks.forEach(c => {
      if (c.url.startsWith('blob:')) URL.revokeObjectURL(c.url);
    }));
    setVariants({});
  };

  // Run a fixed-passage speed sweep against the currently-forced backend.
  // Sequential with 1.5s gap between requests so we don't hammer the GPU
  // (especially relevant if Qwen3 is currently cascading to F5).
  const runSpeedSweep = async () => {
    if (sweepRunning) return;
    setSweepRunning(true);
    setSweepResults([]);

    // Short, deterministic sentence (~75 chars) — small enough to keep GPU
    // load minimal across the sweep, long enough that duration deltas are
    // measurable.
    const sweepText = language === 'en'
      ? 'The path you ask about is one I have walked many times before.'
      : 'Der Weg, nach dem du fragst, ist einer, den ich oft gegangen bin.';
    const speeds = [0.5, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1];
    const results: typeof sweepResults = [];

    for (const speed of speeds) {
      const sessionTag = `sweep_${forceBackend}_${speed}_${Date.now()}`;
      const requestBody = {
        input: sweepText,
        voice,
        language: language === 'en' ? 'English' : 'German',
        response_format: 'webm',
        speed,
      };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionTag,
      };
      if (forceBackend !== 'auto') {
        headers['X-Force-Backend'] = forceBackend;
      }
      const t0 = performance.now();
      try {
        const response = await fetch('/v1/audio/speech', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          results.push({
            speed,
            backend: undefined,
            audioDurationS: 0,
            renderMs: performance.now() - t0,
            error: `${response.status} ${body.slice(0, 120)}`,
          });
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const renderMs = performance.now() - t0;
          const blob = new Blob([arrayBuffer], { type: 'audio/webm;codecs=opus' });
          const url = URL.createObjectURL(blob);
          const audioDurationS = await measureAudioDuration(url);
          URL.revokeObjectURL(url);
          const backend = response.headers.get('X-TTS-Backend')
            || response.headers.get('X-Model')
            || undefined;
          results.push({ speed, backend, audioDurationS, renderMs });
        }
      } catch (err) {
        results.push({
          speed,
          backend: undefined,
          audioDurationS: 0,
          renderMs: performance.now() - t0,
          error: (err as Error).message,
        });
      }
      setSweepResults([...results]);
      // Cooldown between requests
      await new Promise(r => setTimeout(r, 1500));
    }
    setSweepRunning(false);
  };

  const productionOpts = (lang: Lang): ChunkOpts => ({
    firstChunkFloor: 140,    // matches current llmUtils.ts (minChars + 60)
    secondChunkFloor: 140,
    targetChars: 200,
    maxChars: lang === 'en' ? 280 : 260,
  });

  const preFixOpts = (lang: Lang): ChunkOpts => ({
    firstChunkFloor: 80,     // old minChars
    secondChunkFloor: 80,
    targetChars: 200,
    maxChars: lang === 'en' ? 280 : 260,
  });

  const renderAll = async () => {
    stopPlayback();
    // A: One-shot — full text in a single TTS call (the engine ceiling)
    await renderVariant(
      'oneshot',
      'A. One-shot (engine ceiling)',
      'Whole passage sent to the TTS server in a single call. No chunking. This is what the engine produces with full prosody context — the reference for what we are trying to match.',
      [text],
      1.0,
      0,
    );
    // B: Production current (after today's fixes)
    await renderVariant(
      'production',
      'B. Production (current, post-fix)',
      'Production TextChunker with the new 140-char floor for chunks 1+2 and 200ms inter-chunk gap at playback. Speed 1.00 (live default).',
      chunkText(text, productionOpts(language)),
      1.0,
      200,
    );
    // C: Pre-fix baseline
    await renderVariant(
      'prefix',
      'C. Pre-fix baseline (regression check)',
      'Old behaviour: 80-char floor for chunks 1+2 (in the documented "10% fast" zone), 0ms gap. This is what users heard before today.',
      chunkText(text, preFixOpts(language)),
      1.0,
      0,
    );
    // D: Custom (user-tunable)
    await renderVariant(
      'custom',
      `D. Custom (your params)`,
      `Speed ${customSpeed} · gap ${customGapMs}ms · chunk-1 floor ${customFirstFloor} · chunk-2 floor ${customSecondFloor} · target ${customTarget} · max ${language === 'en' ? 280 : 260}`,
      chunkText(text, {
        firstChunkFloor: customFirstFloor,
        secondChunkFloor: customSecondFloor,
        targetChars: customTarget,
        maxChars: language === 'en' ? 280 : 260,
      }),
      customSpeed,
      customGapMs,
    );
    // E: Production + trailing-tail merge (surgical fix for the "Does that
    // make sense?" rushed-tail problem). Merges last chunk into previous if
    // it's < 80 chars AND the merged result fits under the gateway cap.
    await renderVariant(
      'tailmerge',
      'E. Production + trailing-tail merge',
      'Same as B, but if the last chunk is <80 chars (would render rushed) it gets folded into the previous chunk. Combined chunk stays under the gateway cap (DE 500 / EN 600). Speed 1.00, gap 200ms.',
      chunkTextWithTailMerge(text, productionOpts(language), 80, language === 'en' ? 600 : 500),
      1.0,
      200,
    );
  };

  const renderJustCustom = async () => {
    stopPlayback();
    await renderVariant(
      'custom',
      `D. Custom (your params)`,
      `Speed ${customSpeed} · gap ${customGapMs}ms · chunk-1 floor ${customFirstFloor} · chunk-2 floor ${customSecondFloor} · target ${customTarget} · max ${language === 'en' ? 280 : 260}`,
      chunkText(text, {
        firstChunkFloor: customFirstFloor,
        secondChunkFloor: customSecondFloor,
        targetChars: customTarget,
        maxChars: language === 'en' ? 280 : 260,
      }),
      customSpeed,
      customGapMs,
    );
  };

  const playVariant = async (id: string) => {
    const v = variants[id];
    if (!v || v.status !== 'ready' || v.chunks.length === 0) return;
    stopPlayback();
    const ac = new AbortController();
    playbackAbortRef.current = ac;
    setPlaying(id);
    setPlayingChunk(0);
    try {
      await playSequence(
        v.chunks.map(c => ({ url: c.url, backend: c.backend })),
        v.gapMs,
        ac.signal,
        (idx) => setPlayingChunk(idx),
      );
    } finally {
      if (playbackAbortRef.current === ac) {
        playbackAbortRef.current = null;
        setPlaying(null);
        setPlayingChunk(null);
      }
    }
  };

  const downloadVariant = async (id: string) => {
    const v = variants[id];
    if (!v || v.chunks.length === 0) return;
    // Save each chunk separately — we don't try to concat (would need ffmpeg.wasm)
    for (let i = 0; i < v.chunks.length; i++) {
      const c = v.chunks[i];
      const ext = c.blob.type.includes('webm') || c.blob.type.includes('opus') ? 'webm' : 'mp3';
      const a = document.createElement('a');
      a.href = c.url;
      a.download = `${id}_chunk${i + 1}_of_${v.chunks.length}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 80)); // throttle browser download dialog
    }
  };

  // Live preview of how the text would chunk under each variant — without rendering
  const previewProduction = useMemo(() => chunkText(text, productionOpts(language)), [text, language]);
  const previewPreFix = useMemo(() => chunkText(text, preFixOpts(language)), [text, language]);
  const previewCustom = useMemo(() => chunkText(text, {
    firstChunkFloor: customFirstFloor,
    secondChunkFloor: customSecondFloor,
    targetChars: customTarget,
    maxChars: language === 'en' ? 280 : 260,
  }), [text, language, customFirstFloor, customSecondFloor, customTarget]);

  return (
    <div style={styles.page}>
      <div style={styles.pageInner}>
      <header style={styles.header}>
        <h1 style={styles.h1}>TTS Quality Lab</h1>
        <p style={styles.sub}>
          Render the same passage four ways and compare by ear. All variants hit the production
          self-hosted TTS gateway (Kokoro for EN, Qwen3-TTS / F5 for DE) so you are testing the
          actual engine output, not a local approximation.
        </p>
      </header>

      <section style={styles.card}>
        <h2 style={styles.h2}>Input</h2>
        <div style={styles.row}>
          <label style={styles.label}>
            Language:
            <select value={language} onChange={e => setLanguage(e.target.value as Lang)} style={styles.select}>
              <option value="en">English (Kokoro)</option>
              <option value="de">German (Qwen3-TTS / F5)</option>
            </select>
          </label>
          <label style={styles.label}>
            Voice:
            <select value={voice} onChange={e => setVoice(e.target.value)} style={styles.select}>
              {voiceOptions.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Preset:
            <select value={presetIdx} onChange={e => setPresetIdx(Number(e.target.value))} style={styles.select}>
              {PRESETS[language].map((p, i) => (
                <option key={i} value={i}>{p.name}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Force backend:
            <select
              value={forceBackend}
              onChange={e => setForceBackend(e.target.value as typeof forceBackend)}
              style={styles.select}
              title="Pin a specific TTS engine. Auto = gateway's normal routing. Override is FSN1-only and requires ALLOW_BACKEND_OVERRIDE=true on the server."
            >
              <option value="auto">auto (normal routing)</option>
              <option value="kokoro">kokoro (EN only)</option>
              <option value="qwen3">qwen3 (DE)</option>
              <option value="f5">f5 (DE)</option>
            </select>
          </label>
        </div>
        {forceBackend !== 'auto' && (
          <div style={{ ...styles.meta, color: 'var(--gold-subtle, #d4a539)', marginTop: 8 }}>
            ⚠ Backend override active: every request will send <code>X-Force-Backend: {forceBackend}</code>.
            Routes only land on FSN1 with the env flag on; NBG1 and any anonymous traffic will 403.
          </div>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          style={styles.textarea}
          rows={6}
          placeholder={`Enter ${langLabel(language)} text to test…`}
        />
        <div style={styles.meta}>
          {text.length} chars · {text.trim().split(/\s+/).filter(Boolean).length} words
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Custom variant parameters</h2>
        <div style={styles.row}>
          <label style={styles.label}>
            Speed:
            <input type="number" value={customSpeed} onChange={e => setCustomSpeed(Number(e.target.value))}
              step={0.05} min={0.5} max={1.5} style={styles.numInput} />
          </label>
          <label style={styles.label}>
            Gap (ms):
            <input type="number" value={customGapMs} onChange={e => setCustomGapMs(Number(e.target.value))}
              step={50} min={0} max={1000} style={styles.numInput} />
          </label>
          <label style={styles.label}>
            Chunk-1 floor:
            <input type="number" value={customFirstFloor} onChange={e => setCustomFirstFloor(Number(e.target.value))}
              step={20} min={50} max={400} style={styles.numInput} />
          </label>
          <label style={styles.label}>
            Chunk-2 floor:
            <input type="number" value={customSecondFloor} onChange={e => setCustomSecondFloor(Number(e.target.value))}
              step={20} min={50} max={400} style={styles.numInput} />
          </label>
          <label style={styles.label}>
            Chunks 3+ target:
            <input type="number" value={customTarget} onChange={e => setCustomTarget(Number(e.target.value))}
              step={20} min={100} max={400} style={styles.numInput} />
          </label>
        </div>
        <div style={styles.meta}>
          Max chars enforced from validated values: {language === 'en' ? 280 : 260}.
          Engine limits per <code>f5-max-chars-physics.md</code> + <code>tts-chunker-sweep-2026-04-17.md</code>.
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Chunk preview (no API call)</h2>
        <PreviewBlock label="B. Production" chunks={previewProduction} />
        <PreviewBlock label="C. Pre-fix" chunks={previewPreFix} />
        <PreviewBlock label="D. Custom" chunks={previewCustom} />
      </section>

      <section style={styles.card}>
        <div style={{ ...styles.row, marginBottom: 12 }}>
          <button onClick={renderAll} style={styles.bigButton}>Render all variants</button>
          <button onClick={renderJustCustom} style={styles.button}>Re-render custom only</button>
          <button onClick={stopPlayback} style={styles.button} disabled={!playing}>Stop playback</button>
          <button onClick={clearAllVariants} style={styles.button} disabled={Object.keys(variants).length === 0}>
            Clear all results
          </button>
        </div>

        <ComparisonSummary variants={variants} />

        {orderedVariantKeys(variants).map(id => {
          const v = variants[id];
          if (!v) return null;
          return (
            <VariantCard
              key={id}
              variant={v}
              isPlaying={playing === id}
              playingChunkIdx={playing === id ? playingChunk : null}
              onPlay={() => playVariant(id)}
              onDownload={() => downloadVariant(id)}
            />
          );
        })}
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Engine speed-honour sweep</h2>
        <p style={{ ...styles.meta, marginBottom: 8 }}>
          Renders the same short sentence (~75 chars) at 7 speed values (0.5 → 1.1) against
          the currently-forced backend ({forceBackend}). Three signals to look for in the table:
          (a) <strong>backend column</strong> — same engine across all rows means no cascade;
          (b) <strong>audio column</strong> — durations should scale inversely with speed if the
          engine honours the param (0.5 ≈ 2× as long as 1.0); identical durations mean speed is
          silently dropped; (c) <strong>error column</strong> — explicit rejections show up here.
          1.5s cooldown between requests to keep GPU thermals manageable.
        </p>
        <div style={{ ...styles.row, marginBottom: 12 }}>
          <button
            onClick={runSpeedSweep}
            disabled={sweepRunning}
            style={styles.bigButton}
          >
            {sweepRunning ? 'Sweeping…' : `Run speed sweep [${forceBackend} / ${language.toUpperCase()}]`}
          </button>
          <button
            onClick={() => setSweepResults([])}
            disabled={sweepRunning || sweepResults.length === 0}
            style={styles.button}
          >
            Clear sweep
          </button>
        </div>
        {sweepResults.length > 0 && (
          <table style={styles.summaryTable}>
            <thead>
              <tr style={styles.summaryHead}>
                <th style={styles.chunkCellLeft}>Speed</th>
                <th style={styles.chunkCellLeft}>Backend</th>
                <th style={styles.chunkCellLeft}>Audio</th>
                <th style={styles.chunkCellLeft}>Render</th>
                <th style={styles.chunkCellLeft}>Δ vs speed=1.0</th>
                <th style={styles.chunkCellLeft}>Note</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const baseline = sweepResults.find(r => r.speed === 1.0);
                return sweepResults.map((r, i) => {
                  const badge = backendBadge(r.backend);
                  const baseDur = baseline?.audioDurationS ?? 0;
                  const deltaPct = baseDur > 0 && r.audioDurationS > 0
                    ? ((r.audioDurationS / baseDur - 1) * 100)
                    : 0;
                  // Expected duration ratio: 1/speed (if engine honours speed)
                  const expectedRatio = 1.0 / r.speed;
                  const actualRatio = baseDur > 0 ? r.audioDurationS / baseDur : 0;
                  const ratioOff = baseDur > 0 ? Math.abs(actualRatio - expectedRatio) : 0;
                  const speedHonoured = baseDur > 0 && ratioOff < 0.1;
                  return (
                    <tr key={i}>
                      <td style={styles.chunkCellLeft}>{r.speed}</td>
                      <td style={{ ...styles.chunkCellLeft, color: badge.color }}>
                        {r.backend ?? (r.error ? 'error' : '?')}
                      </td>
                      <td style={styles.chunkCellLeft}>
                        {r.audioDurationS > 0 ? `${r.audioDurationS.toFixed(2)}s` : '—'}
                      </td>
                      <td style={styles.chunkCellLeft}>{r.renderMs.toFixed(0)}ms</td>
                      <td style={styles.chunkCellLeft}>
                        {r.speed === 1.0
                          ? '— (baseline)'
                          : baseDur > 0
                            ? `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`
                            : '?'}
                      </td>
                      <td style={{ ...styles.chunkCellLeft, fontSize: 11 }}>
                        {r.error
                          ? <span style={{ color: '#ff6b6b' }}>{r.error}</span>
                          : r.speed === 1.0
                            ? 'reference'
                            : speedHonoured
                              ? <span style={{ color: '#7ec8a8' }}>honoured (≈{(expectedRatio * 100).toFixed(0)}% of baseline)</span>
                              : <span style={{ color: '#d9c878' }}>not honoured (expected {(expectedRatio * 100).toFixed(0)}%, got {(actualRatio * 100).toFixed(0)}%)</span>}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
        <div style={{ ...styles.meta, marginTop: 8 }}>
          ⚠ Hot-GPU advisory: if Qwen3 is currently cascading to F5 (every Qwen3 attempt fails →
          F5 retry), running this sweep against <code>qwen3</code> will double the GPU load per row.
          Recommend waiting until server-Claude has rolled back the per-engine speed defaults
          before sweeping Qwen3, or sweep Kokoro / F5 first to confirm the harness works.
        </div>
      </section>
      </div>
    </div>
  );
}

// ----- Subcomponents -----

const PreviewBlock: React.FC<{ label: string; chunks: string[] }> = ({ label, chunks }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>
      <strong>{label}:</strong> {chunks.length} chunk{chunks.length === 1 ? '' : 's'}
      {' '}({chunks.map(c => c.length).join(', ')} chars)
    </div>
  </div>
);

const ComparisonSummary: React.FC<{ variants: Record<string, Variant> }> = ({ variants }) => {
  const ordered = orderedVariantKeys(variants)
    .map(id => variants[id])
    .filter((v): v is Variant => !!v && v.status === 'ready' && v.chunks.length > 0);

  if (ordered.length === 0) return null;

  // Compute a per-{lang+backend} ceiling from the corresponding oneshot variant.
  // Each variant id is `${baseType}__${lang}__${backend}` — group by the suffix
  // so each backend's ceiling shows separately.
  const ceilingByGroup: Record<string, number> = {};
  for (const v of ordered) {
    const [base, ...rest] = v.id.split('__');
    const groupKey = rest.join('__');
    if (base === 'oneshot') {
      ceilingByGroup[groupKey] = variantWpm(v.chunks);
    }
  }
  const groupKey = (id: string): string => id.split('__').slice(1).join('__');

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px 0', color: 'var(--text-secondary, #aaa)' }}>
        Comparison summary
        {Object.entries(ceilingByGroup).length > 0 && (
          <span style={{ fontWeight: 'normal' }}>
            {' '}— per-backend ceiling: {Object.entries(ceilingByGroup).map(([k, w]) =>
              <span key={k} style={{ marginLeft: 8 }}>{k}: <strong>{w.toFixed(0)}</strong> WPM</span>
            )}
          </span>
        )}
      </h3>
      <table style={styles.summaryTable}>
        <thead>
          <tr style={styles.summaryHead}>
            <th style={styles.chunkCellLeft}>Variant</th>
            <th style={styles.chunkCellLeft}>Lang/Backend</th>
            <th style={styles.chunkCellLeft}>Chunks</th>
            <th style={styles.chunkCellLeft}>Audio</th>
            <th style={styles.chunkCellLeft}>Raw WPM</th>
            <th style={styles.chunkCellLeft} title="Raw WPM × per-backend playbackRate multiplier (Kokoro 0.9, Qwen3 0.95, F5 0.9). What the user actually hears.">
              Perceived WPM
            </th>
            <th style={styles.chunkCellLeft}>Δ vs ceiling</th>
            <th style={styles.chunkCellLeft}>Actual</th>
            <th style={styles.chunkCellLeft}>Speed · Gap</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(v => {
            const wpm = variantWpm(v.chunks);
            const totalAudioS = variantTotalAudioS(v.chunks);
            const grp = groupKey(v.id);
            const ceilingWpm = ceilingByGroup[grp] || 0;
            const isCeiling = v.id.startsWith('oneshot__');
            const delta = ceilingWpm > 0 ? ((wpm - ceilingWpm) / ceilingWpm) * 100 : 0;
            const deltaColor = Math.abs(delta) < 3 ? '#7ec8a8' : Math.abs(delta) < 8 ? '#d9c878' : '#ff9b9b';
            const actualBackends = Array.from(new Set(v.chunks.map(c => c.backend).filter(Boolean)));
            // Per-chunk perceived WPM: weight each chunk's WPM by its multiplier-adjusted duration
            const totalWords = v.chunks.reduce((s, c) => s + c.words, 0);
            const totalPerceivedDur = v.chunks.reduce((s, c) =>
              s + c.audioDurationS / backendPlaybackMultiplier(c.backend), 0);
            const perceivedWpm = totalPerceivedDur > 0 ? totalWords / (totalPerceivedDur / 60) : wpm;
            return (
              <tr key={v.id}>
                <td style={styles.chunkCellLeft}>{v.id.split('__')[0]}</td>
                <td style={{ ...styles.chunkCellLeft, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{grp}</td>
                <td style={styles.chunkCellLeft}>{v.chunks.length}</td>
                <td style={styles.chunkCellLeft}>{totalAudioS.toFixed(2)}s</td>
                <td style={{ ...styles.chunkCellLeft, color: '#aaa' }}>{wpm.toFixed(0)}</td>
                <td style={{ ...styles.chunkCellLeft, fontWeight: 600 }}>{perceivedWpm.toFixed(0)}</td>
                <td style={{ ...styles.chunkCellLeft, color: isCeiling ? '#aaa' : deltaColor }}>
                  {isCeiling ? '—' : ceilingWpm > 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '?'}
                </td>
                <td style={styles.chunkCellLeft}>
                  {actualBackends.length === 0 ? '?' : actualBackends.map(b => {
                    const badge = backendBadge(b);
                    return <span key={b} style={{ color: badge.color, marginRight: 6 }}>{badge.text}</span>;
                  })}
                </td>
                <td style={styles.chunkCellLeft}>{v.speed} · {v.gapMs}ms</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', marginTop: 6 }}>
        <strong>Raw WPM</strong> = engine output rate (what the audio file plays at speed=1.0).
        <strong> Perceived WPM</strong> = raw × per-backend playbackRate multiplier (Kokoro 0.9 / Qwen3 0.95 / F5 0.9) — what the user hears when you hit Play.
        Δ vs ceiling is computed on raw WPM (engine quality proxy). Run with one backend, then switch
        "Force backend" and render again — sets accumulate for A/B.
      </div>
    </div>
  );
};

const VariantCard: React.FC<{
  variant: Variant;
  isPlaying: boolean;
  playingChunkIdx: number | null;
  onPlay: () => void;
  onDownload: () => void;
}> = ({ variant: v, isPlaying, playingChunkIdx, onPlay, onDownload }) => {
  const totalAudioBytes = v.chunks.reduce((s, c) => s + c.bytes, 0);
  const totalAudioS = variantTotalAudioS(v.chunks);
  const overallWpm = variantWpm(v.chunks);
  const renderLabel = v.chunks.length === 0 ? '–' : `${v.totalRenderMs.toFixed(0)}ms render`;
  const wallS = totalAudioS + (v.gapMs / 1000) * Math.max(0, v.chunks.length - 1);
  return (
    <div style={styles.variantCard}>
      <div style={styles.variantHeader}>
        <div>
          <div style={styles.variantTitle}>{v.label}</div>
          <div style={styles.variantDesc}>{v.description}</div>
        </div>
        <div style={styles.variantActions}>
          <button onClick={onPlay} disabled={v.status !== 'ready'} style={styles.button}>
            {isPlaying ? '◼ Playing…' : '▶ Play'}
          </button>
          <button onClick={onDownload} disabled={v.status !== 'ready'} style={styles.button}>
            ⬇ Download
          </button>
        </div>
      </div>

      {v.status === 'rendering' && <div style={styles.statusRow}>Rendering…</div>}
      {v.status === 'error' && <div style={styles.statusRowError}>Error: {v.error}</div>}
      {v.status === 'ready' && (
        <>
          <div style={styles.statusRow}>
            <span><strong>{v.chunks.length}</strong> chunk{v.chunks.length === 1 ? '' : 's'}</span>
            <span>chars: {chunkSizeStr(v.chunks)}</span>
            <span>audio: <strong>{totalAudioS.toFixed(2)}s</strong></span>
            <span>wall (with gaps): {wallS.toFixed(2)}s</span>
            <span style={styles.wpmBadge}>WPM <strong>{overallWpm.toFixed(0)}</strong></span>
            <span>bytes: {(totalAudioBytes / 1024).toFixed(1)}KB</span>
            <span>{renderLabel}</span>
            <span>speed {v.speed} · gap {v.gapMs}ms</span>
          </div>

          {v.chunks.length > 1 && (
            <table style={styles.chunkTable}>
              <thead>
                <tr style={styles.chunkRowHead}>
                  <th style={styles.chunkCellLeft}>#</th>
                  <th style={styles.chunkCellLeft}>chars</th>
                  <th style={styles.chunkCellLeft}>words</th>
                  <th style={styles.chunkCellLeft}>audio</th>
                  <th style={styles.chunkCellLeft}>WPM</th>
                  <th style={styles.chunkCellLeft}>backend</th>
                  <th style={styles.chunkCellLeft}>render</th>
                </tr>
              </thead>
              <tbody>
                {v.chunks.map((c, i) => {
                  const badge = backendBadge(c.backend);
                  const isFastZone = c.text.length < 140;
                  const wpmColor = c.wpm > 180 ? '#ff9b9b' : c.wpm < 130 ? '#9bd5ff' : 'inherit';
                  return (
                    <tr key={i} style={i === playingChunkIdx ? styles.chunkRowPlaying : undefined}>
                      <td style={styles.chunkCellLeft}>{i + 1}</td>
                      <td style={{ ...styles.chunkCellLeft, color: isFastZone ? '#d9a878' : 'inherit' }}>
                        {c.text.length}
                        {isFastZone && <span title="Below F5 clean zone (140-300)"> ⚠</span>}
                      </td>
                      <td style={styles.chunkCellLeft}>{c.words}</td>
                      <td style={styles.chunkCellLeft}>{c.audioDurationS.toFixed(2)}s</td>
                      <td style={{ ...styles.chunkCellLeft, color: wpmColor, fontWeight: 600 }}>
                        {c.wpm.toFixed(0)}
                      </td>
                      <td style={{ ...styles.chunkCellLeft, color: badge.color }}>{badge.text}</td>
                      <td style={styles.chunkCellLeft}>{c.renderMs.toFixed(0)}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {v.chunks.length === 1 && (
            <div style={styles.statusRow}>
              {v.chunks[0].backend && (
                <span style={{ color: backendBadge(v.chunks[0].backend).color }}>
                  backend: {v.chunks[0].backend}
                </span>
              )}
              <span>render: {v.chunks[0].renderMs.toFixed(0)}ms</span>
            </div>
          )}
        </>
      )}

      {isPlaying && playingChunkIdx !== null && v.chunks.length > 1 && (
        <div style={styles.playingRow}>
          ▶ chunk {playingChunkIdx + 1} of {v.chunks.length}
        </div>
      )}
    </div>
  );
};

// ----- Inline styles (avoids touching the frozen CSS architecture) -----

const styles: Record<string, React.CSSProperties> = {
  page: {
    color: 'var(--text-primary, #f3f3f3)',
    background: 'var(--bg-primary, #0b0b10)',
    height: '100vh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  pageInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px 120px',
  },
  header: { marginBottom: 24 },
  h1: { margin: 0, fontSize: 28, fontWeight: 600 },
  h2: { margin: '0 0 12px 0', fontSize: 18, fontWeight: 500 },
  sub: { margin: '8px 0 0 0', color: 'var(--text-secondary, #aaa)', fontSize: 14, lineHeight: 1.5, maxWidth: 760 },
  card: {
    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4, color: 'var(--text-secondary, #aaa)' },
  select: {
    minWidth: 180, padding: '8px 10px', borderRadius: 6,
    background: 'var(--bg-primary, #16161e)', color: 'inherit',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  },
  numInput: {
    width: 90, padding: '8px 10px', borderRadius: 6,
    background: 'var(--bg-primary, #16161e)', color: 'inherit',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  },
  textarea: {
    width: '100%', marginTop: 12, padding: 12, borderRadius: 6, fontSize: 14, lineHeight: 1.5,
    background: 'var(--bg-primary, #16161e)', color: 'inherit', resize: 'vertical',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
    fontFamily: 'inherit',
  },
  meta: { fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 6 },
  bigButton: {
    padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
    background: 'var(--gold-subtle, #d4a539)', color: '#000', border: 'none',
  },
  button: {
    padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
    background: 'var(--bg-primary, #16161e)', color: 'inherit',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.18))',
  },
  variantCard: {
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    borderRadius: 8, padding: 12, marginBottom: 10,
    background: 'var(--bg-primary, rgba(0,0,0,0.25))',
  },
  variantHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  variantTitle: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  variantDesc: { fontSize: 12, color: 'var(--text-secondary, #aaa)', lineHeight: 1.4, maxWidth: 720 },
  variantActions: { display: 'flex', gap: 8, flexShrink: 0 },
  statusRow: { display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary, #aaa)', flexWrap: 'wrap', alignItems: 'center' },
  statusRowError: { fontSize: 12, color: '#ff6b6b' },
  playingRow: { marginTop: 6, fontSize: 12, color: 'var(--gold-subtle, #d4a539)' },
  wpmBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    background: 'var(--gold-subtle, rgba(212,165,57,0.18))',
    color: 'var(--text-primary, #fff)',
    fontWeight: 500,
  },
  chunkTable: {
    width: '100%',
    marginTop: 10,
    borderCollapse: 'collapse',
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  },
  chunkRowHead: {
    color: 'var(--text-secondary, #888)',
    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  },
  chunkRowPlaying: {
    background: 'rgba(212,165,57,0.12)',
  },
  chunkCellLeft: {
    textAlign: 'left',
    padding: '4px 8px',
    fontWeight: 'normal',
  },
  summaryTable: {
    width: '100%',
    marginTop: 10,
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  summaryHead: {
    color: 'var(--text-secondary, #888)',
    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
    fontSize: 12,
  },
};

export default TtsQualityLab;
