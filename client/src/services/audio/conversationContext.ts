// src/services/audio/conversationContext.ts

import {
  getStoredStoryContent,
  getStoredPrismContent,
  STORAGE_KEYS,
} from '../../utils/storageKeysV2';
import prismService from '../prism/PrismService';
import { LocalStorageAdapter } from '../../storage/localAdapter';

// ============================================
// Type Definitions
// ============================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const INSTRUCTION_MODES = {
  STORY: 'story',
  INTRODUCTION: 'introduction',
  SEED_CONVERSATION: 'seed_conversation',
  FREE_CONVERSATION: 'free_conversation',
  CHALLENGE: 'challenge',
  PRISM: 'prism'
} as const;

export type InstructionMode = typeof INSTRUCTION_MODES[keyof typeof INSTRUCTION_MODES];

// ============================================
// Helper Functions
// ============================================

/**
 * Get seed conversation history
 */
const getSeedConversationHistory = (figureId: string, seedId: string): ConversationMessage[] => {
  const storageKey = STORAGE_KEYS.getStarSeedHistory(figureId, seedId);
  const history = LocalStorageAdapter.getString(storageKey);
  if (!history) return [];
  
  try {
    const parsed = JSON.parse(history);
    if (!Array.isArray(parsed)) return [];
    
    return parsed
      .filter((msg: any) => {
        // Ensure message has both role and content
        return msg && 
               msg.role && 
               msg.content && 
               typeof msg.content === 'string' &&
               msg.content.trim().length > 0;
      })
      .map((msg: any) => ({
        role: (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant',
        content: String(msg.content).trim()
      }));
  } catch (e) {
    console.warn('Failed to parse seed conversation history:', e);
    return [];
  }
};

/**
 * Get challenge history
 */
const getChallengeHistory = (figureId: string, seedId: string): ConversationMessage[] => {
  const storageKey = STORAGE_KEYS.getChallengeHistory(figureId, seedId);
  const history = LocalStorageAdapter.getString(storageKey);
  if (!history) return [];
  
  try {
    const parsed = JSON.parse(history);
    if (!Array.isArray(parsed)) return [];
    
    return parsed
      .filter((msg: any) => {
        // Ensure message has both role and content
        return msg && 
               msg.role && 
               msg.content && 
               typeof msg.content === 'string' &&
               msg.content.trim().length > 0;
      })
      .map((msg: any) => ({
        role: (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant',
        content: String(msg.content).trim()
      }));
  } catch (e) {
    console.warn('Failed to parse challenge history:', e);
    return [];
  }
};

/**
 * Get prism context for a seed — manifest cache first, then stored content
 */
const getPrismContext = (figureId: string, seedId: string, lang: string = 'en'): ConversationMessage | null => {
  // Try manifest cache first
  const cached = prismService.getCachedManifest(figureId, Number(seedId), lang);
  if (cached) {
    const text = prismService.formatManifestAsContext(cached);
    if (text) {
      return { role: 'assistant', content: `[Multi-Perspective Dialogue]\n\n${text}` };
    }
  }

  // Fallback to stored content
  const stored = getStoredPrismContent(figureId, seedId);
  if (stored?.content) {
    return { role: 'assistant', content: `[Multi-Perspective Dialogue]\n\n${stored.content}` };
  }

  return null;
};

/**
 * Get free talk history (global for figure)
 */
const getFreeTalkHistory = (figureId: string): ConversationMessage[] => {
  const storageKey = STORAGE_KEYS.getFreeTalkHistory(figureId);
  const history = LocalStorageAdapter.getString(storageKey);
  if (!history) return [];
  
  try {
    const parsed = JSON.parse(history);
    if (!Array.isArray(parsed)) return [];
    
    return parsed
      .filter((msg: any) => {
        // Ensure message has both role and content
        return msg && 
               msg.role && 
               msg.content && 
               typeof msg.content === 'string' &&
               msg.content.trim().length > 0;
      })
      .map((msg: any) => ({
        role: (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant',
        content: String(msg.content).trim()
      }));
  } catch (e) {
    console.warn('Failed to parse free talk history:', e);
    return [];
  }
};

// ============================================
// Main Export
// ============================================

/**
 * Context collection based on conversation mode
 */
export const getContextForMode = (
  mode: string,
  figureId: string,
  seedId?: string | number
): ConversationMessage[] => {
  
  switch (mode) {
    case INSTRUCTION_MODES.INTRODUCTION:
    case INSTRUCTION_MODES.STORY:
      // Story mode has no conversation context
      return [];
      
    case INSTRUCTION_MODES.SEED_CONVERSATION:
      // Include story content + seed conversation history
      if (!seedId) return [];
      
      const seedIdStr = String(seedId);
      const storyContent = getStoredStoryContent(figureId, seedIdStr);
      const seedHistory = getSeedConversationHistory(figureId, seedIdStr);
      
      // Handle story content that might be wrapped in an array or corrupted
      let storyMessage: any = null;
      
      if (Array.isArray(storyContent) && storyContent.length > 0) {
        // Story content is an array, checking for corruption
        const firstElement = storyContent[0];
        
        // If it's a user message with the seed conversation prompt, it's corrupted
        if (firstElement?.role === 'user' && firstElement?.content?.includes('Lass uns sprechen')) {
          // Story content is corrupted, ignoring
          storyMessage = null;
        } else {
          storyMessage = firstElement;
        }
      } else if (storyContent && typeof storyContent === 'object') {
        // Story content is an object (the normal case from getStoredStoryContent)
        storyMessage = storyContent;
      }
      
      // Validate story content is a proper message object
      if (storyMessage && 
          storyMessage.role && 
          storyMessage.content && 
          typeof storyMessage.content === 'string' &&
          storyMessage.content.trim().length > 0) {
        // Ensure role is valid (only user or assistant allowed)
        const validRole = storyMessage.role === 'user' ? 'user' : 'assistant';
        
        // Create a valid message from story content
        const validStoryMessage: ConversationMessage = {
          role: validRole,
          content: String(storyMessage.content).trim()
        };
        // Including valid story content in StarSeed context
        const prismMsg = getPrismContext(figureId, seedIdStr);
        return prismMsg
          ? [validStoryMessage, prismMsg, ...seedHistory]
          : [validStoryMessage, ...seedHistory];
      }

      // Return seed history with prism context if available
      const prismMsgNoStory = getPrismContext(figureId, seedIdStr);
      return prismMsgNoStory
        ? [prismMsgNoStory, ...seedHistory]
        : seedHistory;
      
    case INSTRUCTION_MODES.CHALLENGE: {
      // Challenge history + prism context for this seed
      if (!seedId) return [];
      const challengeSeedId = String(seedId);
      const challengeHistory = getChallengeHistory(figureId, challengeSeedId);
      const challengePrism = getPrismContext(figureId, challengeSeedId);
      return challengePrism
        ? [challengePrism, ...challengeHistory]
        : challengeHistory;
    }
      
    case INSTRUCTION_MODES.FREE_CONVERSATION:
      // Global free talk history (no seed dependency)
      return getFreeTalkHistory(figureId);
      
    default:
      // Unknown mode for context
      return [];
  }
};
