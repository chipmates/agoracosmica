// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does.

import { COUNCIL_LLM_CONFIG, SERVING_MODELS, SPEND_GOVERNOR, TTFT_FALLBACK_MS } from '../src/config';
import { INSTRUCTIONS } from '../src/prompts/instructions';
import {
  LIVE_CHAT_SAFETY_RULES,
  SHIPPED_WISDOM_RULE_IDS,
  WISDOM_RULE_IDS,
  applyProfileRules,
} from '../src/prompts/responseRules';
import { buildSystemPrompt } from '../src/services/promptLoader';
import { fallbackModel, primaryModel, promptProfileFor, resolveServing } from '../src/services/modelRouting';
import { isOverHardCap, readSpend, recordSpend, spendDayKey, usageCostUsd } from '../src/services/spendGovernor';
import { createAwardGuardedStream } from '../src/services/awardGuard';
import { dispatchToNebius } from '../src/services/nebius';
import type { Env } from '../src/utils/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const results: { name: string; error?: string }[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name });
  } catch (err) {
    results.push({ name, error: (err as Error).message });
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
  } as unknown as KVNamespace;
}

const analyticsRows: { blobs: unknown[]; doubles: unknown[]; indexes: unknown[] }[] = [];

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    RATE_LIMITS: fakeKv(),
    ANALYTICS: { writeDataPoint: (row: never) => { analyticsRows.push(row); } },
    NEBIUS_API_KEY: 'test-key',
    NEBIUS_BASE_URL: 'https://example.invalid/v1',
    NEBIUS_MODEL: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    ALLOWED_ORIGINS: '',
    ...overrides,
  } as unknown as Env;
}

const ARMED = fakeEnv({ FREE_TIER_MODEL: 'deepseek' });
const UNARMED = fakeEnv();

function sse(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

const CONTENT_FRAME = (text: string) =>
  `data: {"choices":[{"delta":{"content":${JSON.stringify(text)}}}]}\n\n`;
const TOOL_FRAME =
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"award_seed","arguments":"{\\"passed\\":true}"}}]},"finish_reason":"tool_calls"}]}\n\n';
const USAGE_FRAME = (prompt: number, completion: number) =>
  `data: {"choices":[],"usage":{"prompt_tokens":${prompt},"completion_tokens":${completion}}}\n\n`;
const DONE_FRAME = 'data: [DONE]\n\n';

// ---------------------------------------------------------------------------
// Model to prompt mapping — the guarantee that the right rules are served
// ---------------------------------------------------------------------------

const WISDOM_SAFETY_IDS = [
  'id="crisis-referral-first"',
  'id="no-means-imagery"',
  'id="echo-honesty"',
  'id="no-invented-specifics"',
];

