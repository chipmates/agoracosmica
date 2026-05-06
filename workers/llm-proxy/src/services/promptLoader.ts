// Load bundled prompts and seed data for a given figure + mode
// Phase 1: prompts are bundled at build time in prompts/instructions.ts

import { INSTRUCTIONS } from '../prompts/instructions';
import { SAFETY_PREAMBLE } from '../utils/safety';

// Map language codes to full names for the LLM
const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  // Add more as needed
};

/**
 * Build the complete system prompt for a figure + mode + language + optional seed data
 */
export function buildSystemPrompt(
  figureId: string,
  mode: string,
  language: string,
  seedDataJson?: string
): string | null {
  const key = `${figureId}:${mode}`;
  const instruction = INSTRUCTIONS[key];

  if (!instruction) {
    console.error(`[PromptLoader] No instruction found for ${key}`);
    return null;
  }

  let prompt = instruction;

  // Inject seed data: prepend as a labeled JSON block before the instruction.
  // The instruction text contains {{SEED_DATA}}.targetSeed.title etc. as semantic pointers
  // that the LLM reads as references to the injected data above.
  if (seedDataJson && prompt.includes('{{SEED_DATA}}')) {
    // Sanitize seedData: strip XML-like tags to prevent prompt escape attempts
    const sanitizedJson = seedDataJson.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const seedBlock = `<seed-data>\nThe following JSON contains the seed data referenced throughout this instruction as {{SEED_DATA}}. Use it to inform your responses.\n\n${sanitizedJson}\n</seed-data>\n\n`;
    prompt = seedBlock + prompt;
  }

  // Remove trailing context blocks (same as llmAdapter.ts)
  if (prompt.includes('\n\nContext for current interaction:')) {
    prompt = prompt.split('\n\nContext for current interaction:')[0];
  }

  // Add language directive — critical for non-English users
  const langName = LANGUAGE_NAMES[language] || language;
  const languageDirective = language && language !== 'en'
    ? `\n\nIMPORTANT: The user speaks ${langName}. You MUST respond entirely in ${langName}. Use proper ${langName} grammar, spelling, and natural phrasing. Never mix languages.`
    : '';

  return SAFETY_PREAMBLE + '\n' + prompt + languageDirective;
}
