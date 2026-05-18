// Global Type Definitions for Agora Cosmica
// Core types used throughout the application

// ============================================
// Core Domain Types
// ============================================

/**
 * Represents a philosophical figure (historical personality)
 */
export interface Figure {
  id: string; // e.g., 'plato', 'aurelius'
  name: string; // Display name
  about?: string; // Description
  learn?: string; // Golden line: "You will learn to ..." (figure page revision)
  image?: string; // Avatar path
  topic?: string; // Main topics/themes
  metadata?: FigureMetadata;
}

export interface FigureMetadata {
  tradition?: string;
  category?: string;
  historicalPeriod?: string;
  primaryWorks?: string[];
  figureRating?: number;
  catalogValue?: string;
}

/**
 * Represents a wisdom seed (a piece of philosophical wisdom)
 * Supports both v1.0 (legacy) and v3.0 (current) formats
 */
export interface Seed {
  // ========== Core Fields ==========
  id: number | string; // Can be number or string based on context
  title: string;
  quote?: string;
  difficulty?: number;

  // ========== v3.0 Fields ==========
  version?: string; // "3.0" for new format
  lastRevised?: string; // ISO date string
  summary?: string; // 2-3 sentence overview
  tags?: string[]; // User-facing tags for navigation
  overview?: {
    concept: string; // What it is
    context: string; // Historical background
    relevance: string; // Why it matters today
  };
  coreInsights?: string[]; // Key takeaways (replaces importance)
  outcomes?: string[]; // What you'll gain from engaging with this seed
  connections?: SeedConnection[]; // Flat array: 1 foundation + 1 expansion + 1 tension
  sources?: {
    primary?: string[]; // Primary source texts
    secondary?: string[]; // Secondary sources
    furtherReading?: FurtherReadingSource[]; // Recommended books/articles
  };
  practicalSuggestion?: string; // Practice instructions (v3.0 naming)
  llmContext?: {
    teachingHints?: string[];
    commonMisconceptions?: string[];
    conversationPrompts?: string[];
    adaptationGuidance?: Record<string, string>;
  };

  // ========== v1.0 Legacy Fields (backward compatibility) ==========
  description?: string;
  subtitle?: string;
  practiceType?: string;
  practice?: string; // Old practice field
  canonicalSource?: string; // Old single-source field
  whySelected?: string[];
  importance?: string[]; // Old insights field
  wisdomConnections?: WisdomConnection[]; // Old connection format

  // ========== Translation & Runtime ==========
  titleKey?: string; // For dynamic translations
  figureId?: string; // Reference to parent figure
  gathered?: boolean; // Whether user has gathered this seed
  name?: string; // Alternative name property for backwards compatibility
}

/**
 * v4.0 Seed Connection — Pedagogical Triad
 * Each seed has exactly 3 connections: 1 foundation + 1 expansion + 1 tension
 */
export interface SeedConnection {
  figure: string; // Lowercase figure ID
  seed: number; // Seed ID
  seedTitle?: string; // Full seed title
  relationship: string; // Brief description of relationship
  type: 'foundation' | 'expansion' | 'tension'; // Pedagogical role
  featured?: boolean; // The most compelling connection shown on the seed card
  strength?: number; // 0-1 strength score
  summary?: string; // Short explanation
  explanation: string; // Full explanation
}

/**
 * v3.0 Further Reading Source
 */
export interface FurtherReadingSource {
  title: string;
  author?: string;
  year?: number;
  type?: 'biography' | 'primary source' | 'scholarly analysis' | 'commentary';
}

/**
 * v1.0 Wisdom Connection (legacy format)
 */
export interface WisdomConnection {
  figure: string;
  seed: number;
  title: string;
  relationship?: string;
  explanation?: string;
}

/**
 * Seed collection for a figure
 */
export interface SeedCollection {
  figure: string;
  topic?: string;
  metadata?: FigureMetadata;
  seeds: Seed[];
}

/**
 * Story (generated narrative from a seed)
 */
export interface Story {
  id: string;
  title: string;
  figureId: string;
  seedId: string;
  duration?: number;
  type?: string;
  language?: string;
  hasAudio?: boolean;
  content?: string;
  timestamp?: string;
  [key: string]: any; // Allow additional properties for flexibility
}

// ============================================
// Conversation & Mode Types
// ============================================

/**
 * Available conversation modes
 */
export enum ConversationMode {
  STORY = 'story',
  INTRODUCTION = 'introduction',
  PRISM = 'prism',
  SEED_CONVERSATION = 'seed_conversation',
  FREE_CONVERSATION = 'free_conversation',
  CHALLENGE = 'challenge'
}

