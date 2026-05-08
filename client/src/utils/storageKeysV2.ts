// Storage key management for the new architecture
// This separates different conversation modes into distinct storage spaces

import { ConversationMode } from '../types/global';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { sendPlaybackBeacon, detectCurrentLanguage } from './playbackBeacon';

/**
 * Storage key generators for different conversation contexts
 */
export const STORAGE_KEYS = {
  // Story content and completion state - using figure ID for consistency
  // Always convert seedId to string to ensure consistency
  getStoryContent: (figureId: string, seedId: string | number): string => 
    `story_content_${figureId}_${String(seedId)}`,
  
  getStoryCompleted: (figureId: string, seedId: string | number): string => 
    `story_${figureId}_${String(seedId)}_completed`,
  
  // StarSeed conversations (includes story context) - using figure ID for consistency
  getStarSeedHistory: (figureId: string, seedId: string | number): string =>
    `starseed_${figureId}_${String(seedId)}`,

  // Wisdom mode completion marker (set when seed_conversation reaches the depth threshold).
  // Mirrors the story/prism completion key shape so the bloom event flow works the same way.
  getWisdomCompleted: (figureId: string, seedId: string | number): string =>
    `starseed_${figureId}_${String(seedId)}_completed`,
  
  // Challenge conversations (completely isolated) - using figure ID for consistency
  getChallengeHistory: (figureId: string, seedId: string | number): string => 
    `challenge_${figureId}_${String(seedId)}`,
  
  // Prism content and completion state - using figure ID for consistency
  getPrismContent: (figureId: string, seedId: string | number): string =>
    `prism_content_${figureId}_${String(seedId)}`,

  getPrismCompleted: (figureId: string, seedId: string | number): string =>
    `prism_${figureId}_${String(seedId)}_completed`,

  // Council content and completion state
  getCouncilContent: (councilId: string): string =>
    `council_content_${councilId}`,

  getCouncilCompleted: (councilId: string): string =>
    `council_${councilId}_completed`,

  // FreeTalk conversations (global per figure, no seed) - using figure ID for consistency
  getFreeTalkHistory: (figureId: string): string =>
    `freetalk_${figureId}`
};

/**
 * Get the appropriate storage key based on conversation mode
 */
export const getStorageKeyForMode = (
  mode: ConversationMode | string, 
  figureId: string, 
  seedId?: string | number
): string | null => {
  switch (mode) {
    case ConversationMode.INTRODUCTION:
    case ConversationMode.STORY:
    case 'introduction':
    case 'story':
      if (!seedId) return null;
      return STORAGE_KEYS.getStoryContent(figureId, seedId);

    case ConversationMode.SEED_CONVERSATION:
    case 'seed_conversation':
      if (!seedId) return null;
      return STORAGE_KEYS.getStarSeedHistory(figureId, seedId);

    case ConversationMode.CHALLENGE:
    case 'challenge':
      if (!seedId) return null;
      return STORAGE_KEYS.getChallengeHistory(figureId, seedId);
      
    case ConversationMode.FREE_CONVERSATION:
    case 'free_conversation':
      return STORAGE_KEYS.getFreeTalkHistory(figureId);

    case ConversationMode.PRISM:
    case 'prism':
      return null; // Prism uses pre-generated content, no conversation storage

    default:
      console.warn(`Unknown mode: ${mode}`);
      return null;
  }
};

/**
 * Story content structure stored in localStorage
 */
interface StoryContent {
  role: 'assistant';
  content: string;
  isStory: boolean;
  timestamp: string;
}

/**
 * Helper to check if a story has been completed
 */
export const isStoryCompleted = (figureId: string, seedId: string | number): boolean => {
  const key = STORAGE_KEYS.getStoryCompleted(figureId, seedId);
  return LocalStorageAdapter.getString(key) === 'true';
};

/**
 * Helper to mark a story as completed.
 * Idempotent — safe to call repeatedly; only the first completion mutates state,
 * fires the gamification event, and emits the analytics beacon.
 */
export const markStoryCompleted = (figureId: string, seedId: string | number): void => {
  if (isStoryCompleted(figureId, seedId)) return;
  const key = STORAGE_KEYS.getStoryCompleted(figureId, seedId);
  LocalStorageAdapter.setString(key, 'true');
  // Prismatic Bloom: notify that a mode was completed
  window.dispatchEvent(new CustomEvent('bloomModeCompleted', { detail: { figureId } }));
  // Anonymous content-completion analytics beacon
  sendPlaybackBeacon({ type: 'story', figureId, mode: 'story', language: detectCurrentLanguage() });
};

