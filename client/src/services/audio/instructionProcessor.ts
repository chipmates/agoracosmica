// src/services/audio/instructionProcessor.ts

import seedDataProcessor from '../seedDataProcessor';
import { processPlaceholders } from '../../utils/placeholderUtils';

import { useDomainStore } from '../../stores';

// ============================================
// Type Definitions
// ============================================

interface InstructionModule {
  system: string;
}

interface SeedData {
  id?: string | number;
  title?: string;
  description?: string;
  practice?: string;
  quote?: string;
  story?: string;
  wisdomConnections?: Array<{ title: string; figure?: string; seed?: string }>;
  whySelected?: string[];
  [key: string]: any;
}

interface FigureMeta {
  figure: string;
  topic?: string;
  tradition?: string;
  historicalPeriod?: string;
  primaryWorks?: string[];
}

type WindowWithCache = Window & {
  seedsCache?: {
    [key: string]: {
      seeds: SeedData[];
      topic?: string;
      metadata?: {
        tradition?: string;
        historicalPeriod?: string;
        primaryWorks?: string[];
      };
    };
  };
};

// ============================================
// Configuration — Instructions served from R2
// ============================================

import { mediaBaseUrl as MEDIA_BASE } from '../../config/runtime';

// In-memory cache: instructions fetched once per figure/mode, then instant
const instructionCache: Record<string, InstructionModule> = {};