/**
 * Message in a conversation
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  figureId?: string;
  seedId?: string | number;
  mode?: ConversationMode;
  // Hidden messages are used for synthetic prompts that should not render in the UI
  hidden?: boolean;
}

/**
 * Conversation history
 */
export interface ConversationHistory {
  messages: Message[];
  figureId: string;
  seedId?: string | number;
  mode: ConversationMode;
  lastUpdated?: string;
}

// ============================================
// User & Settings Types
// ============================================

/**
 * User profile information
 */
export interface User {
  id?: string;
  email?: string;
  name?: string;
  preferredLanguage?: Language;
  settings?: UserSettings;
  createdAt?: string;
  lastLogin?: string;
}

/**
 * User settings and preferences
 */
export interface UserSettings {
  language: Language;
  theme?: 'light' | 'dark' | 'cosmic';
  fontSize?: 'small' | 'medium' | 'large';
  autoplay?: boolean;
  soundEnabled?: boolean;
  hapticFeedback?: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
  liquidGlass?: boolean;
  enableAnimations?: boolean;
  showSubtitles?: boolean;
  voiceGender?: 'male' | 'female' | 'neutral';
  speechRate?: number; // 0.5 to 2.0
}

// ============================================
// Language & Translation Types
// ============================================

/**
 * Supported languages
 */
export type Language = 'en' | 'de';

/**
 * Translation keys and content
 * Supports nested objects, strings, and arrays
 */
export interface Translation {
  [key: string]: string | Translation | string[] | Translation[];
}

/**
 * UI translations structure
 */
export interface UITranslations {
  [key: string]: Translation;
}

// ============================================
// API Types
// ============================================

/**
 * API Provider types
 */
export type APIProvider = 'OPENROUTER' | 'NEBIUS';

/**
 * API configuration
 */
export interface APIConfig {
  provider: APIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Standard API response
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
}

// ============================================
// Storage Types
// ============================================

/**
 * Storage keys structure
 */
export interface StorageKeys {
  USER_PREFERENCES: string;
  LANGUAGE_PREFERENCE: string;
  CONVERSATION_HISTORY: string;
  MODE_STATE: string;
  FIGURE_SELECTION: string;
  SEED_SELECTION: string;
  FIRST_VISIT: string;
  ONBOARDING_COMPLETE: string;
  [key: string]: string;
}

// ============================================
// Audio Types
// ============================================

/**
 * Audio service configuration
 */
export interface AudioConfig {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: Language;
}

/**
 * Audio queue item
 */
export interface AudioQueueItem {
  text: string;
  voiceId?: string;
  priority?: number;
  callback?: () => void;
}

// ============================================
// Council Types (for Cosmic Council feature)
// ============================================

/**
 * Council configuration
 */
export interface Council {
  id?: string;
  name: string;
  description?: string;
  figures: string[]; // Array of figure IDs
  topic?: string;
  createdAt?: string;
  isCustom?: boolean;
  isCurated?: boolean;
}

/**
 * Council dialogue turn
 */
export interface CouncilTurn {
  figure: string;
  content: string;
  type?: 'opening' | 'response' | 'closing';
  timestamp?: string;
}

// ============================================
// Mode State Types
// ============================================

/**
 * Mode state for persistence
 */
export interface ModeState {
  mode: ConversationMode;
  timestamp: string;
  figureId?: string;
  seedId?: string | number;
}

// ============================================
// Component Props Types (Common patterns)
// ============================================

/**
 * Common modal props
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Common button props
 */
export interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
  type?: 'button' | 'submit' | 'reset';
}

// ============================================
// Utility Types
// ============================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract keys of specific type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper
 */
export type Optional<T> = T | undefined;

// ============================================
// Event Types
// ============================================

/**
 * Custom event emitter events
 */
export interface AppEvents {
  figureChanged: { figureId: string };
  seedSelected: { seedId: string | number; figureId: string };
  modeChanged: { mode: ConversationMode };
  languageChanged: { language: Language };
  conversationStarted: { figureId: string; mode: ConversationMode };
  conversationEnded: { figureId: string; mode: ConversationMode };
  audioStarted: { text: string };
  audioEnded: void;
  errorOccurred: { error: Error; context?: string };
}

// ============================================
// Validation Types
// ============================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  data?: any;
}

// ============================================
// Performance Types
// ============================================

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps?: number;
  memory?: number;
  loadTime?: number;
  renderTime?: number;
  apiLatency?: number;
}

// ============================================
// Re-export for convenience
// ============================================

export type {
  Figure as FigureType,
  Seed as SeedType,
  Message as MessageType,
  User as UserType,
  Council as CouncilType
};
