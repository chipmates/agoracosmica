// Pipeline Benchmark Page — LLM + TTS A/B comparison and latency testing
// LLM: Nebius (EU) for Qwen3-235B streaming (DeepInfra removed — fails at scale)
// TTS: Kokoro (EN), Chatterbox (DE/EN), OpenAI, and custom endpoints
// Measures TTFT, tokens/sec, TTFB, total latency, RT factor

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { keyStorage } from '../services/storage/keyStorageService';
import { KOKORO_TECHNICAL_VOICES, KOKORO_VOICE_INFO, type KokoroVoice } from '../services/audio/voices/voiceDefinitions';

// ============================================
// Types
// ============================================

interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  apiKeySource: 'deepinfra' | 'openai' | 'custom';
  customApiKey: string;
  voice: string;
  speed: number;
  language?: string; // For multilingual models (e.g. 'en', 'de')
}

interface TestResult {
  provider: string;
  textLength: number;
  ttfb: number; // ms - time to first byte
  totalTime: number; // ms - total generation time
  audioDuration: number; // seconds
  rtFactor: number; // realtime factor (audioDuration / totalTime)
  audioUrl: string;
  audioSize: number; // bytes
  error?: string;
  timestamp: number;
}

interface BatchStats {
  count: number;
  ttfb: { min: number; avg: number; max: number; p95: number };
  totalTime: { min: number; avg: number; max: number; p95: number };
  rtFactor: { min: number; avg: number; max: number };
}

interface StreamingResult {
  chunkIndex: number;
  textLength: number;
  requestTime: number;
  responseTime: number;
  latency: number;
  audioDuration: number;
  bufferUnderrun: boolean;
}

interface ParallelStreamState {
  ttft: number;
  tokenCount: number;
  done: boolean;
  genSpeed: number;
  totalTime: number;
  error?: string;
  lastContent: string;
}

// ============================================
// Constants
// ============================================

const SAMPLE_TEXTS = {
  // Short — typical streaming chunk
  short_en: "The unexamined life is not worth living. But what does it truly mean to examine one's existence? Perhaps it begins with a single honest question.",
  short_de: "Das ungeprüfte Leben ist nicht lebenswert. Doch was bedeutet es wirklich, seine Existenz zu prüfen? Vielleicht beginnt es mit einer einzigen ehrlichen Frage.",

  // Medium — prism segment length
  medium_en: "I have learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel. There is no greater agony than bearing an untold story inside you. We delight in the beauty of the butterfly, but rarely admit the changes it has gone through to achieve that beauty. If you are always trying to be normal, you will never know how amazing you can be. There is no greater agony than bearing an untold story inside you.",
  medium_de: "Ich habe gelernt, dass die Menschen vergessen werden, was du gesagt hast, vergessen werden, was du getan hast, aber nie vergessen werden, wie du sie hast fühlen lassen. Es gibt keine größere Qual, als eine unerzählte Geschichte in sich zu tragen. Wir erfreuen uns an der Schönheit des Schmetterlings, geben aber selten die Veränderungen zu, die er durchgemacht hat, um diese Schönheit zu erreichen.",

  // Long — council segment length
  long_en: "The crisis of meaning in our modern age is not merely a philosophical abstraction — it is a lived reality that touches every human soul. When we strip away the ancient mythologies, the religious frameworks, the tribal identities that once gave our ancestors a sense of cosmic belonging, what remains? A void. An abyss of purposelessness that no amount of material comfort can fill. I have seen this in my patients, time and again — successful men and women, surrounded by every luxury the modern world can offer, yet hollow at their core. They come to me not with neuroses born of repression, as Freud would have it, but with a deeper malady: the sense that their lives lack meaning, that they are actors on a stage without a script. This is what I call the individuation crisis — the failure to connect with the deeper Self, the archetypal ground of our being. The solution is not to retreat into the past, into dead orthodoxies and borrowed beliefs. The solution is to go forward, into the depths of one's own psyche, to confront the shadow, to integrate the anima or animus, and to discover the unique myth that gives your particular life its irreplaceable significance.",
  long_de: "Die Sinnkrise unserer modernen Zeit ist nicht bloß eine philosophische Abstraktion — sie ist eine gelebte Realität, die jede menschliche Seele berührt. Wenn wir die alten Mythologien abstreifen, die religiösen Rahmenwerke, die Stammesidentitäten, die einst unseren Vorfahren ein Gefühl kosmischer Zugehörigkeit gaben, was bleibt dann? Eine Leere. Ein Abgrund der Sinnlosigkeit, den kein Maß an materiellem Komfort füllen kann. Ich habe dies bei meinen Patienten immer wieder gesehen — erfolgreiche Männer und Frauen, umgeben von jedem Luxus, den die moderne Welt bieten kann, und doch in ihrem Kern hohl. Sie kommen zu mir nicht mit Neurosen, die aus Verdrängung geboren sind, wie Freud es haben wollte, sondern mit einem tieferen Leiden: dem Gefühl, dass ihr Leben keinen Sinn hat, dass sie Schauspieler auf einer Bühne ohne Drehbuch sind."
};

const PRESET_VOICES = {
  kokoro: Object.entries(KOKORO_TECHNICAL_VOICES).map(([name, id]) => ({
    id,
    name: `${KOKORO_VOICE_INFO[name as KokoroVoice].name} (${KOKORO_VOICE_INFO[name as KokoroVoice].gender}, ${KOKORO_VOICE_INFO[name as KokoroVoice].accent})`
  })),
  openai: [
    { id: 'nova', name: 'Nova (female)' },
    { id: 'alloy', name: 'Alloy (female)' },
    { id: 'shimmer', name: 'Shimmer (female)' },
    { id: 'echo', name: 'Echo (male)' },
    { id: 'onyx', name: 'Onyx (male)' },
    { id: 'ash', name: 'Ash (male)' },
  ],
  chatterbox: [
    // Chatterbox on DeepInfra uses same voice IDs as Kokoro
    ...Object.entries(KOKORO_TECHNICAL_VOICES).map(([name, id]) => ({
      id,
      name: `${KOKORO_VOICE_INFO[name as KokoroVoice].name} (${KOKORO_VOICE_INFO[name as KokoroVoice].gender}, ${KOKORO_VOICE_INFO[name as KokoroVoice].accent})`
    })),
  ]
};

const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  kokoro: {
    id: 'kokoro',
    name: 'Kokoro (DeepInfra)',
    endpoint: 'https://api.deepinfra.com/v1/openai/audio/speech',
    model: 'hexgrad/Kokoro-82M',
    apiKeySource: 'deepinfra',
    customApiKey: '',
    voice: 'af_heart',
    speed: 1.0,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI tts-1',
    endpoint: 'https://api.openai.com/v1/audio/speech',
    model: 'tts-1',
    apiKeySource: 'openai',
    customApiKey: '',
    voice: 'nova',
    speed: 1.0,
  },
  chatterbox: {
    id: 'chatterbox',
    name: 'Chatterbox Multi (DeepInfra)',
    endpoint: 'https://api.deepinfra.com/v1/openai/audio/speech',
    model: 'ResembleAI/chatterbox-multilingual',
    apiKeySource: 'deepinfra',
    customApiKey: '',
    voice: 'af_heart',
    speed: 1.0,
    language: 'en',
  },
  chatterbox_turbo: {
    id: 'chatterbox_turbo',
    name: 'Chatterbox Turbo (DeepInfra)',
    endpoint: 'https://api.deepinfra.com/v1/openai/audio/speech',
    model: 'ResembleAI/chatterbox-turbo',
    apiKeySource: 'deepinfra',
    customApiKey: '',
    voice: 'af_heart',
    speed: 1.0,
  },
  custom: {
    id: 'custom',
    name: 'Custom Endpoint',
    endpoint: '',
    model: '',
    apiKeySource: 'custom',
    customApiKey: '',
    voice: '',
    speed: 1.0,
  },
};

// ============================================
// TTS API Call
// ============================================

