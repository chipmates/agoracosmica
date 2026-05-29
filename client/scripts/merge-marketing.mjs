#!/usr/bin/env node

// Copies the Astro build output from marketing/dist/ into client/build/.
// Runs after `vite build` in the client build chain. The React SPA shell that
// Vite emits at build/index.html is moved to build/app/index.html FIRST, so
// Astro's new static homepage (marketing/dist/index.html) can take over the
// top-level build/index.html without clobbering the app shell. Astro now owns
// the top-level index.html; the React app is served from /app and /app/*.

import { cpSync, existsSync, readdirSync, mkdirSync, renameSync } from 'fs';
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

// The React SPA shell that Vite emits at build/index.html now lives under
// /app. Move it to build/app/index.html BEFORE the marketing copy, so the
// new static Astro homepage (marketing/dist/index.html) can take over
// build/index.html without clobbering the app shell. The shell references
// /assets/* and /config.js with absolute paths, so it serves identically
// from /app/index.html — no Vite `base` change needed. Guarded with
// existsSync so a self-host build (build:self-host, no marketing) is
// unaffected and re-runs are idempotent.
const REACT_SHELL = join(CLIENT_BUILD, 'index.html');
if (existsSync(REACT_SHELL)) {
  mkdirSync(join(CLIENT_BUILD, 'app'), { recursive: true });
  renameSync(REACT_SHELL, join(CLIENT_BUILD, 'app', 'index.html'));
  console.log('[merge-marketing] moved React shell build/index.html → build/app/index.html');
}

cpSync(MARKETING_DIST, CLIENT_BUILD, { recursive: true });

const topLevel = readdirSync(MARKETING_DIST).length;
console.log(`[merge-marketing] copied ${topLevel} top-level entries from marketing/dist/ → client/build/`);
