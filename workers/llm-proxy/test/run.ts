// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does.

import {
  COUNCIL_LLM_CONFIG,
  RATE_LIMITS,
  SERVING_MODELS,
  SPEND_GOVERNOR,
  TELEGRAM_ALERTS,
  TTFT_FALLBACK_MS,
  governorHardCapUsd,
  governorSoftAlertUsd,
} from '../src/config';
import { INSTRUCTIONS } from '../src/prompts/instructions';
import {
  LIVE_CHAT_SAFETY_RULES,
  SHIPPED_WISDOM_RULE_IDS,
  WISDOM_RULE_IDS,
  applyProfileRules,
} from '../src/prompts/responseRules';
import { ASIDE_RULES, buildSystemPrompt } from '../src/services/promptLoader';
import { fallbackModel, freeTierState, primaryModel, promptProfileFor, resolveServing } from '../src/services/modelRouting';
import {
  isOverHardCap, readSpend, recordSpend, spendDayKey, spendResetsAt, usageCostUsd,
} from '../src/services/spendGovernor';
import { alertFallback, alertSpendCrossing } from '../src/services/telegram';
import {
  checkAndIncrementRateLimit,
  checkAndIncrementSessionRateLimit,
} from '../src/middleware/rateLimit';
import { createAwardGuardedStream } from '../src/services/awardGuard';
import { dispatchToNebius } from '../src/services/nebius';
import { handleChat } from '../src/routes/chat';
import { handleQuota } from '../src/routes/quota';
import { signJWT } from '../src/utils/jwt';
import worker from '../src/index';
import type { Env, JWTPayload } from '../src/utils/types';

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
  return auditedKv().kv;
}

/** A KV that also records every key written, so a read path can be proven read-only. */
function auditedKv(): { kv: KVNamespace; puts: string[] } {
  const store = new Map<string, string>();
  const puts: string[] = [];
  const kv = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { puts.push(key); store.set(key, value); },
  } as unknown as KVNamespace;
  return { kv, puts };
}

/** Collects the background work a route hands off, so a test can await it. */
function fakeCtx(): { ctx: ExecutionContext; pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (work: Promise<unknown>) => { pending.push(work); },
    passThroughOnException: () => { /* no-op */ },
  } as unknown as ExecutionContext;
  return { ctx, pending };
}

const analyticsRows: { blobs: unknown[]; doubles: unknown[]; indexes: unknown[] }[] = [];

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    RATE_LIMITS: fakeKv(),
    ANALYTICS: { writeDataPoint: (row: never) => { analyticsRows.push(row); } },
    NEBIUS_API_KEY: 'test-key',
    NEBIUS_BASE_URL: 'https://example.invalid/v1',
    NEBIUS_MODEL: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    JWT_SIGNING_KEY: 'test-signing-key',
    ALLOWED_ORIGINS: '',
    ...overrides,
  } as unknown as Env;
}

const ARMED = fakeEnv({ FREE_TIER_MODEL: 'deepseek' });
const UNARMED = fakeEnv();

// Ceilings for the governor cases. Test figures on purpose, not the deployment's:
// what the suite proves is that the worker reads the vars at all.
const TEST_HARD_USD = 15;
const TEST_SOFT_USD = 5;
const governedEnv = (): Env => fakeEnv({
  FREE_TIER_MODEL: 'deepseek',
  GOVERNOR_HARD_USD: String(TEST_HARD_USD),
  GOVERNOR_SOFT_USD: String(TEST_SOFT_USD),
});

const fakeRequest = (ip?: string): Request =>
  new Request('https://example.invalid/v1/chat', {
    method: 'POST',
    headers: ip ? { 'CF-Connecting-IP': ip } : {},
  });