async function callTTS(
  provider: ProviderConfig,
  text: string
): Promise<TestResult> {
  const startTime = performance.now();

  // Resolve API key
  let apiKey = '';
  if (provider.apiKeySource === 'custom') {
    apiKey = provider.customApiKey;
  } else {
    const stored = await keyStorage.getKey(provider.apiKeySource);
    if (!stored) {
      return {
        provider: provider.name,
        textLength: text.length,
        ttfb: 0,
        totalTime: 0,
        audioDuration: 0,
        rtFactor: 0,
        audioUrl: '',
        audioSize: 0,
        error: `No ${provider.apiKeySource} API key found. Add it in Settings → API Keys.`,
        timestamp: Date.now(),
      };
    }
    apiKey = stored;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    input: text,
    voice: provider.voice,
    speed: provider.speed,
    response_format: 'mp3',
  };
  if (provider.language) {
    body.language = provider.language;
  }

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const ttfbTime = performance.now();
    const ttfb = ttfbTime - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        provider: provider.name,
        textLength: text.length,
        ttfb,
        totalTime: performance.now() - startTime,
        audioDuration: 0,
        rtFactor: 0,
        audioUrl: '',
        audioSize: 0,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        timestamp: Date.now(),
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const totalTime = performance.now() - startTime;

    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);

    // Get audio duration
    const audioDuration = await getAudioDuration(audioUrl);
    const rtFactor = audioDuration > 0 ? audioDuration / (totalTime / 1000) : 0;

    return {
      provider: provider.name,
      textLength: text.length,
      ttfb,
      totalTime,
      audioDuration,
      rtFactor,
      audioUrl,
      audioSize: arrayBuffer.byteLength,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      provider: provider.name,
      textLength: text.length,
      ttfb: 0,
      totalTime: performance.now() - startTime,
      audioDuration: 0,
      rtFactor: 0,
      audioUrl: '',
      audioSize: 0,
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
  }
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      resolve(0);
    });
    // Timeout fallback
    setTimeout(() => resolve(0), 5000);
  });
}

function computeStats(values: number[]): { min: number; avg: number; max: number; p95: number } {
  if (values.length === 0) return { min: 0, avg: 0, max: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p95Index = Math.floor(sorted.length * 0.95);
  return {
    min: sorted[0],
    avg: sum / sorted.length,
    max: sorted[sorted.length - 1],
    p95: sorted[Math.min(p95Index, sorted.length - 1)],
  };
}

// ============================================
// LLM Types & Constants
// ============================================

interface LLMProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  apiKey: string; // direct key (from env or manual)
}

interface LLMResult {
  provider: string;
  model: string;
  ttft: number; // Time to First Token (ms)
  totalTime: number; // Total completion time (ms)
  tokenCount: number; // Approximate tokens generated
  tokensPerSec: number; // tokens/second throughput (includes TTFT)
  genThroughput: number; // tokens/second after first token (excludes TTFT)
  outputPreview: string; // First 300 chars of output
  error?: string;
  timestamp: number;
}

const LLM_PROMPTS = {
  short: "What is the meaning of a good life? Answer in 2-3 sentences.",
  medium: "Explain the concept of eudaimonia as Aristotle understood it, and how it differs from modern conceptions of happiness. Respond in about 150 words.",
  long: "You are Marcus Aurelius. A young person asks you: 'How do I find purpose when everything feels meaningless?' Respond as Marcus Aurelius would, drawing on Stoic philosophy, in about 300 words.",
  german_short: "Was ist der Sinn eines guten Lebens? Antworte in 2-3 Sätzen auf Deutsch.",
  german_medium: "Erkläre das Konzept der Eudaimonia, wie Aristoteles es verstand, und wie es sich von modernen Vorstellungen von Glück unterscheidet. Antworte in etwa 150 Wörtern auf Deutsch.",
};

const DEFAULT_LLM_PROVIDERS: Record<string, LLMProviderConfig> = {
  nebius: {
    id: 'nebius',
    name: 'Nebius (EU)',
    endpoint: 'https://api.tokenfactory.nebius.com/v1/chat/completions',
    model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    apiKey: '',
  },
  custom_llm: {
    id: 'custom_llm',
    name: 'Custom',
    endpoint: '',
    model: '',
    apiKey: '',
  },
};

// ============================================
// LLM Streaming Call
// ============================================

interface StreamToken {
  content: string;
  timestamp: number; // ms since request start
  index: number;
}

