/**
 * Voice System - 2025 Clean Architecture
 *
 * Unified export for voice management system.
 *
 * Usage:
 * - Normal mode: import { getVoiceForNormalMode } from './voices'
 * - Council mode: import { getVoicesForCouncil } from './voices'
 * - Preferences: import { loadVoicePreferences, saveVoicePreferences } from './voices'
 */

// Voice definitions
export * from './voiceDefinitions';

// Voice preferences: managed by Zustand voicePreferencesSlice (legacy file removed)

// Voice resolver
export * from './voiceResolver';
