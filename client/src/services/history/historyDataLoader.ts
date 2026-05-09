// src/services/history/historyDataLoader.ts

import { STORAGE_KEYS, getStoredStoryContent, isStoryCompleted, getStoredPrismContent, isPrismCompleted } from '../../utils/storageKeysV2';
import { LocalStorageAdapter } from '../../storage/localAdapter';
import { readIndexedDbConversationEntries } from './historyStorageUtils';
import { Figure } from '../../types/global';

interface LoadHistoryOptions {
  signal?: AbortSignal;
}

/**
 * Load all history data for a figure
 */
export const loadHistoryData = async (selectedFigure: Figure, options: LoadHistoryOptions = {}) => {
  const { signal } = options;
  const assertNotAborted = () => {
    if (signal?.aborted) {
      throw new DOMException('History load aborted', 'AbortError');
    }
  };

  const historiesData: Record<string, any> = {};
  const figureId = selectedFigure.id;

  // Collect all seeds from new format keys only
  const seedIds = new Set<string | number>();
  
  // Find all mode-specific keys for this figure
  assertNotAborted();
  const allKeys = LocalStorageAdapter.keys();
  const figureKeys = allKeys.filter(k =>
    (k.startsWith('story_') ||
     k.startsWith('prism_content_') ||
     k.startsWith('prism_') ||
     k.startsWith('starseed_') ||
     k.startsWith('challenge_') ||
     k.startsWith('summary_')) &&
    k.includes(`_${figureId}_`)
  );
  
  // Extract seed IDs from mode keys
  const extractSeedId = (key: string): string | null => {
    const storyContentPrefix = `story_content_${figureId}_`;
    if (key.startsWith(storyContentPrefix)) {
      return key.slice(storyContentPrefix.length);
    }

    const storyCompletedPrefix = `story_${figureId}_`;
    if (key.startsWith(storyCompletedPrefix) && key.endsWith('_completed')) {
      return key.slice(storyCompletedPrefix.length, -'_completed'.length);
    }

    const prismContentPrefix = `prism_content_${figureId}_`;
    if (key.startsWith(prismContentPrefix)) {
      return key.slice(prismContentPrefix.length);
    }

    const prismCompletedPrefix = `prism_${figureId}_`;
    if (key.startsWith(prismCompletedPrefix) && key.endsWith('_completed')) {
      return key.slice(prismCompletedPrefix.length, -'_completed'.length);
    }

    const starseedPrefix = `starseed_${figureId}_`;
    if (key.startsWith(starseedPrefix)) {
      return key.slice(starseedPrefix.length);
    }

    const challengePrefix = `challenge_${figureId}_`;
    if (key.startsWith(challengePrefix)) {
      return key.slice(challengePrefix.length);
    }

    const summaryPrefix = `summary_${figureId}_`;
    if (key.startsWith(summaryPrefix)) {
      return key.slice(summaryPrefix.length);
    }

    return null;
  };

  figureKeys.forEach((key) => {
    const seedId = extractSeedId(key);
    if (seedId) {
      seedIds.add(seedId);
    }
  });
  
  // For each seed, collect all mode data
  seedIds.forEach(seedId => {
    assertNotAborted();
    const seedData: { seedId: string | number; messages: any[] } = {
      seedId,
      messages: []
    };
    
    // Check for story content
    const storyContent = getStoredStoryContent(figureId, seedId);
    if (storyContent) {
      const isCompleted = isStoryCompleted(figureId, seedId);
      
      // Add story to messages for display
      seedData.messages.push({
        mode: 'introduction',
        role: 'assistant',
        content: storyContent.content || storyContent,
        completed: isCompleted
      });
    }
    
    // Check for prism content
    const prismContent = getStoredPrismContent(figureId, seedId);
    if (prismContent) {
      const prismCompleted = isPrismCompleted(figureId, seedId);
      seedData.messages.push({
        mode: 'prism',
        role: 'assistant',
        content: prismContent.content || prismContent,
        completed: prismCompleted,
        timestamp: prismContent.timestamp
      });
    }

    // Check for starseed conversations
    const starseedKey = STORAGE_KEYS.getStarSeedHistory(figureId, seedId);
    assertNotAborted();
    const starseedHistory = LocalStorageAdapter.getString(starseedKey);
    if (starseedHistory) {
      try {
        const messages = JSON.parse(starseedHistory);
        messages.forEach((msg: any) => {
          if (msg.content && msg.content.trim()) {
            // Add to messages with mode tag
            seedData.messages.push({
              ...msg,
              mode: 'seed_conversation'
            });
          }
        });
      } catch (e) {
        // Parse error
      }
    }
    
    // Check for challenge conversations  
    const challengeKey = STORAGE_KEYS.getChallengeHistory(figureId, seedId);
    assertNotAborted();
    const challengeHistory = LocalStorageAdapter.getString(challengeKey);
    if (challengeHistory) {
      try {
        const messages = JSON.parse(challengeHistory);
        messages.forEach((msg: any) => {
          if (msg.content && msg.content.trim()) {
            // Add to messages with mode tag
            seedData.messages.push({
              ...msg,
              mode: 'challenge'
            });
          }
        });
      } catch (e) {
        // Parse error
      }
    }
    
    // Check for summary metadata
    const summaryKey = `summary_${figureId}_${seedId}`;
    assertNotAborted();
    const summaryData = LocalStorageAdapter.getString(summaryKey);
    if (summaryData) {
      try {
        const summary = JSON.parse(summaryData);
        
        // Add summary to messages if it exists
        if (summary.content) {
          seedData.messages.push({
            role: 'assistant',
            content: summary.content,
            mode: 'summary',
            timestamp: summary.timestamp
          });
        }
      } catch (e) {
        // Parse error
      }
    }
    
    // Sort messages by timestamp if available
    seedData.messages.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      return 0;
    });
    
    if (seedData.messages.length > 0) {
      historiesData[seedId] = seedData;
    }
  });
  
  // Check for FreeTalk (global, no seed)
  const freeTalkKey = STORAGE_KEYS.getFreeTalkHistory(figureId);
  assertNotAborted();
  const freeTalkHistory = LocalStorageAdapter.getString(freeTalkKey);

  if (freeTalkHistory) {
    try {
      const messages = JSON.parse(freeTalkHistory);
      if (messages.length > 0) {
        const freeTalkData = {
          seedId: 'freetalk',
          messages: messages.map((msg: any) => ({
            ...msg,
            mode: 'free_conversation'
          }))
        };
        
        historiesData['freetalk'] = freeTalkData;
      }
    } catch (e) {
      // Parse error
    }
  }

  await mergeIndexedDbHistories({
    figureId,
    historiesData,
    assertNotAborted,
  });

  return historiesData;
};

