import { getAllKeysFromStore, getFromStore, type WalOperation } from '../../storage';

export const HISTORY_STORE_NAME = 'history' as const;

const CONVERSATION_KEY_PREFIXES = ['starseed_', 'challenge_', 'freetalk_'] as const;

type ConversationKeyPrefix = (typeof CONVERSATION_KEY_PREFIXES)[number];

export interface PersistedConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ConversationHistoryEntry {
  key: string;
  messages: PersistedConversationMessage[];
}

export const isConversationHistoryKey = (key: string): boolean =>
  CONVERSATION_KEY_PREFIXES.some((prefix: ConversationKeyPrefix) => key.startsWith(prefix));

const sanitizeMessage = (message: unknown): PersistedConversationMessage | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const record = message as Record<string, unknown>;
  const rawContent = record.content;

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    return null;
  }

  const sanitized: PersistedConversationMessage = {
    role: typeof record.role === 'string' ? record.role : 'user',
    content: rawContent,
  };

  if (typeof record.timestamp === 'string' && record.timestamp.length > 0) {
    sanitized.timestamp = record.timestamp;
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'role' || key === 'content' || key === 'timestamp') {
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
};

export const readIndexedDbConversationEntries = async (): Promise<ConversationHistoryEntry[]> => {
  const conversationEntries: ConversationHistoryEntry[] = [];
  let keys: string[] = [];

  try {
    keys = await getAllKeysFromStore(HISTORY_STORE_NAME);
  } catch (error) {
    console.warn('[historyStorageUtils] Unable to read keys from IndexedDB history store', error);
    return conversationEntries;
  }

  for (const key of keys) {
    if (typeof key !== 'string' || !isConversationHistoryKey(key)) {
      continue;
    }

    try {
      const rawMessages = await getFromStore<unknown[]>(HISTORY_STORE_NAME, key);
      if (!Array.isArray(rawMessages)) {
        continue;
      }

      const sanitized = rawMessages
        .map(sanitizeMessage)
        .filter((message): message is PersistedConversationMessage => Boolean(message));

      if (sanitized.length === 0) {
        continue;
      }

      conversationEntries.push({ key, messages: sanitized });
    } catch (error) {
      console.warn(`[historyStorageUtils] Failed to read or sanitise IndexedDB history for key ${key}`, error);
    }
  }

  return conversationEntries;
};

export const buildWalOperationsFromModeData = (
  modeData: Record<string, string | null | undefined>
): WalOperation[] => {
  const operations: WalOperation[] = [];

  for (const [key, rawValue] of Object.entries(modeData)) {
    if (!isConversationHistoryKey(key) || typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        continue;
      }

      operations.push({ type: 'put', store: HISTORY_STORE_NAME, key, value: parsed });
    } catch (error) {
      console.warn(`[historyStorageUtils] Failed to parse conversation payload for key ${key}`, error);
    }
  }

  return operations;
};

export const createClearHistoryWalOperation = (): WalOperation => ({
  type: 'clear',
  store: HISTORY_STORE_NAME,
});