async function callLLMStreamingLive(
  provider: LLMProviderConfig,
  prompt: string,
  onToken: (token: StreamToken) => void,
  signal?: AbortSignal,
): Promise<LLMResult> {
  const startTime = performance.now();
  let ttft = 0;
  let tokenCount = 0;
  let output = '';
  let tokenIndex = 0;

  if (!provider.endpoint) {
    return {
      provider: provider.name, model: provider.model,
      ttft: 0, totalTime: 0, tokenCount: 0, tokensPerSec: 0, genThroughput: 0,
      outputPreview: '', error: 'No endpoint configured', timestamp: Date.now(),
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST', headers, signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: 'You are a wise philosopher. Respond thoughtfully and concisely.' },
          { role: 'user', content: prompt },
        ],
        stream: true, temperature: 0.7, max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        provider: provider.name, model: provider.model,
        ttft: performance.now() - startTime, totalTime: performance.now() - startTime,
        tokenCount: 0, tokensPerSec: 0, genThroughput: 0, outputPreview: '',
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`, timestamp: Date.now(),
      };
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            const now = performance.now() - startTime;
            if (ttft === 0) ttft = now;
            output += content;
            tokenCount = Math.ceil(output.length / 4);
            onToken({ content, timestamp: now, index: tokenIndex++ });
          }
        } catch { /* skip */ }
      }
    }

    const totalTime = performance.now() - startTime;
    const tokensPerSec = tokenCount > 0 ? tokenCount / (totalTime / 1000) : 0;
    const genTime = totalTime - ttft;
    const genThroughput = tokenCount > 0 && genTime > 0 ? tokenCount / (genTime / 1000) : 0;

    return {
      provider: provider.name, model: provider.model,
      ttft, totalTime, tokenCount, tokensPerSec, genThroughput,
      outputPreview: output.slice(0, 300), timestamp: Date.now(),
    };
  } catch (err) {
    if (signal?.aborted) {
      return {
        provider: provider.name, model: provider.model,
        ttft, totalTime: performance.now() - startTime,
        tokenCount, tokensPerSec: 0, genThroughput: 0, outputPreview: output.slice(0, 300),
        error: 'Cancelled', timestamp: Date.now(),
      };
    }
    return {
      provider: provider.name, model: provider.model,
      ttft: 0, totalTime: performance.now() - startTime,
      tokenCount: 0, tokensPerSec: 0, genThroughput: 0, outputPreview: '',
      error: err instanceof Error ? err.message : String(err), timestamp: Date.now(),
    };
  }
}

async function callLLMStreaming(
  provider: LLMProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<LLMResult> {
  const startTime = performance.now();
  let ttft = 0;
  let tokenCount = 0;
  let output = '';

  if (!provider.endpoint) {
    return {
      provider: provider.name, model: provider.model,
      ttft: 0, totalTime: 0, tokenCount: 0, tokensPerSec: 0, genThroughput: 0,
      outputPreview: '', error: 'No endpoint configured', timestamp: Date.now(),
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: 'You are a wise philosopher. Respond thoughtfully and concisely.' },
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        provider: provider.name, model: provider.model,
        ttft: performance.now() - startTime, totalTime: performance.now() - startTime,
        tokenCount: 0, tokensPerSec: 0, genThroughput: 0, outputPreview: '',
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
        timestamp: Date.now(),
      };
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            if (ttft === 0) ttft = performance.now() - startTime;
            output += content;
            // Rough token estimate: ~4 chars per token
            tokenCount = Math.ceil(output.length / 4);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    const totalTime = performance.now() - startTime;
    const tokensPerSec = tokenCount > 0 ? tokenCount / (totalTime / 1000) : 0;
    const genTime = totalTime - ttft;
    const genThroughput = tokenCount > 0 && genTime > 0 ? tokenCount / (genTime / 1000) : 0;

    return {
      provider: provider.name,
      model: provider.model,
      ttft,
      totalTime,
      tokenCount,
      tokensPerSec,
      genThroughput,
      outputPreview: output.slice(0, 300),
      timestamp: Date.now(),
    };
  } catch (err) {
    if (signal?.aborted) {
      return {
        provider: provider.name, model: provider.model,
        ttft, totalTime: performance.now() - startTime,
        tokenCount, tokensPerSec: 0, genThroughput: 0, outputPreview: output.slice(0, 300),
        error: 'Cancelled', timestamp: Date.now(),
      };
    }
    return {
      provider: provider.name, model: provider.model,
      ttft: 0, totalTime: performance.now() - startTime,
      tokenCount: 0, tokensPerSec: 0, genThroughput: 0, outputPreview: '',
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
  }
}

// ============================================
// Components
// ============================================

const styles = {
  page: {
    padding: '32px',
    maxWidth: '1100px',
    margin: '0 auto',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'var(--text-primary, #e0e0e0)',
  } as React.CSSProperties,
  h1: {
    color: 'var(--gold-base, #D4A539)',
    fontSize: '28px',
    marginBottom: '8px',
  } as React.CSSProperties,
  subtitle: {
    color: 'var(--text-secondary, #999)',
    fontSize: '14px',
    marginBottom: '32px',
  } as React.CSSProperties,
  section: {
    marginBottom: '28px',
    padding: '20px',
    background: 'color-mix(in srgb, var(--bg-secondary, #1a1a2e) 80%, transparent)',
    borderRadius: '12px',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 20%, transparent)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: 'var(--gold-subtle, #B8962E)',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  col: {
    flex: '1 1 300px',
    minWidth: '300px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px',
    color: 'var(--text-secondary, #999)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 30%, transparent)',
    background: 'var(--bg-primary, #0f0f1a)',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '14px',
    marginBottom: '12px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 30%, transparent)',
    background: 'var(--bg-primary, #0f0f1a)',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '14px',
    marginBottom: '12px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 30%, transparent)',
    background: 'var(--bg-primary, #0f0f1a)',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: '80px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  btn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  btnPrimary: {
    background: 'var(--gold-base, #D4A539)',
    color: '#000',
  } as React.CSSProperties,
  btnSecondary: {
    background: 'color-mix(in srgb, var(--gold-subtle, #B8962E) 20%, transparent)',
    color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 40%, transparent)',
  } as React.CSSProperties,
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr 1fr',
    gap: '4px 16px',
    fontSize: '14px',
  } as React.CSSProperties,
  resultLabel: {
    color: 'var(--text-secondary, #999)',
    fontWeight: 500,
  } as React.CSSProperties,
  resultValue: {
    fontFamily: 'monospace',
    fontWeight: 600,
  } as React.CSSProperties,
  good: { color: '#4ade80' } as React.CSSProperties,
  ok: { color: '#fbbf24' } as React.CSSProperties,
  bad: { color: '#f87171' } as React.CSSProperties,
  error: {
    color: '#f87171',
    padding: '12px',
    background: 'color-mix(in srgb, #f87171 10%, transparent)',
    borderRadius: '8px',
    fontSize: '13px',
  } as React.CSSProperties,
  presetRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  presetBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 30%, transparent)',
    background: 'transparent',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '13px',
    cursor: 'pointer',
  } as React.CSSProperties,
  presetActive: {
    background: 'color-mix(in srgb, var(--gold-base, #D4A539) 25%, transparent)',
    borderColor: 'var(--gold-base, #D4A539)',
  } as React.CSSProperties,
  charCount: {
    fontSize: '12px',
    color: 'var(--text-secondary, #999)',
    marginTop: '4px',
  } as React.CSSProperties,
  batchBar: {
    height: '24px',
    borderRadius: '4px',
    marginBottom: '4px',
    transition: 'width 0.3s',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '6px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#000',
    fontWeight: 600,
  } as React.CSSProperties,
  audioPlayer: {
    width: '100%',
    height: '36px',
    marginTop: '8px',
    borderRadius: '8px',
  } as React.CSSProperties,
  streamRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    padding: '4px 0',
    borderBottom: '1px solid color-mix(in srgb, var(--text-secondary, #999) 15%, transparent)',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
  } as React.CSSProperties,
};

function ProviderPanel({
  label,
  config,
  onChange,
}: {
  label: string;
  config: ProviderConfig;
  onChange: (c: ProviderConfig) => void;
}) {
  const voiceOptions = config.id === 'openai'
    ? PRESET_VOICES.openai
    : config.id === 'custom'
      ? []
      : config.id === 'chatterbox' || config.id === 'chatterbox_turbo'
        ? PRESET_VOICES.chatterbox
        : PRESET_VOICES.kokoro;

  return (
    <div style={styles.col}>
      <div style={styles.label}>{label}</div>

      {/* Provider preset */}
      <select
        style={styles.select}
        value={config.id}
        onChange={(e) => {
          const preset = DEFAULT_PROVIDERS[e.target.value];
          if (preset) onChange({ ...preset });
        }}
      >
        <option value="kokoro">Kokoro (DeepInfra) — EN</option>
        <option value="chatterbox">Chatterbox Multi (DeepInfra) — DE/EN</option>
        <option value="chatterbox_turbo">Chatterbox Turbo (DeepInfra) — EN</option>
        <option value="openai">OpenAI tts-1 — DE/EN</option>
        <option value="custom">Custom Endpoint</option>
      </select>

      {/* Endpoint URL */}
      <div style={styles.label}>Endpoint</div>
      <input
        style={styles.input}
        type="text"
        value={config.endpoint}
        onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
        placeholder="https://api.example.com/v1/audio/speech"
      />

      {/* Model */}
      <div style={styles.label}>Model</div>
      <input
        style={styles.input}
        type="text"
        value={config.model}
        onChange={(e) => onChange({ ...config, model: e.target.value })}
        placeholder="model-name"
      />

      {/* Voice */}
      <div style={styles.label}>Voice</div>
      {config.id === 'custom' ? (
        <input
          style={styles.input}
          type="text"
          value={config.voice}
          onChange={(e) => onChange({ ...config, voice: e.target.value })}
          placeholder="voice-id"
        />
      ) : (
        <select
          style={styles.select}
          value={config.voice}
          onChange={(e) => onChange({ ...config, voice: e.target.value })}
        >
          {voiceOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )}

      {/* Language (for multilingual models) */}
      {config.id === 'chatterbox' && (
        <>
          <div style={styles.label}>Language</div>
          <select
            style={styles.select}
            value={config.language || 'en'}
            onChange={(e) => onChange({ ...config, language: e.target.value })}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="it">Italiano</option>
            <option value="nl">Nederlands</option>
            <option value="pt">Português</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
            <option value="ar">العربية</option>
            <option value="hi">हिन्दी</option>
            <option value="pl">Polski</option>
            <option value="ru">Русский</option>
            <option value="sv">Svenska</option>
            <option value="da">Dansk</option>
            <option value="fi">Suomi</option>
            <option value="no">Norsk</option>
            <option value="el">Ελληνικά</option>
            <option value="he">עברית</option>
            <option value="ms">Melayu</option>
            <option value="sw">Kiswahili</option>
            <option value="tr">Türkçe</option>
          </select>
        </>
      )}

      {/* Speed */}
      <div style={styles.label}>Speed: {config.speed.toFixed(1)}</div>
      <input
        type="range"
        min="0.8"
        max="1.3"
        step="0.1"
        value={config.speed}
        onChange={(e) => onChange({ ...config, speed: parseFloat(e.target.value) })}
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {/* API Key (for custom) */}
      {config.apiKeySource === 'custom' && (
        <>
          <div style={styles.label}>API Key (optional)</div>
          <input
            style={styles.input}
            type="password"
            value={config.customApiKey}
            onChange={(e) => onChange({ ...config, customApiKey: e.target.value })}
            placeholder="Bearer token (leave empty if no auth)"
          />
        </>
      )}

      {/* Key source indicator */}
      {config.apiKeySource !== 'custom' && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #999)', opacity: 0.7 }}>
          Using {config.apiKeySource} key from Settings
        </div>
      )}
    </div>
  );
}

function latencyColor(ms: number): React.CSSProperties {
  if (ms < 500) return styles.good;
  if (ms < 1500) return styles.ok;
  return styles.bad;
}

function rtColor(rt: number): React.CSSProperties {
  if (rt > 5) return styles.good;
  if (rt > 1) return styles.ok;
  return styles.bad;
}

function ResultPanel({ result, label }: { result: TestResult | null; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  if (!result) {
    return (
      <div style={styles.col}>
        <div style={styles.label}>{label}</div>
        <div style={{ color: 'var(--text-secondary, #999)', fontSize: '14px' }}>No result yet</div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div style={styles.col}>
        <div style={styles.label}>{label}</div>
        <div style={styles.error}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={styles.col}>
      <div style={styles.label}>{label} — {result.provider}</div>
      <div style={styles.resultGrid}>
        <span style={styles.resultLabel}>TTFB</span>
        <span style={{ ...styles.resultValue, ...latencyColor(result.ttfb) }}>
          {result.ttfb.toFixed(0)}ms
        </span>
        <span />

        <span style={styles.resultLabel}>Total Time</span>
        <span style={{ ...styles.resultValue, ...latencyColor(result.totalTime) }}>
          {result.totalTime.toFixed(0)}ms
        </span>
        <span />

        <span style={styles.resultLabel}>Audio Duration</span>
        <span style={styles.resultValue}>
          {result.audioDuration.toFixed(2)}s
        </span>
        <span />

        <span style={styles.resultLabel}>RT Factor</span>
        <span style={{ ...styles.resultValue, ...rtColor(result.rtFactor) }}>
          {result.rtFactor.toFixed(1)}x
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary, #999)' }}>
          ({result.rtFactor > 1 ? 'faster' : 'slower'} than realtime)
        </span>

        <span style={styles.resultLabel}>Size</span>
        <span style={styles.resultValue}>
          {(result.audioSize / 1024).toFixed(1)} KB
        </span>
        <span />

        <span style={styles.resultLabel}>Chars</span>
        <span style={styles.resultValue}>{result.textLength}</span>
        <span />
      </div>

      {result.audioUrl && (
        <audio
          ref={audioRef}
          src={result.audioUrl}
          controls
          style={styles.audioPlayer}
        />
      )}
    </div>
  );
}

function BatchStatsPanel({ stats, results, label }: {
  stats: BatchStats | null;
  results: TestResult[];
  label: string;
}) {
  if (!stats) return null;

  const maxTime = Math.max(...results.map(r => r.totalTime), 1);

  return (
    <div>
      <div style={{ ...styles.label, marginBottom: '12px' }}>{label} — {stats.count} runs</div>

      <div style={{ ...styles.resultGrid, marginBottom: '16px' }}>
        <span style={styles.resultLabel}></span>
        <span style={{ ...styles.resultLabel, fontWeight: 700 }}>TTFB</span>
        <span style={{ ...styles.resultLabel, fontWeight: 700 }}>Total</span>

        <span style={styles.resultLabel}>Min</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.ttfb.min) }}>{stats.ttfb.min.toFixed(0)}ms</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.totalTime.min) }}>{stats.totalTime.min.toFixed(0)}ms</span>

        <span style={styles.resultLabel}>Avg</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.ttfb.avg) }}>{stats.ttfb.avg.toFixed(0)}ms</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.totalTime.avg) }}>{stats.totalTime.avg.toFixed(0)}ms</span>

        <span style={styles.resultLabel}>P95</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.ttfb.p95) }}>{stats.ttfb.p95.toFixed(0)}ms</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.totalTime.p95) }}>{stats.totalTime.p95.toFixed(0)}ms</span>

        <span style={styles.resultLabel}>Max</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.ttfb.max) }}>{stats.ttfb.max.toFixed(0)}ms</span>
        <span style={{ ...styles.resultValue, ...latencyColor(stats.totalTime.max) }}>{stats.totalTime.max.toFixed(0)}ms</span>

        <span style={styles.resultLabel}>RT Factor</span>
        <span style={{ ...styles.resultValue, ...rtColor(stats.rtFactor.avg) }}>
          {stats.rtFactor.min.toFixed(1)}x — {stats.rtFactor.max.toFixed(1)}x (avg {stats.rtFactor.avg.toFixed(1)}x)
        </span>
        <span />
      </div>

      {/* Visual bar chart */}
      <div style={styles.label}>Latency per run</div>
      {results.map((r, i) => (
        <div
          key={i}
          style={{
            ...styles.batchBar,
            width: `${Math.max((r.totalTime / maxTime) * 100, 5)}%`,
            background: r.error
              ? '#f87171'
              : r.totalTime < 500 ? '#4ade80'
                : r.totalTime < 1500 ? '#fbbf24'
                  : '#f87171',
          }}
        >
          {r.totalTime.toFixed(0)}ms
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export const TTSBench: React.FC = () => {
  // Provider configs
  const [providerA, setProviderA] = useState<ProviderConfig>({ ...DEFAULT_PROVIDERS.kokoro });
  const [providerB, setProviderB] = useState<ProviderConfig>({ ...DEFAULT_PROVIDERS.chatterbox });

  // Text
  const [text, setText] = useState(SAMPLE_TEXTS.short_en);
  const [activePreset, setActivePreset] = useState('short_en');

  // Results
  const [resultA, setResultA] = useState<TestResult | null>(null);
  const [resultB, setResultB] = useState<TestResult | null>(null);
  const [batchResultsA, setBatchResultsA] = useState<TestResult[]>([]);
  const [batchResultsB, setBatchResultsB] = useState<TestResult[]>([]);
  const [batchStatsA, setBatchStatsA] = useState<BatchStats | null>(null);
  const [batchStatsB, setBatchStatsB] = useState<BatchStats | null>(null);

  // Streaming sim
  const [streamResults, setStreamResults] = useState<StreamingResult[]>([]);
  const [streamChunkSize, setStreamChunkSize] = useState(100);
  const [streamInterval, setStreamInterval] = useState(300);

  // LLM state (Nebius-dedicated)
  const [llmProvider, setLlmProvider] = useState<LLMProviderConfig>({ ...DEFAULT_LLM_PROVIDERS.nebius });
  const [llmPrompt, setLlmPrompt] = useState(LLM_PROMPTS.short);
  const [llmPreset, setLlmPreset] = useState('short');
  const [llmResult, setLlmResult] = useState<LLMResult | null>(null);
  const [llmRunning, setLlmRunning] = useState(false);
  const [llmStatus, setLlmStatus] = useState('');
  const llmAbortRef = useRef<AbortController | null>(null);

  // LLM Concurrency test
  const [concurrencyLevel, setConcurrencyLevel] = useState(5);
  const [concurrencyResults, setConcurrencyResults] = useState<{ provider: string; level: number; results: LLMResult[]; avgTtft: number; avgGenSpeed: number; successRate: number; totalWallTime: number } | null>(null);

  // Per-request live streaming state for concurrency
  const [parallelStreams, setParallelStreams] = useState<ParallelStreamState[]>([]);
  const [parallelFirstTokens, setParallelFirstTokens] = useState(0); // count of requests that got first token
  const [parallelDone, setParallelDone] = useState(0);

  // Live stream state (single request)
  const [liveTokens, setLiveTokens] = useState<StreamToken[]>([]);
  const [liveResult, setLiveResult] = useState<LLMResult | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveStartRef = useRef<number>(0);

  // State
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [batchSize, setBatchSize] = useState(5);
  const cancelRef = useRef(false);

  // Make page scrollable — override viewport-browser-only.css locks
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const app = document.querySelector('.App') as HTMLElement | null;

    // Override all the overflow: hidden and fixed heights
    html.style.overflow = 'auto';
    html.style.height = 'auto';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    body.style.position = 'static'; // Safari fix: body { position: fixed }
    if (root) { root.style.overflow = 'auto'; root.style.height = 'auto'; }
    if (app) { app.style.overflow = 'visible'; app.style.height = 'auto'; app.style.display = 'block'; }

    return () => {
      html.style.overflow = '';
      html.style.height = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.position = '';
      if (root) { root.style.overflow = ''; root.style.height = ''; }
      if (app) { app.style.overflow = ''; app.style.height = ''; app.style.display = ''; }
    };
  }, []);

  // Cleanup live stream timer on unmount
  useEffect(() => {
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, []);

  // Cleanup audio URLs on unmount
  const audioUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      audioUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const trackAudioUrl = useCallback((result: TestResult) => {
    if (result.audioUrl) audioUrlsRef.current.push(result.audioUrl);
  }, []);

  // Preset text selection
  const selectPreset = useCallback((key: string) => {
    setActivePreset(key);
    setText(SAMPLE_TEXTS[key as keyof typeof SAMPLE_TEXTS] || '');
  }, []);

  // Single A/B test
  const runABTest = useCallback(async () => {
    if (!text.trim()) return;
    setRunning(true);
    cancelRef.current = false;
    setResultA(null);
    setResultB(null);
    setStatus('Running Provider A...');

    const rA = await callTTS(providerA, text);
    trackAudioUrl(rA);
    setResultA(rA);

    if (cancelRef.current) { setRunning(false); return; }

    setStatus('Running Provider B...');
    const rB = await callTTS(providerB, text);
    trackAudioUrl(rB);
    setResultB(rB);

    setStatus('Done');
    setRunning(false);
  }, [providerA, providerB, text, trackAudioUrl]);

  // Single provider test (just A)
  const runSingleTest = useCallback(async (which: 'A' | 'B') => {
    if (!text.trim()) return;
    setRunning(true);
    cancelRef.current = false;
    const provider = which === 'A' ? providerA : providerB;
    const setter = which === 'A' ? setResultA : setResultB;

    setStatus(`Running Provider ${which}...`);
    const result = await callTTS(provider, text);
    trackAudioUrl(result);
    setter(result);

    setStatus('Done');
    setRunning(false);
  }, [providerA, providerB, text, trackAudioUrl]);

  // Batch test
  const runBatch = useCallback(async () => {
    if (!text.trim()) return;
    setRunning(true);
    cancelRef.current = false;
    setBatchResultsA([]);
    setBatchResultsB([]);
    setBatchStatsA(null);
    setBatchStatsB(null);

    const resultsA: TestResult[] = [];
    const resultsB: TestResult[] = [];

    for (let i = 0; i < batchSize; i++) {
      if (cancelRef.current) break;

      setStatus(`Batch ${i + 1}/${batchSize} — Provider A...`);
      const rA = await callTTS(providerA, text);
      trackAudioUrl(rA);
      resultsA.push(rA);
      setBatchResultsA([...resultsA]);

      if (cancelRef.current) break;

      setStatus(`Batch ${i + 1}/${batchSize} — Provider B...`);
      const rB = await callTTS(providerB, text);
      trackAudioUrl(rB);
      resultsB.push(rB);
      setBatchResultsB([...resultsB]);
    }

    // Compute stats
    const validA = resultsA.filter(r => !r.error);
    const validB = resultsB.filter(r => !r.error);

    if (validA.length > 0) {
      setBatchStatsA({
        count: validA.length,
        ttfb: computeStats(validA.map(r => r.ttfb)),
        totalTime: computeStats(validA.map(r => r.totalTime)),
        rtFactor: {
          min: Math.min(...validA.map(r => r.rtFactor)),
          avg: validA.reduce((s, r) => s + r.rtFactor, 0) / validA.length,
          max: Math.max(...validA.map(r => r.rtFactor)),
        },
      });
    }

    if (validB.length > 0) {
      setBatchStatsB({
        count: validB.length,
        ttfb: computeStats(validB.map(r => r.ttfb)),
        totalTime: computeStats(validB.map(r => r.totalTime)),
        rtFactor: {
          min: Math.min(...validB.map(r => r.rtFactor)),
          avg: validB.reduce((s, r) => s + r.rtFactor, 0) / validB.length,
          max: Math.max(...validB.map(r => r.rtFactor)),
        },
      });
    }

    setStatus(`Batch complete — ${resultsA.length} runs`);
    setRunning(false);
  }, [providerA, providerB, text, batchSize, trackAudioUrl]);

  // Streaming simulation
  const runStreamingSim = useCallback(async () => {
    if (!text.trim()) return;
    setRunning(true);
    cancelRef.current = false;
    setStreamResults([]);

    // Split text into chunks
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += streamChunkSize) {
      chunks.push(text.slice(i, i + streamChunkSize));
    }

    setStatus(`Streaming sim: ${chunks.length} chunks, ${streamInterval}ms interval`);

    const results: StreamingResult[] = [];
    let cumulativeAudioDuration = 0;
    let cumulativeWallTime = 0;
    const simStart = performance.now();

    for (let i = 0; i < chunks.length; i++) {
      if (cancelRef.current) break;

      // Wait for interval (simulating LLM streaming)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, streamInterval));
      }

      const chunkStart = performance.now();
      const wallTimeSinceStart = chunkStart - simStart;
      const result = await callTTS(providerA, chunks[i]);
      trackAudioUrl(result);
      const chunkEnd = performance.now();
      const latency = chunkEnd - chunkStart;

      cumulativeWallTime = chunkEnd - simStart;
      cumulativeAudioDuration += result.audioDuration;

      // Buffer underrun: is the total audio produced less than the wall time elapsed?
      // This means the player would have run out of audio to play
      const bufferUnderrun = i > 0 && cumulativeAudioDuration < (cumulativeWallTime / 1000);

      const streamResult: StreamingResult = {
        chunkIndex: i,
        textLength: chunks[i].length,
        requestTime: wallTimeSinceStart,
        responseTime: cumulativeWallTime,
        latency,
        audioDuration: result.audioDuration,
        bufferUnderrun,
      };

      results.push(streamResult);
      setStreamResults([...results]);
      setStatus(`Chunk ${i + 1}/${chunks.length} — ${latency.toFixed(0)}ms${bufferUnderrun ? ' (UNDERRUN)' : ''}`);
    }

    const underruns = results.filter(r => r.bufferUnderrun).length;
    const avgLatency = results.reduce((s, r) => s + r.latency, 0) / results.length;
    setStatus(`Streaming sim done — ${underruns} underruns, avg ${avgLatency.toFixed(0)}ms/chunk`);
    setRunning(false);
  }, [providerA, text, streamChunkSize, streamInterval, trackAudioUrl]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setStatus('Cancelling...');
  }, []);

  // ---- LLM Test Functions (Nebius-dedicated) ----

  const runLLMTest = useCallback(async () => {
    if (!llmPrompt.trim() || !llmProvider.endpoint) return;
    setLlmRunning(true);
    setLlmResult(null);

    const abort = new AbortController();
    llmAbortRef.current = abort;
    setLlmStatus(`Running ${llmProvider.name}...`);
    const result = await callLLMStreaming(llmProvider, llmPrompt, abort.signal);
    setLlmResult(result);

    setLlmStatus('Done');
    setLlmRunning(false);
  }, [llmProvider, llmPrompt]);

  const cancelLLM = useCallback(() => {
    llmAbortRef.current?.abort();
    setLlmStatus('Cancelled');
    setLlmRunning(false);
  }, []);

  const runLiveStream = useCallback(async () => {
    if (!llmPrompt.trim() || !llmProvider.endpoint) return;
    setLlmRunning(true);
    setLiveTokens([]);
    setLiveResult(null);
    setLiveElapsed(0);

    const abort = new AbortController();
    llmAbortRef.current = abort;
    liveStartRef.current = performance.now();

    // Start elapsed timer (updates every 50ms for smooth display)
    liveTimerRef.current = setInterval(() => {
      setLiveElapsed(performance.now() - liveStartRef.current);
    }, 50);

    setLlmStatus(`Live streaming from ${llmProvider.name}...`);

    const result = await callLLMStreamingLive(
      llmProvider,
      llmPrompt,
      (token) => {
        setLiveTokens(prev => [...prev, token]);
      },
      abort.signal,
    );

    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveElapsed(result.totalTime);
    setLiveResult(result);
    setLlmStatus('Done');
    setLlmRunning(false);
  }, [llmProvider, llmPrompt]);

  const runConcurrencyTest = useCallback(async () => {
    if (!llmPrompt.trim() || !llmProvider.endpoint) return;
    setLlmRunning(true);
    setConcurrencyResults(null);

    // Initialize parallel stream state
    const initialStreams: ParallelStreamState[] = Array.from({ length: concurrencyLevel }, () => ({
      ttft: 0, tokenCount: 0, done: false, genSpeed: 0, totalTime: 0, lastContent: '',
    }));
    setParallelStreams(initialStreams);
    setParallelFirstTokens(0);
    setParallelDone(0);

    const abort = new AbortController();
    llmAbortRef.current = abort;
    liveStartRef.current = performance.now();

    // Start elapsed timer
    liveTimerRef.current = setInterval(() => {
      setLiveElapsed(performance.now() - liveStartRef.current);
    }, 50);

    setLlmStatus(`Concurrency test: ${concurrencyLevel} parallel requests to ${llmProvider.name}...`);
    const wallStart = performance.now();

    // Mutable trackers (avoid stale closures with setState)
    let firstTokenCount = 0;
    let doneCount = 0;

    // Fire all requests in parallel with live streaming
    const promises = Array.from({ length: concurrencyLevel }, (_, i) => {
      const variedPrompt = llmPrompt + ` (request ${i + 1})`;
      let gotFirstToken = false;

      return callLLMStreamingLive(
        llmProvider,
        variedPrompt,
        (token) => {
          if (!gotFirstToken) {
            gotFirstToken = true;
            firstTokenCount++;
            setParallelFirstTokens(firstTokenCount);
          }
          setParallelStreams(prev => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              ttft: next[i].ttft === 0 ? token.timestamp : next[i].ttft,
              tokenCount: token.index + 1,
              lastContent: token.content,
            };
            return next;
          });
        },
        abort.signal,
      ).then(result => {
        doneCount++;
        setParallelDone(doneCount);
        setParallelStreams(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            done: true,
            genSpeed: result.genThroughput,
            totalTime: result.totalTime,
            error: result.error,
          };
          return next;
        });
        return result;
      });
    });

    const results = await Promise.all(promises);
    const wallTime = performance.now() - wallStart;

    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveElapsed(wallTime);

    const successful = results.filter(r => !r.error);
    const avgTtft = successful.length > 0
      ? successful.reduce((s, r) => s + r.ttft, 0) / successful.length : 0;
    const avgGenSpeed = successful.length > 0
      ? successful.reduce((s, r) => s + r.genThroughput, 0) / successful.length : 0;

    setConcurrencyResults({
      provider: llmProvider.name,
      level: concurrencyLevel,
      results,
      avgTtft,
      avgGenSpeed,
      successRate: successful.length / results.length * 100,
      totalWallTime: wallTime,
    });

    setLlmStatus(`Concurrency test done — ${successful.length}/${results.length} succeeded in ${(wallTime / 1000).toFixed(1)}s`);
    setLlmRunning(false);
  }, [llmProvider, llmPrompt, concurrencyLevel]);

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Pipeline Benchmark</h1>
      <p style={styles.subtitle}>
        LLM + TTS A/B testing — Nebius EU (LLM) — Kokoro vs Chatterbox (TTS)
      </p>

      {/* Provider Configuration */}
      <div style={{ ...styles.section, borderColor: 'color-mix(in srgb, var(--gold-base, #D4A539) 40%, transparent)' }}>
        <div style={{ ...styles.sectionTitle, fontSize: '22px', marginBottom: '20px' }}>
          TTS Benchmark — Kokoro vs Chatterbox
        </div>
        <div style={{ ...styles.sectionTitle, fontSize: '16px' }}>Providers</div>
        <div style={styles.row}>
          <ProviderPanel label="Provider A" config={providerA} onChange={setProviderA} />
          <ProviderPanel label="Provider B" config={providerB} onChange={setProviderB} />
        </div>
      </div>

      {/* Text Input */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Test Text</div>

        <div style={styles.presetRow}>
          {Object.entries(SAMPLE_TEXTS).map(([key]) => {
            const [length, lang] = key.split('_');
            return (
              <button
                key={key}
                style={{
                  ...styles.presetBtn,
                  ...(activePreset === key ? styles.presetActive : {}),
                }}
                onClick={() => selectPreset(key)}
              >
                {length.charAt(0).toUpperCase() + length.slice(1)} {lang.toUpperCase()}
              </button>
            );
          })}
        </div>

        <textarea
          style={styles.textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActivePreset('');
          }}
          rows={4}
        />
        <div style={styles.charCount}>
          {text.length} chars — est. ~{(text.length / 130).toFixed(1)}s audio at normal pace
        </div>
      </div>

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Tests</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{
              ...styles.btn, ...styles.btnPrimary,
              ...(running ? styles.btnDisabled : {}),
            }}
            onClick={runABTest}
            disabled={running}
          >
            Run A/B Test
          </button>

          <button
            style={{
              ...styles.btn, ...styles.btnSecondary,
              ...(running ? styles.btnDisabled : {}),
            }}
            onClick={() => runSingleTest('A')}
            disabled={running}
          >
            Test A Only
          </button>

          <button
            style={{
              ...styles.btn, ...styles.btnSecondary,
              ...(running ? styles.btnDisabled : {}),
            }}
            onClick={() => runSingleTest('B')}
            disabled={running}
          >
            Test B Only
          </button>

          <span style={{ color: 'var(--text-secondary, #999)', fontSize: '13px' }}>|</span>

          <button
            style={{
              ...styles.btn, ...styles.btnPrimary,
              ...(running ? styles.btnDisabled : {}),
            }}
            onClick={runBatch}
            disabled={running}
          >
            Batch ({batchSize}x)
          </button>

          <select
            style={{ ...styles.select, width: '80px', marginBottom: 0 }}
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value))}
          >
            {[3, 5, 10, 20].map(n => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>

          <span style={{ color: 'var(--text-secondary, #999)', fontSize: '13px' }}>|</span>

          <button
            style={{
              ...styles.btn, ...styles.btnSecondary,
              ...(running ? styles.btnDisabled : {}),
            }}
            onClick={runStreamingSim}
            disabled={running}
          >
            Streaming Sim
          </button>

          {running && (
            <button
              style={{ ...styles.btn, ...styles.bad }}
              onClick={cancel}
            >
              Cancel
            </button>
          )}
        </div>

        {status && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary, #999)' }}>
            {status}
          </div>
        )}
      </div>

      {/* A/B Results */}
      {(resultA || resultB) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>A/B Results</div>
          <div style={styles.row}>
            <ResultPanel result={resultA} label="Provider A" />
            <ResultPanel result={resultB} label="Provider B" />
          </div>

          {/* Quick comparison */}
          {resultA && resultB && !resultA.error && !resultB.error && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'color-mix(in srgb, var(--gold-base, #D4A539) 8%, transparent)',
              borderRadius: '8px',
              fontSize: '14px',
            }}>
              <strong>Comparison:</strong>{' '}
              {resultA.totalTime < resultB.totalTime ? (
                <span>A is <strong style={styles.good}>
                  {((resultB.totalTime / resultA.totalTime - 1) * 100).toFixed(0)}% faster
                </strong></span>
              ) : (
                <span>B is <strong style={styles.good}>
                  {((resultA.totalTime / resultB.totalTime - 1) * 100).toFixed(0)}% faster
                </strong></span>
              )}
              {' | '}
              TTFB: A={resultA.ttfb.toFixed(0)}ms vs B={resultB.ttfb.toFixed(0)}ms
              {' | '}
              RT: A={resultA.rtFactor.toFixed(1)}x vs B={resultB.rtFactor.toFixed(1)}x
            </div>
          )}
        </div>
      )}

      {/* Batch Results */}
      {(batchStatsA || batchStatsB) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Batch Results</div>
          <div style={styles.row}>
            <div style={styles.col}>
              <BatchStatsPanel stats={batchStatsA} results={batchResultsA} label="Provider A" />
            </div>
            <div style={styles.col}>
              <BatchStatsPanel stats={batchStatsB} results={batchResultsB} label="Provider B" />
            </div>
          </div>
        </div>
      )}

      {/* Streaming Simulation */}
      {streamResults.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Streaming Simulation</div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={styles.label}>Chunk Size</div>
              <select
                style={{ ...styles.select, width: '120px' }}
                value={streamChunkSize}
                onChange={(e) => setStreamChunkSize(parseInt(e.target.value))}
              >
                {[50, 100, 150, 200, 300].map(n => (
                  <option key={n} value={n}>{n} chars</option>
                ))}
              </select>
            </div>
            <div>
              <div style={styles.label}>Interval (LLM speed)</div>
              <select
                style={{ ...styles.select, width: '120px' }}
                value={streamInterval}
                onChange={(e) => setStreamInterval(parseInt(e.target.value))}
              >
                {[100, 200, 300, 500, 800].map(n => (
                  <option key={n} value={n}>{n}ms</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: streamResults.some(r => r.bufferUnderrun)
              ? 'color-mix(in srgb, #f87171 15%, transparent)'
              : 'color-mix(in srgb, #4ade80 15%, transparent)',
            fontSize: '14px',
          }}>
            <strong>Underruns:</strong> {streamResults.filter(r => r.bufferUnderrun).length} / {streamResults.length}
            {' | '}
            <strong>Avg latency:</strong>{' '}
            {(streamResults.reduce((s, r) => s + r.latency, 0) / streamResults.length).toFixed(0)}ms
            {' | '}
            <strong>Verdict:</strong>{' '}
            {streamResults.some(r => r.bufferUnderrun)
              ? 'Too slow for streaming — gaps in playback'
              : 'Fast enough for streaming'}
          </div>

          {/* Per-chunk results */}
          {streamResults.map((r) => (
            <div key={r.chunkIndex} style={styles.streamRow}>
              <span style={{ width: '30px', color: 'var(--text-secondary, #999)' }}>#{r.chunkIndex + 1}</span>
              <span style={{ width: '80px' }}>{r.latency.toFixed(0)}ms</span>
              <span style={{ width: '60px' }}>{r.audioDuration.toFixed(2)}s</span>
              {r.bufferUnderrun && (
                <span style={{ ...styles.badge, background: '#f87171', color: '#000' }}>
                  UNDERRUN
                </span>
              )}
              {/* Visual bar */}
              <div style={{ flex: 1, height: '16px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((r.latency / 2000) * 100, 100)}%`,
                  background: r.bufferUnderrun ? '#f87171' : r.latency < 500 ? '#4ade80' : '#fbbf24',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* LLM BENCHMARK SECTION                       */}
      {/* ============================================ */}

      <div style={{ ...styles.section, borderColor: 'color-mix(in srgb, var(--gold-base, #D4A539) 40%, transparent)' }}>
        <div style={{ ...styles.sectionTitle, fontSize: '22px', marginBottom: '20px' }}>
          LLM Benchmark — Nebius (EU)
        </div>

        {/* Nebius Provider Config */}
        <div style={{ maxWidth: '500px' }}>
          <div style={styles.label}>Provider</div>
          <select
            style={styles.select}
            value={llmProvider.id}
            onChange={(e) => {
              const preset = DEFAULT_LLM_PROVIDERS[e.target.value];
              if (preset) setLlmProvider({ ...preset });
            }}
          >
            <option value="nebius">Nebius (EU) — Token Factory</option>
            <option value="custom_llm">Custom Endpoint</option>
          </select>
          <div style={styles.row}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={styles.label}>Endpoint</div>
              <input style={styles.input} value={llmProvider.endpoint}
                onChange={(e) => setLlmProvider(p => ({ ...p, endpoint: e.target.value }))} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={styles.label}>Model</div>
              <input style={styles.input} value={llmProvider.model}
                onChange={(e) => setLlmProvider(p => ({ ...p, model: e.target.value }))} />
            </div>
          </div>
          <div style={styles.label}>API Key</div>
          <input style={styles.input} type="password" value={llmProvider.apiKey}
            onChange={(e) => setLlmProvider(p => ({ ...p, apiKey: e.target.value }))}
            placeholder="Nebius API key (from .env)" />
          {llmProvider.apiKey && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #999)', opacity: 0.7 }}>
              Key loaded ({llmProvider.apiKey.slice(0, 12)}...)
            </div>
          )}
        </div>

        {/* LLM Prompt */}
        <div style={{ marginTop: '16px' }}>
          <div style={styles.label}>Prompt</div>
          <div style={styles.presetRow}>
            {Object.entries(LLM_PROMPTS).map(([key]) => (
              <button
                key={key}
                style={{
                  ...styles.presetBtn,
                  ...(llmPreset === key ? styles.presetActive : {}),
                }}
                onClick={() => { setLlmPreset(key); setLlmPrompt(LLM_PROMPTS[key as keyof typeof LLM_PROMPTS]); }}
              >
                {key.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <textarea
            style={styles.textarea}
            value={llmPrompt}
            onChange={(e) => { setLlmPrompt(e.target.value); setLlmPreset(''); }}
            rows={3}
          />
        </div>

        {/* LLM Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary, ...(llmRunning ? styles.btnDisabled : {}) }}
            onClick={runLLMTest}
            disabled={llmRunning}
          >
            Run Test
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary, ...(llmRunning ? styles.btnDisabled : {}), background: 'color-mix(in srgb, #4ade80 80%, transparent)', color: '#000' }}
            onClick={runLiveStream}
            disabled={llmRunning}
          >
            Live Stream
          </button>
          {llmRunning && (
            <button style={{ ...styles.btn, ...styles.bad }} onClick={cancelLLM}>Cancel</button>
          )}
          {llmStatus && (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary, #999)' }}>{llmStatus}</span>
          )}
        </div>

        {/* LLM Result */}
        {llmResult && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ maxWidth: '500px' }}>
              <div style={styles.label}>{llmResult.provider} — {llmResult.model}</div>
              {llmResult.error ? (
                <div style={styles.error}>{llmResult.error}</div>
              ) : (
                <div style={styles.resultGrid}>
                  <span style={styles.resultLabel}>TTFT</span>
                  <span style={{ ...styles.resultValue, ...latencyColor(llmResult.ttft) }}>{llmResult.ttft.toFixed(0)}ms</span>
                  <span />
                  <span style={styles.resultLabel}>Total Time</span>
                  <span style={styles.resultValue}>{(llmResult.totalTime / 1000).toFixed(2)}s</span>
                  <span />
                  <span style={styles.resultLabel}>Tokens</span>
                  <span style={styles.resultValue}>~{llmResult.tokenCount}</span>
                  <span />
                  <span style={styles.resultLabel}>Overall</span>
                  <span style={styles.resultValue}>
                    {llmResult.tokensPerSec.toFixed(1)} tok/s
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #999)' }}>incl. TTFT</span>
                  <span style={styles.resultLabel}>Gen Speed</span>
                  <span style={{ ...styles.resultValue, ...(llmResult.genThroughput > 50 ? styles.good : llmResult.genThroughput > 20 ? styles.ok : styles.bad) }}>
                    {llmResult.genThroughput.toFixed(1)} tok/s
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #999)' }}>after TTFT</span>
                </div>
              )}
              {llmResult.outputPreview && (
                <div style={{
                  marginTop: '8px', padding: '10px', borderRadius: '8px', fontSize: '12px',
                  background: 'color-mix(in srgb, var(--bg-primary, #0f0f1a) 80%, transparent)',
                  maxHeight: '120px', overflow: 'auto', lineHeight: 1.5,
                  color: 'var(--text-secondary, #999)',
                }}>
                  {llmResult.outputPreview}{llmResult.outputPreview.length >= 300 ? '...' : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Stream Visualization */}
        {(liveTokens.length > 0 || (llmRunning && liveStartRef.current > 0)) && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 20%, transparent)' }}>
            <div style={{ ...styles.sectionTitle, fontSize: '16px' }}>Live Token Stream</div>

            {/* Timer + TTFT indicator */}
            <div style={{
              display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '12px',
              padding: '10px 16px', borderRadius: '8px',
              background: 'color-mix(in srgb, var(--bg-primary, #0f0f1a) 80%, transparent)',
              fontFamily: 'monospace', fontSize: '14px',
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary, #999)' }}>Elapsed: </span>
                <span style={{ fontWeight: 700 }}>{(liveElapsed / 1000).toFixed(2)}s</span>
              </div>
              {liveTokens.length > 0 && (
                <>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #999)' }}>TTFT: </span>
                    <span style={{ fontWeight: 700, ...latencyColor(liveTokens[0].timestamp) }}>
                      {liveTokens[0].timestamp.toFixed(0)}ms
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #999)' }}>Tokens: </span>
                    <span style={{ fontWeight: 700 }}>{liveTokens.length}</span>
                  </div>
                  {liveResult && (
                    <div>
                      <span style={{ color: 'var(--text-secondary, #999)' }}>Gen Speed: </span>
                      <span style={{ fontWeight: 700, ...(liveResult.genThroughput > 50 ? styles.good : liveResult.genThroughput > 20 ? styles.ok : styles.bad) }}>
                        {liveResult.genThroughput.toFixed(1)} tok/s
                      </span>
                    </div>
                  )}
                </>
              )}
              {liveTokens.length === 0 && llmRunning && (
                <div style={{ color: '#fbbf24' }}>
                  Waiting for first token...
                </div>
              )}
            </div>

            {/* TTFT visual bar */}
            {liveTokens.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #999)', marginBottom: '4px' }}>
                  Time to first token
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((liveTokens[0].timestamp / 3000) * 100, 100)}%`,
                    background: liveTokens[0].timestamp < 300 ? '#4ade80' : liveTokens[0].timestamp < 1000 ? '#fbbf24' : '#f87171',
                    borderRadius: '4px',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}

            {/* Token stream output */}
            <div style={{
              padding: '16px', borderRadius: '8px',
              background: 'color-mix(in srgb, var(--bg-primary, #0f0f1a) 90%, transparent)',
              border: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 15%, transparent)',
              maxHeight: '300px', overflow: 'auto',
              fontSize: '15px', lineHeight: 1.7,
              color: 'var(--text-primary, #e0e0e0)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {liveTokens.length === 0 && llmRunning && (
                <span style={{ color: 'var(--text-secondary, #999)', fontStyle: 'italic' }}>
                  Waiting for tokens...
                </span>
              )}
              {liveTokens.map((t, i) => (
                <span
                  key={i}
                  title={`Token #${t.index + 1} at ${t.timestamp.toFixed(0)}ms`}
                  style={{
                    borderBottom: i === 0 ? '2px solid #4ade80' : undefined,
                    background: i === 0 ? 'color-mix(in srgb, #4ade80 15%, transparent)' : undefined,
                    borderRadius: i === 0 ? '2px' : undefined,
                  }}
                >{t.content}</span>
              ))}
              {llmRunning && <span style={{ animation: 'blink 1s infinite', color: 'var(--gold-base, #D4A539)' }}>|</span>}
            </div>

            {/* Token timing histogram (last 50 tokens) */}
            {liveResult && liveTokens.length > 2 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #999)', marginBottom: '4px' }}>
                  Inter-token intervals (ms) — last {Math.min(liveTokens.length - 1, 50)} tokens
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '40px', gap: '1px' }}>
                  {liveTokens.slice(-51).map((t, i, arr) => {
                    if (i === 0) return null;
                    const gap = t.timestamp - arr[i - 1].timestamp;
                    const maxGap = 100; // normalize to 100ms
                    return (
                      <div
                        key={i}
                        title={`${gap.toFixed(0)}ms`}
                        style={{
                          flex: '1 1 2px',
                          maxWidth: '6px',
                          height: `${Math.min((gap / maxGap) * 100, 100)}%`,
                          minHeight: '2px',
                          background: gap < 20 ? '#4ade80' : gap < 50 ? '#fbbf24' : '#f87171',
                          borderRadius: '1px 1px 0 0',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Concurrency Test */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid color-mix(in srgb, var(--gold-subtle, #B8962E) 20%, transparent)' }}>
          <div style={{ ...styles.sectionTitle, fontSize: '16px' }}>Concurrency Test — How many users can we serve?</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{ ...styles.select, width: '100px', marginBottom: 0 }}
              value={concurrencyLevel}
              onChange={(e) => setConcurrencyLevel(parseInt(e.target.value))}
            >
              {[1, 2, 5, 10, 20, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n} parallel</option>
              ))}
            </select>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, ...(llmRunning ? styles.btnDisabled : {}) }}
              onClick={runConcurrencyTest}
              disabled={llmRunning}
            >
              Run Concurrency Test
            </button>
          </div>

          {/* Live progress during concurrency test */}
          {parallelStreams.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              {/* Real-time progress bar */}
              <div style={{
                padding: '10px 16px', borderRadius: '8px', marginBottom: '12px',
                background: 'color-mix(in srgb, var(--bg-primary, #0f0f1a) 80%, transparent)',
                fontFamily: 'monospace', fontSize: '14px',
                display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary, #999)' }}>Elapsed: </span>
                  <span style={{ fontWeight: 700 }}>{(liveElapsed / 1000).toFixed(1)}s</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #999)' }}>First token: </span>
                  <span style={{ fontWeight: 700, color: parallelFirstTokens === parallelStreams.length ? '#4ade80' : '#fbbf24' }}>
                    {parallelFirstTokens}/{parallelStreams.length}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #999)' }}>Complete: </span>
                  <span style={{ fontWeight: 700, color: parallelDone === parallelStreams.length ? '#4ade80' : 'var(--text-primary, #e0e0e0)' }}>
                    {parallelDone}/{parallelStreams.length}
                  </span>
                </div>
              </div>

              {/* Progress bars for first-token arrival */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #999)', marginBottom: '4px' }}>
                  First token arrival — {parallelFirstTokens}/{parallelStreams.length} received
                </div>
                <div style={{
                  height: '12px', borderRadius: '6px', overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(parallelFirstTokens / parallelStreams.length) * 100}%`,
                    background: parallelFirstTokens === parallelStreams.length ? '#4ade80' : '#fbbf24',
                    borderRadius: '6px',
                    transition: 'width 0.15s',
                  }} />
                </div>
              </div>

              {/* Per-request live rows */}
              <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                {parallelStreams.map((s, i) => (
                  <div key={i} style={{
                    ...styles.streamRow,
                    color: s.error ? '#f87171' : 'var(--text-primary, #e0e0e0)',
                  }}>
                    <span style={{ width: '30px', color: 'var(--text-secondary, #999)' }}>#{i + 1}</span>
                    {s.error ? (
                      <span style={{ color: '#f87171' }}>{s.error.slice(0, 60)}</span>
                    ) : (
                      <>
                        <span style={{
                          width: '100px',
                          color: s.ttft === 0 ? 'var(--text-secondary, #999)' : undefined,
                          ...( s.ttft > 0 ? latencyColor(s.ttft) : {}),
                        }}>
                          {s.ttft === 0 ? 'waiting...' : `TTFT: ${s.ttft.toFixed(0)}ms`}
                        </span>
                        <span style={{ width: '60px' }}>
                          {s.tokenCount > 0 ? `${s.tokenCount} tok` : ''}
                        </span>
                        <span style={{ width: '80px', ...(s.done ? (s.genSpeed > 50 ? styles.good : s.genSpeed > 20 ? styles.ok : styles.bad) : {}) }}>
                          {s.done ? `${s.genSpeed.toFixed(1)} tok/s` : s.tokenCount > 0 ? 'streaming...' : ''}
                        </span>
                        <span style={{ width: '70px', color: 'var(--text-secondary, #999)' }}>
                          {s.done ? `${(s.totalTime / 1000).toFixed(1)}s` : ''}
                        </span>
                        {/* Live progress bar */}
                        <div style={{ flex: 1, height: '14px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                          {s.ttft > 0 && (
                            <div style={{
                              height: '100%',
                              width: s.done
                                ? `${Math.min((s.totalTime / (liveElapsed || 1)) * 100, 100)}%`
                                : '100%',
                              background: s.done
                                ? (s.genSpeed > 50 ? '#4ade80' : s.genSpeed > 20 ? '#fbbf24' : '#f87171')
                                : 'color-mix(in srgb, #fbbf24 50%, transparent)',
                              borderRadius: '3px',
                              transition: s.done ? 'none' : 'width 0.15s',
                              animation: s.done ? 'none' : 'pulse 1.5s ease-in-out infinite',
                            }} />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final summary (after completion) */}
          {concurrencyResults && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                padding: '12px', borderRadius: '8px',
                background: concurrencyResults.successRate === 100
                  ? 'color-mix(in srgb, #4ade80 12%, transparent)'
                  : 'color-mix(in srgb, #f87171 12%, transparent)',
                fontSize: '14px',
              }}>
                <strong>{concurrencyResults.provider}</strong> — {concurrencyResults.level} parallel requests
                {' | '}
                Success: <strong>{concurrencyResults.successRate.toFixed(0)}%</strong>
                {' | '}
                Wall time: <strong>{(concurrencyResults.totalWallTime / 1000).toFixed(1)}s</strong>
                {' | '}
                Avg TTFT: <strong>{concurrencyResults.avgTtft.toFixed(0)}ms</strong>
                {' | '}
                Avg Gen Speed: <strong>{concurrencyResults.avgGenSpeed.toFixed(1)} tok/s</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ ...styles.section, opacity: 0.7 }}>
        <div style={styles.sectionTitle}>How to use</div>
        <ul style={{ fontSize: '13px', lineHeight: 1.8, margin: 0, paddingLeft: '20px' }}>
          <li><strong>A/B Test:</strong> Compare two providers side-by-side. Listen to both, compare latency.</li>
          <li><strong>Batch:</strong> Run N iterations to get min/avg/max/p95 stats. First run is usually slower (cold start).</li>
          <li><strong>Streaming Sim:</strong> Simulates LLM streaming — splits text into chunks sent at intervals. Detects buffer underruns (gaps in playback).</li>
          <li><strong>RT Factor:</strong> Audio duration / generation time. Above 1x = faster than realtime (good). Kokoro typically 2-5x, Chatterbox expected 3-6x local.</li>
          <li><strong>Custom endpoint:</strong> Any OpenAI-compatible TTS API works. Set the Chatterbox GEX130 URL when deployed.</li>
          <li><strong>TTFB:</strong> Time to First Byte — measures response header arrival, not first audio byte. Actual audio TTFB may differ for streaming endpoints.</li>
        </ul>
      </div>
    </div>
  );
};