/**
 * Helper to check if a seed_conversation (Wisdom) has reached the depth threshold.
 * Marker-based — set once by markWisdomCompleted when message count crosses 30.
 */
export const isWisdomCompleted = (figureId: string, seedId: string | number): boolean => {
  const key = STORAGE_KEYS.getWisdomCompleted(figureId, seedId);
  return LocalStorageAdapter.getString(key) === 'true';
};

/**
 * Helper to mark a Wisdom seed as completed and fire the bloom event.
 * Idempotent — call sites can fire-and-forget on every persist; only the first
 * call (when isWisdomCompleted returns false) actually mutates state and fires.
 */
export const markWisdomCompleted = (figureId: string, seedId: string | number): void => {
  if (isWisdomCompleted(figureId, seedId)) return;
  const key = STORAGE_KEYS.getWisdomCompleted(figureId, seedId);
  LocalStorageAdapter.setString(key, 'true');
  window.dispatchEvent(new CustomEvent('bloomModeCompleted', { detail: { figureId } }));
  // Anonymous content-completion analytics beacon
  sendPlaybackBeacon({ type: 'teaching', figureId, mode: 'wisdom', language: detectCurrentLanguage() });
};

/**
 * One-time backfill: scan IndexedDB for seed_conversation histories that have
 * already crossed the 30-message depth threshold and set their completion markers.
 * Needed because wisdom histories persist to IDB only — the localStorage-based
 * legacy length check in seedLevelComputation would never have flipped wisdomDone
 * for any conversation that went exclusively through the controller persistence path.
 *
 * Safe to call on every app load: marker writes are idempotent and bounded by
 * the BACKFILL_FLAG_KEY guard which short-circuits subsequent runs.
 */
const WISDOM_BACKFILL_FLAG_KEY = 'wisdom_markers_backfilled_v1';
export const backfillWisdomMarkers = async (): Promise<void> => {
  if (LocalStorageAdapter.getString(WISDOM_BACKFILL_FLAG_KEY) === 'true') return;
  try {
    const { readIndexedDbConversationEntries } = await import('../services/history/historyStorageUtils');
    const entries = await readIndexedDbConversationEntries();
    for (const entry of entries) {
      if (!entry.key.startsWith('starseed_')) continue;
      if (entry.messages.length < 30) continue;
      const rest = entry.key.slice('starseed_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore <= 0) continue;
      const figureId = rest.slice(0, lastUnderscore);
      const seedId = rest.slice(lastUnderscore + 1);
      if (figureId && seedId) {
        markWisdomCompleted(figureId, seedId);
      }
    }
    LocalStorageAdapter.setString(WISDOM_BACKFILL_FLAG_KEY, 'true');
  } catch (error) {
    console.warn('[storageKeysV2] backfillWisdomMarkers failed', error);
  }
};

/**
 * Helper to get stored story content
 */
export const getStoredStoryContent = (
  figureId: string, 
  seedId: string | number | null | undefined
): StoryContent | null => {
  if (!figureId || seedId === undefined || seedId === null) {
    console.warn('Missing figureId or seedId for story content retrieval');
    return null;
  }
  const key = STORAGE_KEYS.getStoryContent(figureId, seedId);
  const content = LocalStorageAdapter.getString(key);
  if (!content) return null;
  
  try {
    const parsed = JSON.parse(content);
    
    // Handle corrupted data - if it's an array with a user message, it's wrong
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].role === 'user') {
      console.error('⚠️ Story content is corrupted (contains user message), clearing it');
      LocalStorageAdapter.remove(key);
      return null;
    }
    
    return parsed as StoryContent;
  } catch (e) {
    console.error('Error parsing story content:', e);
    return null;
  }
};

/**
 * Helper to save story content
 */
export const saveStoryContent = (
  figureId: string,
  seedId: string | number | null | undefined,
  content: string
): void => {
  if (!figureId || seedId === undefined || seedId === null) {
    console.error('Cannot save story content without figureId and seedId');
    return;
  }
  const key = STORAGE_KEYS.getStoryContent(figureId, seedId);
  const storyData: StoryContent = {
    role: 'assistant',
    content: content,
    isStory: true,
    timestamp: new Date().toISOString()
  };
  LocalStorageAdapter.setJSON(key, storyData);
};

