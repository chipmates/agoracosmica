import type { APIRoute } from 'astro';
import { buildLlmsFull } from '../lib/llmsData';

// The long half of the llms.txt convention: every figure description and every
// question-and-answer pair in full. Generated from the same catalogs the pages
// render, so it can never drift from what a visitor reads.
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(buildLlmsFull('en'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