async function main(): Promise<number> {
  await test('armed: the free tier asks DeepSeek, pinned by id', () => {
    assertEqual(primaryModel(ARMED).key, 'dsv4-pro', 'primary model');
    assertEqual(primaryModel(ARMED).id, SERVING_MODELS['dsv4-pro'].id, 'primary model id');
    assertEqual(primaryModel(ARMED).id.startsWith('deepseek-ai/'), true, 'provider prefix');
  });

  await test('armed: NEBIUS_MODEL_PRO pins a snapshot without a rebuild', () => {
    const pinned = fakeEnv({ FREE_TIER_MODEL: 'deepseek', NEBIUS_MODEL_PRO: 'deepseek-ai/DeepSeek-V4-Pro-1231' });
    assertEqual(primaryModel(pinned).id, 'deepseek-ai/DeepSeek-V4-Pro-1231', 'pinned id');
    assertEqual(primaryModel(pinned).metered, true, 'pinned model stays metered');
  });

  await test('unarmed: the free tier serves today\'s model and nothing is metered', () => {
    assertEqual(primaryModel(UNARMED).key, 'qwen3-235b', 'primary model');
    assertEqual(primaryModel(UNARMED).id, UNARMED.NEBIUS_MODEL, 'primary model id');
    assertEqual(primaryModel(UNARMED).metered, false, 'metered');
  });

  await test('the fallback is always the Qwen endpoint in the environment', () => {
    assertEqual(fallbackModel(ARMED).key, 'qwen3-235b', 'fallback key');
    assertEqual(fallbackModel(ARMED).id, ARMED.NEBIUS_MODEL, 'fallback id');
  });

  await test('per-model request shaping: penalty and the reasoning switch', () => {
    assertEqual(SERVING_MODELS['dsv4-pro'].chatPresencePenalty, 0, 'DeepSeek presence penalty');
    assertEqual(SERVING_MODELS['qwen3-235b'].chatPresencePenalty, 1.5, 'Qwen presence penalty');
    assertEqual(
      JSON.stringify(SERVING_MODELS['dsv4-pro'].extras),
      JSON.stringify({ chat_template_kwargs: { thinking: false } }),
      'DeepSeek extras',
    );
    assertEqual(JSON.stringify(SERVING_MODELS['qwen3-235b'].extras), '{}', 'Qwen extras');
  });

  await test('armed: both the primary and the fallback path serve the same rules', () => {
    assertEqual(promptProfileFor(ARMED), 'listen-cap', 'profile');
    for (const model of [primaryModel(ARMED), fallbackModel(ARMED)]) {
      const prompt = buildSystemPrompt('aurelius', 'seed_conversation', 'de', promptProfileFor(ARMED));
      assert(prompt, `no prompt for ${model.key}`);
      for (const id of WISDOM_RULE_IDS) {
        assert(prompt!.includes(id), `${model.key} prompt is missing ${id}`);
      }
      for (const id of SHIPPED_WISDOM_RULE_IDS) {
        assert(!prompt!.includes(id), `${model.key} prompt still carries the retired ${id}`);
      }
    }
  });

  await test('armed: the four safety rules ride on every wisdom prompt', () => {
    for (const figure of Object.keys(INSTRUCTIONS).filter(k => k.endsWith(':seed_conversation'))) {
      const prompt = buildSystemPrompt(figure.split(':')[0], 'seed_conversation', 'en', 'listen-cap');
      assert(prompt, `no prompt for ${figure}`);
      for (const id of WISDOM_SAFETY_IDS) {
        assert(prompt!.includes(id), `${figure} is missing ${id}`);
      }
    }
  });

  await test('armed: Free Talk and Quest keep their own rules and gain the live-chat pair', () => {
    for (const mode of ['free_conversation', 'seed_challenge']) {
      const shipped = INSTRUCTIONS[`aurelius:${mode}`];
      const served = applyProfileRules(shipped, mode, 'listen-cap');
      assert(served.includes('id="word-limit"'), `${mode} lost its own length rule`);
      assert(served.includes('id="echo-honesty"'), `${mode} is missing the echo rule`);
      assert(served.includes('id="no-invented-specifics"'), `${mode} is missing the fabrication rule`);
      assert(!served.includes('id="crisis-referral-first"'), `${mode} must not carry the distress pair`);
      assertEqual(served.split('</response-rules>').length, 2, `${mode} block count`);
      for (const rule of LIVE_CHAT_SAFETY_RULES) {
        assertEqual(served.split(rule).length, 2, `${mode} added a rule twice`);
      }
    }
  });

  await test('unarmed: every mode serves the bundled block, byte for byte', () => {
    for (const [key, instruction] of Object.entries(INSTRUCTIONS)) {
      const mode = key.split(':')[1];
      assertEqual(applyProfileRules(instruction, mode, 'shipped'), instruction, `${key} was rewritten`);
    }
    const prompt = buildSystemPrompt('aurelius', 'seed_conversation', 'en', 'shipped');
    for (const id of SHIPPED_WISDOM_RULE_IDS) {
      assert(prompt!.includes(id), `unarmed prompt lost ${id}`);
    }
    assert(!prompt!.includes('id="listen-first"'), 'unarmed prompt carries the armed rules');
  });

  await test('the profile applies to all 90 bundled instructions', () => {
    let rewritten = 0;
    for (const [key, instruction] of Object.entries(INSTRUCTIONS)) {
      const mode = key.split(':')[1];
      if (applyProfileRules(instruction, mode, 'listen-cap') !== instruction) rewritten++;
    }
    assertEqual(rewritten, Object.keys(INSTRUCTIONS).length, 'instructions rewritten');
    assertEqual(Object.keys(INSTRUCTIONS).length, 90, 'bundle size');
  });

  await test('the seed block and language directive survive the rewrite', () => {
    const prompt = buildSystemPrompt(
      'kahlo', 'seed_conversation', 'de', 'listen-cap',
      JSON.stringify({ anchorSeed: { title: 'x' }, targetSeed: { title: 'x' } }),
    );
    assert(prompt!.includes('<seed-data>'), 'seed block missing');
    assert(prompt!.includes('MUST respond entirely in German'), 'language directive missing');
    assert(prompt!.startsWith('You are an educational AI'), 'safety preamble is not first');
  });

  // -------------------------------------------------------------------------
  // Spend governor
  // -------------------------------------------------------------------------

  await test('the counter day follows the operating timezone, not UTC', () => {
    // 23:30 UTC on the last day of June is already the next day in Berlin.
    assertEqual(spendDayKey(new Date('2026-06-30T23:30:00Z')), '2026-07-01', 'summer boundary');
    assertEqual(spendDayKey(new Date('2026-01-15T23:30:00Z')), '2026-01-16', 'winter boundary');
    assertEqual(spendDayKey(new Date('2026-01-15T22:30:00Z')), '2026-01-15', 'before the boundary');
  });

  await test('cost is real token usage at list price', () => {
    const model = SERVING_MODELS['dsv4-pro'];
    const usd = usageCostUsd(model, { promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assertEqual(Math.round(usd * 100) / 100, model.pricePer1M.input + model.pricePer1M.output, 'per-million cost');
    assertEqual(usageCostUsd(SERVING_MODELS['qwen3-235b'], { promptTokens: 0, completionTokens: 0 }), 0, 'zero usage');
  });

  await test('the hard cap trips only at the ceiling', () => {
    assertEqual(isOverHardCap(SPEND_GOVERNOR.HARD_CAP_USD - 0.01), false, 'below cap');
    assertEqual(isOverHardCap(SPEND_GOVERNOR.HARD_CAP_USD), true, 'at cap');
    assert(SPEND_GOVERNOR.SOFT_ALERT_USD < SPEND_GOVERNOR.HARD_CAP_USD, 'soft alert below hard cap');
  });

  await test('crossing a threshold writes one stats row, and only one', async () => {
    analyticsRows.length = 0;
    const env = fakeEnv({ FREE_TIER_MODEL: 'deepseek' });
    const model = SERVING_MODELS['dsv4-pro'];
    const context = { endpoint: 'chat', country: 'DE', device: 'desktop' };
    // 4M output tokens = $14, over the soft alert and under the hard cap.
    await recordSpend(env, model, { promptTokens: 0, completionTokens: 4_000_000 }, context);
    assertEqual(analyticsRows.length, 1, 'one row after the soft crossing');
    assertEqual(analyticsRows[0].blobs[0], 'governor', 'row type');
    assertEqual(analyticsRows[0].blobs[1], 'soft_alert', 'event');
    assertEqual(analyticsRows[0].blobs[5], 'desktop', 'device stays at blob6');
    assertEqual(analyticsRows[0].blobs[6], 'DE', 'country stays at blob7');
    await recordSpend(env, model, { promptTokens: 0, completionTokens: 100_000 }, context);
    assertEqual(analyticsRows.length, 1, 'the soft alert does not repeat');
    await recordSpend(env, model, { promptTokens: 0, completionTokens: 4_000_000 }, context);
    assertEqual(analyticsRows.length, 2, 'the hard trip is its own row');
    assertEqual(analyticsRows[1].blobs[1], 'hard_trip', 'event');
    const state = await readSpend(env);
    assert(state.usd >= SPEND_GOVERNOR.HARD_CAP_USD, 'day total');
    assertEqual(state.hardAlerted, true, 'hard flag persisted');
  });

  await test('an unmetered model never touches the counter', async () => {
    const env = fakeEnv();
    await recordSpend(env, SERVING_MODELS['qwen3-235b'], { promptTokens: 9_000_000, completionTokens: 9_000_000 }, {
      endpoint: 'chat', country: 'DE', device: 'desktop',
    });
    assertEqual((await readSpend(env)).usd, 0, 'counter');
  });

  await test('over the cap, the request is served by the fallback', async () => {
    const env = fakeEnv({ FREE_TIER_MODEL: 'deepseek' });
    const before = await resolveServing(env);
    assertEqual(before.model.key, 'dsv4-pro', 'primary before the trip');
    assertEqual(before.fallback?.key, 'qwen3-235b', 'fallback armed');
    await recordSpend(env, SERVING_MODELS['dsv4-pro'], { promptTokens: 0, completionTokens: 9_000_000 }, {
      endpoint: 'chat', country: 'DE', device: 'desktop',
    });
    const after = await resolveServing(env);
    assertEqual(after.model.key, 'qwen3-235b', 'model after the trip');
    assertEqual(after.governorTripped, true, 'trip flag');
    assertEqual(after.profile, 'listen-cap', 'the fallback keeps the same rules');
  });

  // -------------------------------------------------------------------------
  // Quest award guard
  // -------------------------------------------------------------------------

  await test('a spoken verdict passes through unchanged', async () => {
    const frames = [CONTENT_FRAME('You held the'), CONTENT_FRAME(' distinction.'), TOOL_FRAME, DONE_FRAME];
    const out = await readAll(createAwardGuardedStream(sse(frames), async () => null));
    assertEqual(out, frames.join(''), 'stream bytes');
  });

  await test('a silent award is regenerated once', async () => {
    let regenerated = 0;
    const spoken = [CONTENT_FRAME('The seed is yours.'), TOOL_FRAME, DONE_FRAME];
    const out = await readAll(createAwardGuardedStream(
      sse([TOOL_FRAME, DONE_FRAME]),
      async () => { regenerated++; return sse(spoken); },
    ));
    assertEqual(regenerated, 1, 'regeneration count');
    assertEqual(out, spoken.join(''), 'the client sees only the spoken turn');
    assert(!out.includes('"passed\\":true}"}}]},"finish_reason":"tool_calls"}]}\ndata: [DONE]'), 'no duplicate ending');
  });

  await test('whitespace is not a verdict', async () => {
    let regenerated = 0;
    const out = await readAll(createAwardGuardedStream(
      sse([CONTENT_FRAME('  \n '), TOOL_FRAME, DONE_FRAME]),
      async () => { regenerated++; return sse([CONTENT_FRAME('Spoken.'), TOOL_FRAME, DONE_FRAME]); },
    ));
    assertEqual(regenerated, 1, 'regeneration count');
    assert(out.includes('Spoken.'), 'retry served');
  });

  await test('when regeneration fails the original turn still reaches the client', async () => {
    const frames = [TOOL_FRAME, DONE_FRAME];
    const out = await readAll(createAwardGuardedStream(sse(frames), async () => null));
    assertEqual(out, frames.join(''), 'held frames released');
  });

  await test('a frame split across chunks is reassembled', async () => {
    const whole = CONTENT_FRAME('Held together.') + TOOL_FRAME + DONE_FRAME;
    const mid = Math.floor(whole.length / 2);
    const out = await readAll(createAwardGuardedStream(
      sse([whole.slice(0, mid), whole.slice(mid)]),
      async () => null,
    ));
    assertEqual(out, whole, 'stream bytes');
  });

  // -------------------------------------------------------------------------
  // Dispatch: request shaping, metering, availability fallback
  // -------------------------------------------------------------------------

  const realFetch = globalThis.fetch;
  const stubFetch = (
    responder: (body: Record<string, unknown>, call: number) => Response | Promise<Response>,
  ): Record<string, unknown>[] => {
    const seen: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      seen.push(body);
      return responder(body, seen.length);
    }) as unknown as typeof fetch;
    return seen;
  };
  const sseResponse = (frames: string[]): Response =>
    new Response(sse(frames), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

  await test('the metered request carries the snapshot, the switch, and no penalty', async () => {
    const seen = stubFetch(() => sseResponse([CONTENT_FRAME('hi'), USAGE_FRAME(100, 50), DONE_FRAME]));
    const usages: { promptTokens: number; completionTokens: number }[] = [];
    const result = await dispatchToNebius({
      systemPrompt: 'p', messages: [{ role: 'user', content: 'q' }], env: ARMED,
      model: primaryModel(ARMED), usePresencePenalty: true,
      onUsage: (_model, usage) => { usages.push(usage); },
    });
    assertEqual(result.ok, true, 'dispatch ok');
    assertEqual(seen[0].model, SERVING_MODELS['dsv4-pro'].id, 'model id');
    assertEqual(seen[0].presence_penalty, 0, 'presence penalty');
    assertEqual(JSON.stringify(seen[0].chat_template_kwargs), JSON.stringify({ thinking: false }), 'reasoning switch');
    assertEqual(JSON.stringify(seen[0].stream_options), JSON.stringify({ include_usage: true }), 'usage frames');
    await readAll(result.stream!);
    assertEqual(usages.length, 1, 'usage reported');
    assertEqual(usages[0].promptTokens, 100, 'prompt tokens');
    assertEqual(usages[0].completionTokens, 50, 'completion tokens');
  });

  await test('the unmetered request keeps today\'s wire format', async () => {
    const seen = stubFetch(() => sseResponse([CONTENT_FRAME('hi'), DONE_FRAME]));
    const result = await dispatchToNebius({
      systemPrompt: 'p', messages: [{ role: 'user', content: 'q' }], env: UNARMED,
      model: primaryModel(UNARMED), usePresencePenalty: true,
      onUsage: () => { throw new Error('an unmetered model must not report usage'); },
    });
    assertEqual(result.ok, true, 'dispatch ok');
    assertEqual(seen[0].model, UNARMED.NEBIUS_MODEL, 'model id');
    assertEqual(seen[0].presence_penalty, 1.5, 'presence penalty');
    assertEqual('stream_options' in seen[0], false, 'no usage frames requested');
    assertEqual('chat_template_kwargs' in seen[0], false, 'no reasoning switch');
    assertEqual(await readAll(result.stream!), CONTENT_FRAME('hi') + DONE_FRAME, 'stream bytes');
  });

  await test('an upstream error falls back to the other model, same prompt', async () => {
    const seen = stubFetch((_body, call) =>
      call === 1 ? new Response('boom', { status: 500 }) : sseResponse([CONTENT_FRAME('ok'), DONE_FRAME]));
    const result = await dispatchToNebius({
      systemPrompt: 'p', messages: [{ role: 'user', content: 'q' }], env: ARMED,
      model: primaryModel(ARMED), fallback: fallbackModel(ARMED), usePresencePenalty: true,
    });
    assertEqual(result.ok, true, 'dispatch ok');
    assertEqual(result.served.key, 'qwen3-235b', 'served model');
    assertEqual(result.fallbackReason, 'upstream_error', 'reason');
    assertEqual(seen[1].model, ARMED.NEBIUS_MODEL, 'fallback model id');
    assertEqual(seen[1].presence_penalty, 1.5, 'the fallback gets its own penalty');
    assertEqual(JSON.stringify(seen[0].messages), JSON.stringify(seen[1].messages), 'same prompt on both models');
  });

  await test('a stalled first token falls back before the client sees anything', async () => {
    const stall = new ReadableStream<Uint8Array>({ start() { /* never emits */ } });
    stubFetch((_body, call) =>
      call === 1
        ? new Response(stall, { status: 200 })
        : sseResponse([CONTENT_FRAME('recovered'), DONE_FRAME]));
    const startedAt = Date.now();
    const result = await dispatchToNebius({
      systemPrompt: 'p', messages: [{ role: 'user', content: 'q' }], env: ARMED,
      model: primaryModel(ARMED), fallback: fallbackModel(ARMED), usePresencePenalty: true,
    });
    assertEqual(result.fallbackReason, 'latency', 'reason');
    assertEqual(result.served.key, 'qwen3-235b', 'served model');
    assert(Date.now() - startedAt >= TTFT_FALLBACK_MS, 'the deadline was actually awaited');
    assertEqual(await readAll(result.stream!), CONTENT_FRAME('recovered') + DONE_FRAME, 'stream bytes');
  });

  await test('without a fallback the upstream error reaches the client', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));
    const result = await dispatchToNebius({
      systemPrompt: 'p', messages: [{ role: 'user', content: 'q' }], env: UNARMED,
      model: primaryModel(UNARMED), usePresencePenalty: true,
    });
    assertEqual(result.ok, false, 'dispatch failed');
    assertEqual(result.error?.status, 502, 'client status');
  });

  globalThis.fetch = realFetch;

  // -------------------------------------------------------------------------
  // Council headroom
  // -------------------------------------------------------------------------

  await test('a German council fits the cap with room to spare', () => {
    // Widest measured German council system prompt, client side, which is what
    // the route validates: the worker's own preamble is added afterwards.
    const WIDEST_MEASURED_DE_COUNCIL_CHARS = 59_454;
    assert(
      COUNCIL_LLM_CONFIG.MAX_SYSTEM_PROMPT_CHARS > WIDEST_MEASURED_DE_COUNCIL_CHARS * 1.25,
      'less than 25% headroom over the widest measured German council',
    );
  });

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------

  const failed = results.filter(r => r.error);
  for (const r of results) {
    console.log(r.error ? `FAIL  ${r.name}\n      ${r.error}` : `ok    ${r.name}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
}

// The runner is a plain script, so the failure count becomes the exit code.
const host = globalThis as { process?: { exitCode?: number } };
main().then(
  failures => { if (host.process && failures > 0) host.process.exitCode = 1; },
  err => {
    console.log(`FAIL  suite crashed: ${(err as Error).message}`);
    if (host.process) host.process.exitCode = 1;
  },
);