/**
 * Prism content structure stored in localStorage
 */
interface PrismContent {
  role: 'assistant';
  content: string;
  isPrism: boolean;
  timestamp: string;
}

/**
 * Helper to check if a prism has been completed
 */
export const isPrismCompleted = (figureId: string, seedId: string | number): boolean => {
  const key = STORAGE_KEYS.getPrismCompleted(figureId, seedId);
  return LocalStorageAdapter.getString(key) === 'true';
};

/**
 * Helper to mark a prism as completed.
 * Idempotent — only the first call mutates state, fires gamification, and emits
 * the analytics beacon.
 */
export const markPrismCompleted = (figureId: string, seedId: string | number): void => {
  if (isPrismCompleted(figureId, seedId)) return;
  const key = STORAGE_KEYS.getPrismCompleted(figureId, seedId);
  LocalStorageAdapter.setString(key, 'true');
  // Prismatic Bloom: notify that a mode was completed
  window.dispatchEvent(new CustomEvent('bloomModeCompleted', { detail: { figureId } }));
  // Anonymous content-completion analytics beacon
  sendPlaybackBeacon({ type: 'prism', figureId, mode: 'prism', language: detectCurrentLanguage() });
};

/**
 * Helper to get stored prism content
 */
export const getStoredPrismContent = (
  figureId: string,
  seedId: string | number | null | undefined
): PrismContent | null => {
  if (!figureId || seedId === undefined || seedId === null) {
    return null;
  }
  const key = STORAGE_KEYS.getPrismContent(figureId, seedId);
  const content = LocalStorageAdapter.getString(key);
  if (!content) return null;

  try {
    return JSON.parse(content) as PrismContent;
  } catch (e) {
    console.error('Error parsing prism content:', e);
    return null;
  }
};

/**
 * Helper to save prism content (transcript from manifest segments)
 */
export const savePrismContent = (
  figureId: string,
  seedId: string | number | null | undefined,
  content: string
): void => {
  if (!figureId || seedId === undefined || seedId === null) {
    console.error('Cannot save prism content without figureId and seedId');
    return;
  }
  const key = STORAGE_KEYS.getPrismContent(figureId, seedId);
  const prismData: PrismContent = {
    role: 'assistant',
    content: content,
    isPrism: true,
    timestamp: new Date().toISOString()
  };
  LocalStorageAdapter.setJSON(key, prismData);
};

/**
 * Council content structure stored in localStorage
 */
interface CouncilContent {
  role: 'assistant';
  content: string;
  isCouncil: boolean;
  timestamp: string;
}

/**
 * Helper to check if a council has been completed
 */
export const isCouncilCompleted = (councilId: string): boolean => {
  const key = STORAGE_KEYS.getCouncilCompleted(councilId);
  return LocalStorageAdapter.getString(key) === 'true';
};

/**
 * Helper to mark a council as completed.
 * Idempotent — only the first call mutates state and emits the analytics beacon.
 */
export const markCouncilCompleted = (councilId: string): void => {
  if (isCouncilCompleted(councilId)) return;
  const key = STORAGE_KEYS.getCouncilCompleted(councilId);
  LocalStorageAdapter.setString(key, 'true');
  // Anonymous content-completion analytics beacon. Council has no figure dimension
  // (multi-figure debate) — leave figureId empty.
  sendPlaybackBeacon({ type: 'council', mode: 'council', language: detectCurrentLanguage() });
};

/**
 * Helper to get stored council content
 */
export const getStoredCouncilContent = (councilId: string): CouncilContent | null => {
  if (!councilId) return null;
  const key = STORAGE_KEYS.getCouncilContent(councilId);
  const content = LocalStorageAdapter.getString(key);
  if (!content) return null;

  try {
    return JSON.parse(content) as CouncilContent;
  } catch (e) {
    console.error('Error parsing council content:', e);
    return null;
  }
};

/**
 * Helper to save council content (transcript from manifest segments)
 */
export const saveCouncilContent = (councilId: string, content: string): void => {
  if (!councilId) {
    console.error('Cannot save council content without councilId');
    return;
  }
  const key = STORAGE_KEYS.getCouncilContent(councilId);
  const councilData: CouncilContent = {
    role: 'assistant',
    content: content,
    isCouncil: true,
    timestamp: new Date().toISOString()
  };
  LocalStorageAdapter.setJSON(key, councilData);
};
