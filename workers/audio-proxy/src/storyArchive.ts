// GET/HEAD /v1/audio/story-archive/{figure}/{lang}
//
// Streams every prerecorded story of one figure and language as a single ZIP
// straight out of R2. HEAD answers with the same headers so the client can
// show availability and download size before committing to ~400 MB.

import { corsHeaders } from './cors';
import type { Env } from './types';
import { streamZip, zipByteLength, type ZipEntry } from './zip';

/** Seeds 0 to 12: foreword plus twelve chapters. */
const SEED_COUNT = 13;

const FIGURE_PATTERN = /^[a-z]+$/;
const FIGURE_MAX_LENGTH = 40;

/** Archives are heavy, so this route gets its own quota separate from TTS. */
const ARCHIVE_LIMITS = { perDay: 20, perMinute: 4 } as const;

type Language = 'en' | 'de';

export async function handleStoryArchive(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathTail: string,
  country: string,
): Promise<Response> {
  const cors = corsHeaders(request, env);
  const segments = pathTail.split('/').filter((s) => s.length > 0);
  if (segments.length !== 2) return jsonError(404, 'Not found', cors);

  const [figure, lang] = segments;
  if (!FIGURE_PATTERN.test(figure) || figure.length > FIGURE_MAX_LENGTH) {
    return jsonError(400, 'Invalid figure', cors);
  }
  if (lang !== 'en' && lang !== 'de') {
    return jsonError(400, 'Invalid language', cors);
  }

  const isHead = request.method === 'HEAD';

  // HEAD is the client's availability probe and runs on every visit, so only
  // the actual download draws from the quota.
  if (!isHead && !(await withinQuota(request, env))) {
    return jsonError(429, 'Too many archive downloads. Please try again later.', cors);
  }

  const plan = await buildPlan(env, figure, lang);
  if (!plan) return jsonError(404, 'Story audio not available', cors);

  const totalBytes = zipByteLength(plan.entries);
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', contentDisposition(plan.archiveName));
  headers.set('Content-Length', String(totalBytes));
  headers.set('X-Archive-Bytes', String(totalBytes));
  // No range support, and the archive is cheap to regenerate from R2.
  headers.set('Accept-Ranges', 'none');
  headers.set('Cache-Control', 'no-store');

  if (isHead) return new Response(null, { status: 200, headers });

  ctx.waitUntil(
    Promise.resolve().then(() => {
      env.ANALYTICS.writeDataPoint({
        blobs: [lang, 'zip', '', '200', 'story-archive', figure, country],
        doubles: [totalBytes],
        indexes: ['story-archive'],
      });
    }),
  );

  const stream = new FixedLengthStream(totalBytes);
  ctx.waitUntil(streamZip(plan.entries, env.STORY_BUCKET, stream.writable));
  return new Response(stream.readable, { status: 200, headers });
}

// --- Planning ---

interface ArchivePlan {
  entries: ZipEntry[];
  archiveName: string;
}

/**
 * Resolve every object up front. Sizes have to be known before the first byte
 * ships, because Content-Length is fixed at that point. One list call covers
 * the whole folder instead of 26 head calls.
 */