const mergeIndexedDbHistories = async ({
  figureId,
  historiesData,
  assertNotAborted,
}: {
  figureId: string;
  historiesData: Record<string, any>;
  assertNotAborted: () => void;
}) => {
  const conversationEntries = await readIndexedDbConversationEntries();

  for (const entry of conversationEntries) {
    assertNotAborted();

    const info = normalizeHistoryKey(entry.key, figureId);

    if (!info) {
      continue;
    }

    const normalizedMessages = entry.messages
      .filter((message) => typeof message.content === 'string' && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
        mode: info.mode,
        timestamp: message.timestamp,
      }));

    if (normalizedMessages.length === 0) {
      continue;
    }

    const existing = historiesData[info.seedId] ?? {
      seedId: info.seedId,
      messages: [] as any[],
    };

    const filteredExisting = (existing.messages ?? []).filter((message: any) => message.mode !== info.mode);

    historiesData[info.seedId] = {
      ...existing,
      seedId: info.seedId,
      messages: [...filteredExisting, ...normalizedMessages].sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        }
        return 0;
      }),
    };
  }
};

const normalizeHistoryKey = (
  key: string,
  figureId: string
): { seedId: string; mode: string } | null => {
  const freeTalkKey = STORAGE_KEYS.getFreeTalkHistory(figureId);
  if (key === freeTalkKey) {
    return { seedId: 'freetalk', mode: 'free_conversation' };
  }

  const starSeedPrefix = `starseed_${figureId}_`;
  if (key.startsWith(starSeedPrefix)) {
    return { seedId: key.slice(starSeedPrefix.length), mode: 'seed_conversation' };
  }

  const challengePrefix = `challenge_${figureId}_`;
  if (key.startsWith(challengePrefix)) {
    return { seedId: key.slice(challengePrefix.length), mode: 'challenge' };
  }

  return null;
};

/**
 * Helper to extract seed titles
 */
export const getSeedTitle = (seedId: string, selectedFigure: Figure, getTranslatedSeedTitle: (figureId: string, seedId: string) => string | null) => {
  // Handle special case for freetalk
  if (seedId === 'freetalk') {
    return 'FreeTalk';
  }
  
  // Extract the numeric part of the seed ID
  let numericId = seedId;
  if (seedId.includes('-')) {
    const parts = seedId.split('-');
    numericId = parts[parts.length - 1];
  }
  
  // Get title from translation system
  const translatedTitle = getTranslatedSeedTitle(selectedFigure.id, numericId);
  
  if (translatedTitle) {
    // If the title starts with the figure name (e.g., "Hildegard von Bingen - "), remove it
    const figurePrefix = `${selectedFigure.name} - `;
    if (translatedTitle.startsWith(figurePrefix)) {
      return translatedTitle.substring(figurePrefix.length);
    }
    // Otherwise return the full title
    return translatedTitle;
  }
  
  // Fallback to just the number if no translation found
  return `Seed ${numericId}`;
};
