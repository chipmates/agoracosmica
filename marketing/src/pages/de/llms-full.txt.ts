import type { APIRoute } from 'astro';
import { buildLlmsFull } from '../../lib/llmsData';

// Deutsches Volltext-Verzeichnis, die lange Hälfte der llms.txt-Konvention.
// Wird aus denselben Katalogen erzeugt wie die Seiten, kann also nicht von dem
// abweichen, was Besucherinnen und Besucher lesen.
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(buildLlmsFull('de'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
