#!/usr/bin/env node

// Copies the Astro build output from marketing/dist/ into client/build/.
// Runs after `vite build` in the client build chain. The React SPA at /
// (and the legal pages it serves via SPA fallback) stay untouched —
// Astro never emits a top-level /index.html, so there's no overlap.

import { cpSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CLIENT_DIR = join(import.meta.dirname, '..');
const MARKETING_DIST = join(CLIENT_DIR, '..', 'marketing', 'dist');
const CLIENT_BUILD = join(CLIENT_DIR, 'build');

if (!existsSync(MARKETING_DIST)) {
  console.error(
    `[merge-marketing] marketing/dist/ not found at ${MARKETING_DIST}.\n` +
    `Run \`pnpm build\` in marketing/ before invoking this script.`,
  );
  process.exit(1);
}

if (!existsSync(CLIENT_BUILD)) {
  console.error(
    `[merge-marketing] client/build/ not found at ${CLIENT_BUILD}.\n` +
    `Run \`pnpm build:client\` before invoking this script.`,
  );
  process.exit(1);
}

cpSync(MARKETING_DIST, CLIENT_BUILD, { recursive: true });

const topLevel = readdirSync(MARKETING_DIST).length;
console.log(`[merge-marketing] copied ${topLevel} top-level entries from marketing/dist/ → client/build/`);
