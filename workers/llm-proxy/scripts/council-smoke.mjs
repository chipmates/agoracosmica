#!/usr/bin/env node
// Live council smoke for a deployed worker. Internal ops helper, never bundled.
//
// Runs ONE German council request against a worker URL and checks two things a
// unit test cannot: the deployed worker answers 200, and the answer carries
// every speaker label the client's parser needs (/^([A-Z][A-Z\s.]+?) :: /).
// Prints the X-AI-Model header, so a model flip is visible in one line.
//
// Usage:
//   node scripts/council-smoke.mjs https://llm.agoracosmica.org
//
// Auth, one of (never write either into a file):
//   JWT_SIGNING_KEY=...  mints a throwaway identity locally. Preferred: the
//                        council cap is 1 per identity per day, so a fresh
//                        subject each run leaves real quota alone.
//   AGORA_JWT=...        a token copied from the browser network tab. Spends
//                        that browser identity's council for the day.
//
// Exit code 0 on pass, 1 on fail.

const SPEAKERS = ['SOKRATES', 'HILDEGARD', 'GOETHE'];

const SYSTEM_PROMPT = `Du moderierst einen kurzen Rat aus drei Stimmen: ${SPEAKERS.join(', ')}.

Jede Stimme spricht genau einmal, in dieser Reihenfolge, je zwei bis drei Sätze.
Sprich durchgehend Deutsch, in natürlicher gesprochener Sprache, du-Form.

FORMAT, für JEDE Zeile verbindlich:
NAME :: Text der Stimme

Beispiel:
${SPEAKERS[0]} :: Ich beginne bei dem, was du gerade gesagt hast.

Keine Überschriften, keine Regieanweisungen, keine Aufzählungen.`;

const USER_MESSAGE = 'Wie finde ich Ruhe, wenn ich abends nicht abschalten kann?';

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Same HS256 shape as src/utils/jwt.ts, so the worker accepts it. */
async function mintToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64Url(Buffer.from(JSON.stringify({
    sub: crypto.randomUUID(),
    iat: now,
    exp: now + 600,
  })));
  const key = await crypto.subtle.importKey(
    'raw', Buffer.from(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(`${header}.${payload}`));
  return `${header}.${payload}.${base64Url(signature)}`;
}

/** Collect the assistant text out of the SSE stream. */
async function readCouncilText(response) {
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') text += delta;
      } catch {
        // A partial or non-JSON frame is not a failure on its own.
      }
    }
  }
  return text;
}

async function main() {
  const base = (process.argv[2] || '').replace(/\/+$/, '');
  if (!base) fail('pass the worker URL, e.g. node scripts/council-smoke.mjs https://llm.agoracosmica.org');

  const token = process.env.AGORA_JWT
    || (process.env.JWT_SIGNING_KEY ? await mintToken(process.env.JWT_SIGNING_KEY) : null);
  if (!token) fail('set JWT_SIGNING_KEY (preferred) or AGORA_JWT in the environment');

  console.log(`POST ${base}/v1/council  language=de  speakers=${SPEAKERS.join(', ')}`);
  const startedAt = Date.now();

  let response;
  try {
    response = await fetch(`${base}/v1/council`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        language: 'de',
        messages: [{ role: 'user', content: USER_MESSAGE }],
      }),
    });
  } catch (err) {
    fail(`request never completed: ${err.message}`);
  }

  console.log(`      status ${response.status}  model ${response.headers.get('X-AI-Model') || 'not reported'}`);

  if (response.status !== 200) {
    fail(`expected 200, got ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }

  const text = await readCouncilText(response);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`      ${text.length} chars in ${elapsed}s\n`);
  console.log(text.slice(0, 600));
  console.log('');

  const missing = SPEAKERS.filter(name => !text.includes(`${name} ::`));
  if (missing.length) fail(`no labelled line for: ${missing.join(', ')}`);
  if (!/[äöüßÄÖÜ]/.test(text)) fail('the answer does not read as German');

  console.log(`PASS  200, all ${SPEAKERS.length} speaker labels present, German`);
}

main().catch(err => fail(err.stack || err.message));
