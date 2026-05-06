import { ConversationMode } from '../types/global';

// Canonical set for the app: we support 5 visible modes in UI.
// "story" is treated as a legacy alias of "introduction".
const CANONICAL: Record<string, ConversationMode> = {
  introduction: ConversationMode.INTRODUCTION,
  story: ConversationMode.INTRODUCTION, // legacy alias → normalize to introduction
  prism: ConversationMode.PRISM,
  seed_conversation: ConversationMode.SEED_CONVERSATION,
  challenge: ConversationMode.CHALLENGE,
  free_conversation: ConversationMode.FREE_CONVERSATION,
};

export const normalizeMode = (
  mode: ConversationMode | string | null | undefined
): ConversationMode => {
  if (!mode) return ConversationMode.INTRODUCTION;
  const key = String(mode).toLowerCase();
  return CANONICAL[key] ?? ConversationMode.INTRODUCTION;
};

export const isConversationMode = (
  mode: ConversationMode | string | null | undefined
): boolean => {
  const m = normalizeMode(mode);
  return (
    m === ConversationMode.SEED_CONVERSATION ||
    m === ConversationMode.CHALLENGE ||
    m === ConversationMode.FREE_CONVERSATION
  );
};

