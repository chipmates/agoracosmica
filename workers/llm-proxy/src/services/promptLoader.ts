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
 * A carried-question arrival: the visitor picked the question on a public page,
 * before the conversation existed. Absent on every other request.
 */
export interface CarriedEntry {
  /** User messages in the payload. 1 means this is the carried question itself. */
  userMessageCount: number;
}

// Answer-first directive for carried questions. The bundled instructions know
// nothing about the entry flow, so the whole behavior lives here.
// Kept in step with client/src/services/audio/instructionProcessor.ts, which
// runs the same directive for BYOK requests that never reach this worker.
const ANSWERED_REPLY_OPENING =
  'The visitor arrived carrying the question in their message — they chose it before you two ever spoke. Answer it directly as your first words: no greeting, no topic offers, no preamble.';
const ANSWERED_REPLY_ANCHOR =
  'Ground your answer in {{SEED_DATA}}.anchorSeed — that teaching exists because it answers this question; draw on its insights naturally, without naming it as a lesson.';
const ANSWERED_REPLY_UNGROUNDED =
  'Answer from your life and your thought, concretely.';
const ANSWERED_REPLY_CLOSE =
  'Keep your register: peer on the bench, not a podium. End with one real question back to them.';
const CARRIED_CONTINUATION =
  'This conversation began with a question the visitor carried in. While the exchange is young, stay with what they raise and end your replies with a question back when it serves the dialogue.';

function buildCarriedDirective(userMessageCount: number, hasAnchor: boolean): string {
  if (userMessageCount > 1) return CARRIED_CONTINUATION;
  return [
    ANSWERED_REPLY_OPENING,
    hasAnchor ? ANSWERED_REPLY_ANCHOR : ANSWERED_REPLY_UNGROUNDED,
    ANSWERED_REPLY_CLOSE,
  ].join(' ');
}

/**
 * Build the complete system prompt for a figure + mode + language + optional seed data
 */
export function buildSystemPrompt(
  figureId: string,
  mode: string,
  language: string,
  seedDataJson?: string,
  carried?: CarriedEntry
): string | null {
  const key = `${figureId}:${mode}`;
  const instruction = INSTRUCTIONS[key];

  if (!instruction) {
    console.error(`[PromptLoader] No instruction found for ${key}`);
    return null;
  }

  let prompt = instruction;

  // The anchor pointer only resolves once the seed block is actually injected.
  const hasAnchorSeed = !!seedDataJson
    && instruction.includes('{{SEED_DATA}}')
    && /"anchorSeed"\s*:/.test(seedDataJson);

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

  // Carried question: the figure answers instead of greeting. Free Talk only,
  // since it is the one mode a public question door opens.
  if (carried && mode === 'free_conversation') {
    prompt += '\n\n' + buildCarriedDirective(carried.userMessageCount, hasAnchorSeed);
  }

  // Add language directive — critical for non-English users
  const langName = LANGUAGE_NAMES[language] || language;
  const languageDirective = language && language !== 'en'
    ? `\n\nIMPORTANT: The user speaks ${langName}. You MUST respond entirely in ${langName}. Use proper ${langName} grammar, spelling, and natural phrasing. Never mix languages.`
    : '';

  return SAFETY_PREAMBLE + '\n' + prompt + languageDirective;
}