async function loadInstruction(figureId: string, mode: string): Promise<InstructionModule | null> {
  const cacheKey = `${figureId}/${mode}`;
  if (instructionCache[cacheKey]) return instructionCache[cacheKey];

  try {
    const url = `${MEDIA_BASE}/instructions/${figureId}/${mode}.json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as InstructionModule;
    instructionCache[cacheKey] = data;
    return data;
  } catch {
    return null;
  }
}

export const INSTRUCTION_MODES = {
  STORY: 'story',
  INTRODUCTION: 'introduction',
  SEED_CONVERSATION: 'seed_conversation',
  FREE_CONVERSATION: 'free_conversation',
  CHALLENGE: 'challenge'
} as const;

export type InstructionMode = typeof INSTRUCTION_MODES[keyof typeof INSTRUCTION_MODES];

// ============================================
// Carried-question entry (BYOK parity)
// ============================================

/** A conversation opened from a question the visitor chose before it began. */
export type CarriedEntry = 'carried';

export interface InstructionOptions {
  /**
   * The seed that grounds the carried question. Left out, the selected seed is
   * used (same rule as the free-tier path). Explicit null suppresses the
   * anchor, which is what a council handoff needs.
   */
  anchorSeedId?: string | number | null;
  /** Set when the send carries a question chosen before the conversation opened. */
  entry?: CarriedEntry;
  /** User messages in the payload. 1 means this is the carried question itself. */
  userMessageCount?: number;
  /** The conversation mode, when the caller knows it. Wins over the store. */
  mode?: string;
  /** Set when the question was asked from a paused chapter. */
  aside?: boolean;
}

// BYOK requests never reach the worker, so the answer-first directive lives
// here as well as in workers/llm-proxy/src/services/promptLoader.ts. The two
// texts must stay identical.
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

const buildCarriedDirective = (userMessageCount: number, hasAnchor: boolean): string => {
  if (userMessageCount > 1) return CARRIED_CONTINUATION;
  return [
    ANSWERED_REPLY_OPENING,
    hasAnchor ? ANSWERED_REPLY_ANCHOR : ANSWERED_REPLY_UNGROUNDED,
    ANSWERED_REPLY_CLOSE,
  ].join(' ');
};

// ============================================
// Aside rules (BYOK parity)
// ============================================

// A question asked while a chapter is paused. The listener is going back to the
// telling, so the answer is short, ends on a statement, and knows nothing past
// the paragraph they stopped on. BYOK requests never reach the worker, so these
// rules live here as well as in workers/llm-proxy/src/services/promptLoader.ts.
// The two texts must stay identical.
export const ASIDE_RULES = [
  '<rule id="aside-length">40 to 70 words. Two to four sentences. Overrides the length rule.</rule>',
  '<rule id="aside-no-handover">Do not end with a question. They are going back to the chapter. Overrides the handover rule.</rule>',
  '<rule id="aside-horizon">The story text you were given is everything they have heard, and its last paragraph is where they stopped. Answer from that and from your own life. Never mention or hint at anything past it. If they ask what happens next, say you would rather they hear it.</rule>',
  '<rule id="aside-no-meta">Never mention pausing, the app, players or the recording. Answer the thing they asked.</rule>',
];

const ASIDE_BLOCK =
  '<aside-rules priority="absolute">\n' + ASIDE_RULES.join('\n') + '\n</aside-rules>';

/**
 * Appends the aside rules when the question came from a paused chapter. No-op
 * on every other request, idempotent, and it leaves the carried directive
 * alone: an ask never carries an entry, but the two blocks can coexist.
 */
export const applyAsideRules = (
  instructions: string,
  options: InstructionOptions = {}
): string => {
  if (!options.aside) return instructions;
  if (options.mode !== undefined && options.mode !== INSTRUCTION_MODES.FREE_CONVERSATION) {
    return instructions;
  }
  if (instructions.includes('<aside-rules')) return instructions;
  return `${instructions}\n\n${ASIDE_BLOCK}`;
};

/**
 * Appends the answer-first directive when the visitor carried their question
 * in. No-op on every other request, and idempotent, so a caller may pass
 * instructions that were already built with the same options.
 */
export const applyCarriedEntry = (
  instructions: string,
  options: InstructionOptions = {}
): string => {
  if (options.entry !== 'carried') return instructions;
  if (options.mode !== INSTRUCTION_MODES.FREE_CONVERSATION) return instructions;
  if (instructions.includes(ANSWERED_REPLY_OPENING) || instructions.includes(CARRIED_CONTINUATION)) {
    return instructions;
  }
  const hasAnchor = options.anchorSeedId !== null && /"anchorSeed"\s*:/.test(instructions);
  return `${instructions}\n\n${buildCarriedDirective(options.userMessageCount ?? 1, hasAnchor)}`;
};

// ============================================
// Helper Functions
// ============================================

const getModeInstructionPath = (mode: string): string => {
  // Standardize mode names for processing
  const standardizedMode = mode === 'challenge' ? 'seed_challenge' : mode;
  
  switch (standardizedMode) {
    case INSTRUCTION_MODES.FREE_CONVERSATION:
      return 'free_conversation';
    case INSTRUCTION_MODES.SEED_CONVERSATION:
      return 'seed_conversation';
    case INSTRUCTION_MODES.CHALLENGE:
    case 'seed_challenge':
      return 'seed_challenge';
    case INSTRUCTION_MODES.STORY:
    case INSTRUCTION_MODES.INTRODUCTION:
      return 'introduction';
    default:
      // Unknown mode
      return 'introduction';
  }
};

const processSeedData = (
  instructions: string,
  seedData: any,
  options: InstructionOptions = {}
): string => {
  if (!seedData) return instructions;
  
  try {
    // Get mode and figure from Zustand or default
    // An ask is generated while the story player is on screen, so the store's
    // mode is not the mode of the request. An explicit mode wins.
    const selectedMode = options.mode
      || useDomainStore.getState().mode.selected
      || INSTRUCTION_MODES.FREE_CONVERSATION;
    const selectedFigure = useDomainStore.getState().figures.selectedId || '';
    
    // Get all seeds for this figure from Zustand store (primary) or window cache (fallback)
    let allSeeds: any[] = useDomainStore.getState().seeds.byFigure[selectedFigure] || [];

    if (allSeeds.length === 0) {
      try {
        const windowWithCache = window as WindowWithCache;
        if (typeof window !== 'undefined' && windowWithCache.seedsCache && windowWithCache.seedsCache[selectedFigure]) {
          const cacheData = windowWithCache.seedsCache[selectedFigure];
          if (cacheData && Array.isArray(cacheData.seeds)) {
            allSeeds = cacheData.seeds;
          }
        }
      } catch {
        // Cache error
      }
    }
    
    // Process seed data based on mode
    let processedSeedData: any;
    
    // Get figure metadata from cache if available
    // Ensure proper capitalization for figure name - first letter uppercase, rest lowercase
    const figureDisplayName = selectedFigure.charAt(0).toUpperCase() + selectedFigure.slice(1).toLowerCase();
    
    // Initialize figureMeta with proper capitalization
    let figureMeta: FigureMeta = { figure: figureDisplayName };
    
    // Try to enhance with metadata if available
    const windowWithCache = window as WindowWithCache;
    if (typeof window !== 'undefined' && windowWithCache.seedsCache && windowWithCache.seedsCache[selectedFigure]) {
      const figureData = windowWithCache.seedsCache[selectedFigure];
      figureMeta = {
        figure: figureDisplayName, // Use proper capitalization
        topic: figureData.topic || '',
        tradition: figureData.metadata?.tradition || '',
        historicalPeriod: figureData.metadata?.historicalPeriod || '',
        primaryWorks: figureData.metadata?.primaryWorks || []
      };
    }
    
    switch (selectedMode) {
      case INSTRUCTION_MODES.CHALLENGE:
        processedSeedData = seedDataProcessor.processSeedChallengeData(seedData, allSeeds, figureMeta);
        break;
      case INSTRUCTION_MODES.SEED_CONVERSATION:
        processedSeedData = seedDataProcessor.processSeedConversationData(seedData, allSeeds, figureMeta);
        break;
      case INSTRUCTION_MODES.FREE_CONVERSATION: {
        // The selected seed doubles as the anchor, same rule the free-tier
        // path follows. An explicit null in the options suppresses it.
        const anchorSeedId = options.anchorSeedId !== undefined
          ? options.anchorSeedId
          : useDomainStore.getState().seeds.selectedId;
        processedSeedData = seedDataProcessor.processFreeConversationData(
          allSeeds, figureMeta, undefined, anchorSeedId
        );
        break;
      }
      default:
        // For story mode or unknown modes, use raw data
        processedSeedData = seedData;
    }
    
    // Handle {{SEED_DATA}} explicit placeholder format (V3 instructions)
    // Inject as labeled block before the instruction — {{SEED_DATA}}.xxx references
    // throughout the instruction serve as semantic pointers the LLM reads
    if (instructions.includes('{{SEED_DATA}}')) {
      const seedBlock = `<seed-data>\nThe following JSON contains the seed data referenced throughout this instruction as {{SEED_DATA}}. Use it to inform your responses.\n\n${JSON.stringify(processedSeedData)}\n</seed-data>\n\n`;
      return seedBlock + instructions;
    }

    // Legacy V2 fallback: find and replace the {{SEED_DATA}} placeholder JSON
    // Use brace-counting instead of regex to handle nested objects correctly
    const firstBrace = instructions.indexOf('{');
    if (firstBrace !== -1) {
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < instructions.length; i++) {
        if (instructions[i] === '{') depth++;
        else if (instructions[i] === '}') {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx !== -1) {
        const processed = instructions.slice(0, firstBrace) + JSON.stringify(processedSeedData) + instructions.slice(endIdx + 1);
        return processed;
      }
    }
    
    // Build a comprehensive replacements map for all other placeholders
    const replacements: { [key: string]: string } = {
      // Common placeholders
      'FIGURE': processedSeedData.figureMeta?.figure || selectedFigure || '',
      'MODE': selectedMode || '',
      
      // JSON stringified data (used in some instructions)
      'SEED_DATA_JSON': JSON.stringify(processedSeedData)
    };
    
    // Add seed-specific placeholders if available
    if (processedSeedData.mode === 'seed_challenge' || processedSeedData.mode === 'seed_conversation') {
      if (processedSeedData.targetSeed) {
        const targetSeed = processedSeedData.targetSeed;
        
        // Add basic seed data
        replacements['SEED_TITLE'] = targetSeed.title || '';
        replacements['SEED TITLE'] = targetSeed.title || '';
        replacements['SEED_ID'] = targetSeed.id || '';
        replacements['SEED DESCRIPTION'] = targetSeed.description || '';
        replacements['SEED PRACTICE'] = targetSeed.practice || '';
        replacements['SEED QUOTE'] = targetSeed.quote || '';
        replacements['PARADOX QUOTE'] = targetSeed.quote || '';
        
        // Add collection fields with proper formatting
        if (Array.isArray(targetSeed.wisdomConnections)) {
          replacements['SEED CONNECTIONS'] = targetSeed.wisdomConnections.map((c: { title: string }) => c.title).join(', ');
        }

        if (Array.isArray(targetSeed.whySelected)) {
          replacements['SEED WHY_SELECTED'] = targetSeed.whySelected.join('\n- ');
        }
        
        // Story related fields
        if (targetSeed.story) {
          replacements['SEED STORY'] = targetSeed.story;
          replacements['STORY_LIBRARY'] = targetSeed.story;
        }
      }
    } 
    // Free conversation specific replacements
    else if (processedSeedData.mode === 'free_conversation') {
      if (processedSeedData.seedsOverview && processedSeedData.seedsOverview.length > 0) {
        replacements['SEED TITLES'] = processedSeedData.seedsOverview.map((s: { title: string }) => s.title).join(', ');
      }
    }
    
    // Process all placeholders with our utility
    let processed = processPlaceholders(instructions, replacements, {
      supportedFormats: ['curly', 'bracket', 'double-curly'],
      logMissing: true
    });
    
    // Explicitly remove any trailing context block, which may be added from various places
    if (processed.includes('\n\nContext for current interaction:')) {
      processed = processed.split('\n\nContext for current interaction:')[0];
    }
    
    return processed;
    
  } catch (error) {
    return instructions;
  }
};

// ============================================
// Main Export
// ============================================

export const fetchInstructions = async (
  figure: string,
  mode: string,
  seedData: any = null,
  options: InstructionOptions = {}
): Promise<string> => {
  try {
    let figureId = "";
    // Special case for Martin Luther King Jr.
    if (figure.includes('King Jr.') || figure.includes('King Jr')) {
      figureId = 'king';
    } else if (figure.toLowerCase().includes('mark aurel') || figure.toLowerCase().includes('marc aurel')) {
      // German exonym: last-word split would yield "aurel" and 404 the instruction fetch
      figureId = 'aurelius';
    } else {
      figureId = figure.toLowerCase().split(' ').pop() || '';
    }
    
    const validMode = Object.values(INSTRUCTION_MODES).includes(mode as InstructionMode) 
      ? mode 
      : INSTRUCTION_MODES.INTRODUCTION;
    
    const instructionMode = getModeInstructionPath(validMode);

    const instructions = await loadInstruction(figureId, instructionMode);

    if (!instructions) {
      throw new Error(`Instructions not found: ${figureId}/${instructionMode}`);
    }

    const carried = { ...options, mode: validMode };
    const base = seedData
      ? processSeedData(instructions.system, seedData, options)
      : instructions.system;

    return applyAsideRules(applyCarriedEntry(base, carried), carried);
  } catch (error) {
    throw new Error(`Failed to fetch instructions for ${figure}`);
  }
};
