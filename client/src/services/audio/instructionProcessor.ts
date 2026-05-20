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

const processSeedData = (instructions: string, seedData: any): string => {
  if (!seedData) return instructions;
  
  try {
    // Get mode and figure from Zustand or default
    const selectedMode = useDomainStore.getState().mode.selected || INSTRUCTION_MODES.FREE_CONVERSATION;
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
      case INSTRUCTION_MODES.FREE_CONVERSATION:
        processedSeedData = seedDataProcessor.processFreeConversationData(allSeeds, figureMeta);
        break;
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
  seedData: any = null
): Promise<string> => {
  try {
    let figureId = "";
    // Special case for Martin Luther King Jr.
    if (figure.includes('King Jr.') || figure.includes('King Jr')) {
      figureId = 'king';
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

    if (seedData) {
      const processedInstructions = processSeedData(instructions.system, seedData);
      return processedInstructions;
    }

    return instructions.system;
  } catch (error) {
    throw new Error(`Failed to fetch instructions for ${figure}`);
  }
};