async function buildPlan(env: Env, figure: string, lang: Language): Promise<ArchivePlan | null> {
  const prefix = `stories/${figure}/${lang}/`;
  const objects = new Map<string, { size: number; uploaded: Date }>();

  let cursor: string | undefined;
  do {
    const page = await env.STORY_BUCKET.list({ prefix, cursor });
    for (const object of page.objects) {
      objects.set(object.key, { size: object.size, uploaded: object.uploaded });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const label = `${capitalize(figure)} (${lang.toUpperCase()})`;
  const archiveName = `Agora Cosmica - Echoes - ${label}.zip`;
  const folder = archiveName.slice(0, -'.zip'.length);

  const entries: ZipEntry[] = [];
  let transcripts = 0;

  for (let seed = 0; seed < SEED_COUNT; seed++) {
    const stem = `${figure}_${seed}_${lang}`;
    const number = String(seed).padStart(2, '0');

    const audio = objects.get(`${prefix}${stem}.mp3`);
    // A gap in the audio means this figure and language is not published.
    if (!audio) return null;
    entries.push({
      name: `${folder}/${number} ${figure}_${lang}.mp3`,
      size: audio.size,
      modified: audio.uploaded,
      source: { kind: 'r2', key: `${prefix}${stem}.mp3` },
    });

    const transcript = objects.get(`${prefix}${stem}.txt`);
    if (transcript) {
      transcripts++;
      entries.push({
        name: `${folder}/${number} ${figure}_${lang}.txt`,
        size: transcript.size,
        modified: transcript.uploaded,
        source: { kind: 'r2', key: `${prefix}${stem}.txt` },
      });
    }
  }

  const readme = new TextEncoder().encode(readmeText(lang, label, SEED_COUNT, transcripts));
  entries.unshift({
    name: `${folder}/README.txt`,
    size: readme.length,
    modified: new Date(),
    source: { kind: 'bytes', bytes: readme },
  });

  return { entries, archiveName };
}

// --- README ---

function readmeText(lang: Language, label: string, audioCount: number, transcriptCount: number): string {
  const lines =
    lang === 'de'
      ? [
          `Agora Cosmica - Echos - ${label}`,
          '',
          'Über diese Aufnahmen',
          'Das sind KI-generierte Echo-Stimmen. Die Erzählung ist synthetisch und',
          'wurde für dieses Projekt erstellt. Es sind keine Aufnahmen der',
          'historischen Person.',
          '',
          'Was drin ist',
          `${audioCount} Audiodateien (mp3) in Hörreihenfolge, nummeriert ab 00.`,
          ...(transcriptCount > 0
            ? [`${transcriptCount} Transkripte (txt), jeweils zur gleich nummerierten Audiodatei.`]
            : []),
          '',
          'Projekt',
          'Agora Cosmica, eine lebendige Bibliothek, mit der du sprechen kannst.',
          'https://agoracosmica.org',
          '',
          'Rechte',
          'Inhalte (c) ChipMates gemeinnützige GmbH. Für den persönlichen Gebrauch.',
          'Bitte nicht weiterveröffentlichen oder weiterverbreiten.',
        ]
      : [
          `Agora Cosmica - Echoes - ${label}`,
          '',
          'About these recordings',
          'These are AI-generated Echo voices. The narration is synthetic and was',
          'made for this project. It is not a recording of the historical figure.',
          '',
          'What is inside',
          `${audioCount} audio files (mp3) in listening order, numbered from 00.`,
          ...(transcriptCount > 0
            ? [`${transcriptCount} transcripts (txt), each matching the audio file with the same number.`]
            : []),
          '',
          'Project',
          'Agora Cosmica, a living library you can talk to.',
          'https://agoracosmica.org',
          '',
          'Rights',
          'Content (c) ChipMates gemeinnützige GmbH. For personal listening.',
          'Please do not republish or redistribute these files.',
        ];
  // CRLF: this file is most often opened on Windows after unzipping.
  return lines.join('\r\n') + '\r\n';
}

// --- Quota ---

async function withinQuota(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const hash = await hashIp(ip);
  const dayKey = `archive:day:${hash}:${new Date().toISOString().slice(0, 10)}`;
  const minuteKey = `archive:min:${hash}:${Math.floor(Date.now() / 60_000)}`;

  const [day, minute] = await Promise.all([
    readCounter(env.RATE_LIMITS, dayKey),
    readCounter(env.RATE_LIMITS, minuteKey),
  ]);
  if (day >= ARCHIVE_LIMITS.perDay || minute >= ARCHIVE_LIMITS.perMinute) return false;

  await Promise.all([
    env.RATE_LIMITS.put(dayKey, String(day + 1), { expirationTtl: 86_400 }),
    env.RATE_LIMITS.put(minuteKey, String(minute + 1), { expirationTtl: 120 }),
  ]);
  return true;
}

async function readCounter(kv: KVNamespace, key: string): Promise<number> {
  const value = await kv.get(key);
  return value ? parseInt(value, 10) || 0 : 0;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode('archive-ratelimit:' + ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Helpers ---

function jsonError(status: number, message: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

/** encodeURIComponent leaves characters that RFC 5987 attr-char forbids. */
function encodeRfc5987(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => {
      const char = String.fromCharCode(byte);
      return /[A-Za-z0-9!#$&+\-.^_`|~]/.test(char)
        ? char
        : '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    })
    .join('');
}

function capitalize(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