const fakeIdentity = (sub: string): JWTPayload => ({ sub, iat: 0, exp: 0 });

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

  await test('both profiles disclose the Echo when asked, and no longer refuse to', () => {
    const DISCLOSURE = 'say plainly that you are an AI Echo, an interpretation and not the person';
    const RETIRED = 'Never break character';
    for (const profile of ['shipped', 'listen-cap'] as const) {
      const prompt = buildSystemPrompt('aurelius', 'free_conversation', 'en', profile);
      assert(prompt, `no prompt for ${profile}`);
      assert(prompt!.includes(DISCLOSURE), `${profile} is missing the disclosure sentence`);
      assert(!prompt!.includes(RETIRED), `${profile} still carries the retired sentence`);
    }
  });

  await test('the aside rules ride only when asked, and only on Free Talk', () => {
    const ASIDE_OPEN = '<aside-rules priority="absolute">';
    const asked = buildSystemPrompt('aurelius', 'free_conversation', 'en', 'listen-cap', undefined, undefined, { aside: true });
    assert(asked, 'no prompt');
    assert(asked!.includes(ASIDE_OPEN), 'the block is missing');
    for (const rule of ASIDE_RULES) {
      assertEqual(asked!.split(rule).length, 2, `rule added ${rule.slice(0, 24)} other than once`);
    }

    for (const options of [undefined, {}, { distress: true }, { aside: false }]) {
      const prompt = buildSystemPrompt('aurelius', 'free_conversation', 'en', 'listen-cap', undefined, undefined, options);
      assert(!prompt!.includes(ASIDE_OPEN), `the block rode along on ${JSON.stringify(options)}`);
    }

    for (const mode of ['seed_conversation', 'seed_challenge', 'introduction']) {
      const prompt = buildSystemPrompt('aurelius', mode, 'en', 'listen-cap', undefined, undefined, { aside: true });
      if (prompt) assert(!prompt.includes(ASIDE_OPEN), `${mode} took the block`);
    }
  });

  await test('an aside keeps the profile honesty rules and the language directive', () => {
    const prompt = buildSystemPrompt('aurelius', 'free_conversation', 'de', 'listen-cap', undefined, undefined, { aside: true });
    assert(prompt, 'no prompt');
    assert(prompt!.startsWith('You are an educational AI'), 'safety preamble is not first');
    assert(prompt!.includes('id="echo-honesty"'), 'echo honesty rule lost');
    assert(prompt!.includes('id="no-invented-specifics"'), 'fabrication rule lost');
    assert(prompt!.includes('MUST respond entirely in German'), 'language directive lost');
    assert(
      prompt!.indexOf('<aside-rules') > prompt!.indexOf('</response-rules>'),
      'the aside block has to sit after the profile rules to override them',
    );
    assert(
      prompt!.indexOf('<aside-rules') < prompt!.indexOf('MUST respond entirely in German'),
      'the language directive stays last',
    );
  });

  await test('the crisis referral outranks an aside on the same turn', () => {
    const prompt = buildSystemPrompt(
      'aurelius', 'free_conversation', 'en', 'listen-cap', undefined, undefined,
      { aside: true, distress: true },
    );
    assert(prompt!.includes('<crisis-rules priority="absolute">'), 'crisis block missing');
    assert(prompt!.includes('<aside-rules priority="absolute">'), 'aside block missing');
    assert(
      prompt!.indexOf('<crisis-rules') < prompt!.indexOf('<aside-rules'),
      'the referral has to be read before the length cap',
    );
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

  await test('the ceilings come from the environment, and trip only at the ceiling', () => {
    const env = governedEnv();
    assertEqual(governorHardCapUsd(env), TEST_HARD_USD, 'hard cap from the var');
    assertEqual(governorSoftAlertUsd(env), TEST_SOFT_USD, 'soft alert from the var');
    assertEqual(isOverHardCap(env, TEST_HARD_USD - 0.01), false, 'below cap');
    assertEqual(isOverHardCap(env, TEST_HARD_USD), true, 'at cap');
    assert(governorSoftAlertUsd(env) < governorHardCapUsd(env), 'soft alert below hard cap');
  });

  await test('a missing or unreadable ceiling falls back to the floor in code', () => {
    const bare = fakeEnv({ FREE_TIER_MODEL: 'deepseek' });
    assertEqual(governorHardCapUsd(bare), SPEND_GOVERNOR.FLOOR_HARD_CAP_USD, 'hard floor');
    assertEqual(governorSoftAlertUsd(bare), SPEND_GOVERNOR.FLOOR_SOFT_ALERT_USD, 'soft floor');
    const junk = fakeEnv({ GOVERNOR_HARD_USD: 'twenty', GOVERNOR_SOFT_USD: '-3' });
    assertEqual(governorHardCapUsd(junk), SPEND_GOVERNOR.FLOOR_HARD_CAP_USD, 'hard floor on junk');
    assertEqual(governorSoftAlertUsd(junk), SPEND_GOVERNOR.FLOOR_SOFT_ALERT_USD, 'soft floor on junk');
    assert(SPEND_GOVERNOR.FLOOR_SOFT_ALERT_USD < SPEND_GOVERNOR.FLOOR_HARD_CAP_USD, 'floor ordering');
  });

  await test('crossing a threshold writes one stats row, and only one', async () => {
    analyticsRows.length = 0;
    const env = governedEnv();
    const model = SERVING_MODELS['dsv4-pro'];
    const context = { endpoint: 'chat', country: 'DE', device: 'desktop' };
    // 2M output tokens = $7, over the soft alert and under the hard cap.
    await recordSpend(env, model, { promptTokens: 0, completionTokens: 2_000_000 }, context);
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
    assert(state.usd >= governorHardCapUsd(env), 'day total');
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
    const env = governedEnv();
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
  // The free-tier state the client renders
  // -------------------------------------------------------------------------

  await test('unarmed: the state names one model and nothing to switch to', async () => {
    const state = await freeTierState(UNARMED);
    assertEqual(state.primary.key, 'qwen3-235b', 'primary key');
    assertEqual(state.primary.label, 'qwen3-235b', 'primary label');
    assertEqual(state.primary.region, 'eu-north1', 'primary region');
    assertEqual(state.fallback, null, 'fallback');
    assertEqual(state.governor.armed, false, 'armed');
    assertEqual(state.governor.tripped, false, 'tripped');
    assertEqual(state.serving.key, 'qwen3-235b', 'serving key');
  });

  await test('armed: the state names both models and where each is served', async () => {
    const state = await freeTierState(governedEnv());
    assertEqual(state.primary.label, 'deepseek-v4-pro', 'primary label');
    assertEqual(state.primary.region, 'uk-south1', 'primary region');
    assertEqual(state.fallback?.label, 'qwen3-235b', 'fallback label');
    assertEqual(state.fallback?.region, 'eu-north1', 'fallback region');
    assertEqual(state.governor.armed, true, 'armed');
    assertEqual(state.governor.tripped, false, 'tripped');
    assertEqual(state.serving.key, 'dsv4-pro', 'serving key');
    assert(new Date(state.governor.resetsAt).getTime() > Date.now(), 'the reset is in the future');
  });

  await test('the state carries identifiers only: no provider ids, no dollar figures', async () => {
    const serialized = JSON.stringify(await freeTierState(governedEnv()));
    assert(!serialized.includes('deepseek-ai/'), 'a provider model id leaked');
    assert(!serialized.includes('Qwen/'), 'a provider model id leaked');
    assert(!serialized.includes('usd') && !serialized.includes('Usd'), 'a spend figure leaked');
    assertEqual(serialized.includes(String(TEST_HARD_USD)), false, 'the ceiling leaked');
  });

  await test('armed and spent: the state says the fallback is answering', async () => {
    const env = governedEnv();
    await recordSpend(env, SERVING_MODELS['dsv4-pro'], { promptTokens: 0, completionTokens: 9_000_000 }, {
      endpoint: 'chat', country: 'DE', device: 'desktop',
    });
    const state = await freeTierState(env);
    assertEqual(state.governor.tripped, true, 'tripped');
    assertEqual(state.serving.key, 'qwen3-235b', 'serving key');
    assertEqual(state.primary.key, 'dsv4-pro', 'the primary is still named');
    assertEqual(state.fallback?.key, 'qwen3-235b', 'the fallback is still named');
  });

  await test('reading the state is a read: it never writes to KV', async () => {
    const audited = auditedKv();
    const env = fakeEnv({
      FREE_TIER_MODEL: 'deepseek',
      GOVERNOR_HARD_USD: String(TEST_HARD_USD),
      GOVERNOR_SOFT_USD: String(TEST_SOFT_USD),
      RATE_LIMITS: audited.kv,
    });
    await freeTierState(env);
    await freeTierState(env);
    assertEqual(audited.puts.length, 0, `writes during a state read: ${audited.puts.join(', ')}`);
  });

  await test('the counter rolls over at local midnight, not UTC midnight', () => {
    const summer = spendResetsAt(new Date('2026-07-15T09:00:00Z'));
    assertEqual(summer, '2026-07-15T22:00:00.000Z', 'summer boundary');
    const winter = spendResetsAt(new Date('2026-01-15T09:00:00Z'));
    assertEqual(winter, '2026-01-15T23:00:00.000Z', 'winter boundary');
    const reset = new Date(summer);
    assertEqual(spendDayKey(new Date(reset.getTime() - 1000)), '2026-07-15', 'the second before is today');
    assertEqual(spendDayKey(reset), '2026-07-16', 'the reset instant is tomorrow');
  });

  // -------------------------------------------------------------------------
  // Rate limits: the per-identity quota and the per-address ceilings beside it
  // -------------------------------------------------------------------------

  await test('one identity spends its daily quota and then gets a 429', async () => {
    const env = fakeEnv();
    const request = fakeRequest('203.0.113.7');
    const identity = fakeIdentity('11111111-1111-4111-8111-111111111111');
    for (let i = 1; i <= RATE_LIMITS.DAILY_PER_IP; i++) {
      const result = await checkAndIncrementRateLimit(request, env, identity);
      assertEqual(result.allowed, true, `request ${i} should pass`);
      assertEqual(result.daily.used, i, `used after request ${i}`);
    }
    const over = await checkAndIncrementRateLimit(request, env, identity);
    assertEqual(over.allowed, false, 'the 31st request');
    assertEqual(over.reason, 'per_ip', 'reason');
    assertEqual(over.daily.limit, RATE_LIMITS.DAILY_PER_IP, 'limit reported');
  });

  await test('fresh identities from one address stop at the address ceiling', async () => {
    const env = fakeEnv();
    const request = fakeRequest('203.0.113.9');
    const perIdentity = RATE_LIMITS.DAILY_PER_IP;
    const identities = RATE_LIMITS.CHAT_DAILY_PER_IP / perIdentity;
    let served = 0;
    for (let n = 0; n < identities; n++) {
      const identity = fakeIdentity(`2222222${n}-2222-4222-8222-222222222222`);
      for (let i = 0; i < perIdentity; i++) {
        const result = await checkAndIncrementRateLimit(request, env, identity);
        assertEqual(result.allowed, true, `identity ${n} request ${i}`);
        served++;
      }
    }
    assertEqual(served, RATE_LIMITS.CHAT_DAILY_PER_IP, 'requests served before the ceiling');
    // The eleventh identity is brand new and still refused: the second bucket
    // is what a UUID cycler runs into.
    const cycler = await checkAndIncrementRateLimit(request, env, fakeIdentity('33333333-3333-4333-8333-333333333333'));
    assertEqual(cycler.allowed, false, 'the request past the ceiling');
    assertEqual(cycler.reason, 'ip_ceiling', 'reason');
    assertEqual(cycler.daily.used, 0, 'the visitor still sees their own quota');
    // Another address is untouched by the first one's ceiling.
    const elsewhere = await checkAndIncrementRateLimit(
      fakeRequest('198.51.100.4'), env, fakeIdentity('44444444-4444-4444-8444-444444444444'));
    assertEqual(elsewhere.allowed, true, 'a different address');
  });

  await test('an address without a CF header is never held against anyone', async () => {
    const env = fakeEnv();
    const headless = fakeRequest();
    for (let n = 0; n <= RATE_LIMITS.CHAT_DAILY_PER_IP; n++) {
      const result = await checkAndIncrementRateLimit(headless, env, fakeIdentity(`5555555${n}-5555-4555-8555-555555555555`));
      assertEqual(result.allowed, true, `headless request ${n}`);
    }
  });

  await test('session minting from one address stops at the hourly ceiling', async () => {
    const env = fakeEnv();
    const request = fakeRequest('203.0.113.11');
    for (let i = 1; i <= RATE_LIMITS.SESSION_HOURLY_PER_IP; i++) {
      const result = await checkAndIncrementSessionRateLimit(request, env);
      assertEqual(result.allowed, true, `mint ${i} should pass`);
      assertEqual(result.used, i, `used after mint ${i}`);
    }
    const over = await checkAndIncrementSessionRateLimit(request, env);
    assertEqual(over.allowed, false, 'the 21st mint');
    assertEqual(over.limit, RATE_LIMITS.SESSION_HOURLY_PER_IP, 'limit reported');
    assert(over.retryAfterSeconds > 0 && over.retryAfterSeconds <= 3600, 'retry lands inside the hour');
    const elsewhere = await checkAndIncrementSessionRateLimit(fakeRequest('198.51.100.6'), env);
    assertEqual(elsewhere.allowed, true, 'a different address');
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

  // -------------------------------------------------------------------------
  // Operator alerts: one line per event, and flood control in front of them
  // -------------------------------------------------------------------------

  const TEST_BOT_TOKEN = 'test-bot-token';
  const TEST_CHAT_ID = '-1000000000';
  const telegramEnv = (overrides: Partial<Env> = {}): Env => fakeEnv({
    TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    TELEGRAM_CHAT_ID: TEST_CHAT_ID,
    ...overrides,
  });

  const stubTelegram = (): { url: string; body: Record<string, unknown> }[] => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;
    return calls;
  };

  const crossing = (over: Partial<{
    dayKey: string; spendUsd: number; crossedSoft: boolean; crossedHard: boolean;
  }> = {}) => ({
    dayKey: '2026-09-03',
    spendUsd: 10.24,
    model: SERVING_MODELS['dsv4-pro'],
    crossedSoft: false,
    crossedHard: false,
    ...over,
  });

  await test('the budget alerts name the spend and the model, once per day each', async () => {
    const calls = stubTelegram();
    const env = telegramEnv();

    await alertSpendCrossing(env, crossing({ crossedSoft: true }));
    await alertSpendCrossing(env, crossing({ crossedSoft: true }));
    assertEqual(calls.length, 1, 'soft alerts sent');
    assertEqual(calls[0].url, `https://api.telegram.org/bot${TEST_BOT_TOKEN}/sendMessage`, 'Bot API endpoint');
    assertEqual(calls[0].body.chat_id, TEST_CHAT_ID, 'chat id');
    assertEqual(
      calls[0].body.text,
      'Free tier: soft alert at 10.24 USD day to date, DeepSeek V4 Pro still answering',
      'soft line',
    );

    await alertSpendCrossing(env, crossing({ crossedHard: true, spendUsd: 20.03 }));
    assertEqual(calls.length, 2, 'hard trips sent');
    assertEqual(
      calls[1].body.text,
      'Free tier: daily budget reached at 20.03 USD, Qwen3 235B answers until midnight',
      'hard line',
    );

    await alertSpendCrossing(env, crossing({ dayKey: '2026-09-04', crossedSoft: true }));
    assertEqual(calls.length, 3, 'the next day alerts again');
  });

  await test('a wobble is one message per window, and each event type has its own', async () => {
    const calls = stubTelegram();
    const env = telegramEnv();
    const served = SERVING_MODELS['qwen3-235b'];

    for (let i = 0; i < 5; i++) {
      await alertFallback(env, { event: 'fallback_error', served, spendUsd: 12.4 });
    }
    assertEqual(calls.length, 1, 'error alerts inside one window');
    assertEqual(
      calls[0].body.text,
      'Free tier: primary model failed, Qwen3 235B answering, 12.40 USD day to date',
      'error line',
    );

    await alertFallback(env, { event: 'fallback_latency', served, spendUsd: 12.4 });
    assertEqual(calls.length, 2, 'the other event type has its own window');
    assertEqual(
      calls[1].body.text,
      'Free tier: primary model stalled, Qwen3 235B answering, 12.40 USD day to date',
      'latency line',
    );
    assert(TELEGRAM_ALERTS.FALLBACK_WINDOW_SECONDS >= 600, 'the window collapses a burst');
  });

  await test('without the bot token nothing is sent and nothing is claimed', async () => {
    const calls = stubTelegram();
    const audited = auditedKv();
    const env = fakeEnv({ TELEGRAM_CHAT_ID: TEST_CHAT_ID, RATE_LIMITS: audited.kv });
    await alertSpendCrossing(env, crossing({ crossedSoft: true, crossedHard: true }));
    await alertFallback(env, { event: 'fallback_error', served: SERVING_MODELS['qwen3-235b'], spendUsd: 1 });
    assertEqual(calls.length, 0, 'messages sent');
    assertEqual(audited.puts.length, 0, 'flood-control keys written');
  });

  await test('a Telegram outage never reaches the request path', async () => {
    globalThis.fetch = (async () => { throw new Error('telegram down'); }) as unknown as typeof fetch;
    await alertFallback(telegramEnv(), {
      event: 'fallback_error', served: SERVING_MODELS['qwen3-235b'], spendUsd: 0,
    });
  });

  // -------------------------------------------------------------------------
  // Routes: what the browser is told about the model
  // -------------------------------------------------------------------------

  const IDENTITY = '66666666-6666-4666-8666-666666666666';
  const bearer = async (env: Env): Promise<string> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return signJWT({ sub: IDENTITY, iat: nowSeconds, exp: nowSeconds + 600 }, env.JWT_SIGNING_KEY);
  };

  await test('a chat response names the model that answered', async () => {
    stubFetch(() => sseResponse([CONTENT_FRAME('hello'), DONE_FRAME]));
    const env = fakeEnv();
    const { ctx, pending } = fakeCtx();
    const response = await handleChat(
      new Request('https://example.invalid/v1/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(env)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figureId: 'aurelius',
          mode: 'free_conversation',
          language: 'en',
          messages: [{ role: 'user', content: 'What holds a day together?' }],
        }),
      }),
      env,
      ctx,
    );
    assertEqual(response.status, 200, 'status');
    assertEqual(response.headers.get('X-Model'), 'qwen3-235b', 'X-Model');
    assertEqual(response.headers.get('X-AI-Model'), 'Qwen3-235B-A22B-Instruct', 'X-AI-Model stays the disclosure label');
    await response.body?.cancel();
    await Promise.all(pending);
  });

  await test('an aside request carries the rules into the prompt and the label into the row', async () => {
    analyticsRows.length = 0;
    const seen = stubFetch(() => sseResponse([CONTENT_FRAME('I waited.'), DONE_FRAME]));
    const env = fakeEnv();
    const { ctx, pending } = fakeCtx();
    const response = await handleChat(
      new Request('https://example.invalid/v1/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(env)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figureId: 'aurelius',
          mode: 'free_conversation',
          language: 'en',
          kind: 'aside',
          aside: true,
          messages: [
            { role: 'assistant', content: 'He looked at the boy for a long time.' },
            { role: 'user', content: 'Why did he forgive him?' },
          ],
        }),
      }),
      env,
      ctx,
    );
    assertEqual(response.status, 200, 'status');
    const sent = seen[0].messages as { role: string; content: string }[];
    assertEqual(sent[0].role, 'system', 'first message');
    assert(sent[0].content.includes('<aside-rules priority="absolute">'), 'the aside block never reached the model');
    await response.body?.cancel();
    await Promise.all(pending);
    const chatRow = analyticsRows.find(row => row.blobs[0] === 'chat');
    assert(chatRow, 'no chat row');
    assertEqual(chatRow!.blobs[7], 'aside', 'the kind label');
  });

  await test('a chat request without the field gets no aside rules', async () => {
    const seen = stubFetch(() => sseResponse([CONTENT_FRAME('hello'), DONE_FRAME]));
    const env = fakeEnv();
    const { ctx, pending } = fakeCtx();
    const response = await handleChat(
      new Request('https://example.invalid/v1/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(env)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figureId: 'aurelius',
          mode: 'free_conversation',
          language: 'en',
          // A truthy non-true value must not arm it either.
          aside: 'true',
          messages: [{ role: 'user', content: 'What holds a day together?' }],
        }),
      }),
      env,
      ctx,
    );
    const sent = seen[0].messages as { role: string; content: string }[];
    assert(!sent[0].content.includes('<aside-rules'), 'the aside block rode along uninvited');
    await response.body?.cancel();
    await Promise.all(pending);
  });

  await test('the model header is exposed to the browser', async () => {
    const env = fakeEnv({ ALLOWED_ORIGINS: 'https://agoracosmica.org' });
    const { ctx } = fakeCtx();
    const preflight = await worker.fetch(
      new Request('https://llm.invalid/v1/chat', {
        method: 'OPTIONS',
        headers: { Origin: 'https://agoracosmica.org' },
      }),
      env,
      ctx,
    );
    const exposed = (preflight.headers.get('Access-Control-Expose-Headers') || '')
      .split(',').map(name => name.trim());
    assert(exposed.includes('X-Model'), 'X-Model is not exposed through CORS');
  });

  await test('the quota response carries the free-tier state beside the counters', async () => {
    const env = fakeEnv();
    const response = await handleQuota(
      new Request('https://example.invalid/v1/quota', {
        method: 'GET',
        headers: { Authorization: `Bearer ${await bearer(env)}` },
      }),
      env,
    );
    assertEqual(response.status, 200, 'status');
    const body = await response.json() as {
      daily: { limit: number };
      freeTier: { serving: { label: string }; fallback: unknown; governor: { armed: boolean } };
    };
    assertEqual(body.daily.limit, RATE_LIMITS.DAILY_PER_IP, 'the counters are still there');
    assertEqual(body.freeTier.serving.label, 'qwen3-235b', 'serving label');
    assertEqual(body.freeTier.fallback, null, 'fallback');
    assertEqual(body.freeTier.governor.armed, false, 'armed');
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
