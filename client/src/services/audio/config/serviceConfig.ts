// src/services/audio/config/serviceConfig.ts

// Architecture: Self-hosted audio (GEX130) + OpenRouter BYOK / Nebius free-tier
import { useDomainStore } from '../../../stores';
import { isSelfHost } from '../../../config/deployment';

// ============================================
// Type Definitions
// ============================================

export interface TTSSettings {
  speed: number;
  model: 'tts-1'; // Legacy field, kept for compat. Server handles model selection.
}

export interface LLMConfig {
  provider: string;
  model: string;
  zdr?: boolean; // Zero Data Retention: routes to ZDR-compliant providers only (OpenRouter BYOK)
}

export interface ServiceConfig {
  stt: string;
  sttEnabled: boolean;
  tts: string;
  ttsSettings: TTSSettings;
  ttsEnabled: boolean;
  llm: LLMConfig;
}

interface LLMServiceDefinition {
  name: string;
  models: Record<string, string>;
  displayNames: Record<string, string>;
}

// ============================================
// Constants
// ============================================

// Audio: Always self-hosted on GEX130 (api.agoracosmica.org)
export const TTS_SERVICES = {
  SELF_HOSTED: 'self-hosted',
  // Legacy aliases for migration (existing configs may reference these)
  DEEPINFRA: 'self-hosted',
  OPENAI: 'self-hosted'
} as const;

export const STT_SERVICES = {
  SELF_HOSTED: 'self-hosted',
  // Legacy aliases for migration
  DEEPINFRA: 'self-hosted',
  OPENAI: 'self-hosted'
} as const;

// LLM: OpenRouter for BYOK, Nebius for free-tier (via CF Worker proxy)
export const LLM_SERVICES: Record<string, LLMServiceDefinition> = {
  OPENROUTER: {
    name: 'openrouter',
    models: {
      QWEN3_235B: 'qwen/qwen3-235b-a22b-2507',
    },
    displayNames: {
      'qwen/qwen3-235b-a22b-2507': 'Qwen3 235B',
    }
  }
};

// Default configuration
export const defaultConfig: ServiceConfig = {
  // Speech-to-Text: always self-hosted on GEX130
  stt: STT_SERVICES.SELF_HOSTED,
  sttEnabled: true,

  // Text-to-Speech: always self-hosted on GEX130 (server handles language/model routing)
  tts: TTS_SERVICES.SELF_HOSTED,
  ttsSettings: {
    speed: 1.00,
    model: 'tts-1', // Legacy field, server handles model selection
  },
  ttsEnabled: true,

  // Language Model: OpenRouter BYOK, falls back to free-tier proxy
  llm: {
    provider: LLM_SERVICES.OPENROUTER.name,
    model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B
  }
};

// ============================================
// Validation Helpers
// ============================================

const validateTTSSettings = (settings: Partial<TTSSettings> = {}): TTSSettings => {
  const speed = parseFloat(String(settings.speed)) || 1.00;
  return {
    speed: Math.min(Math.max(speed, 0.8), 1.3),
    model: 'tts-1' // Always use tts-1 (multilingual, cost-effective)
  };
};

// ============================================
// Main Functions
// ============================================

// Re-entrance guard to prevent infinite loops
let isLoadingConfig = false;

// Load configuration from localStorage
export const loadServiceConfig = (): ServiceConfig => {
  // Prevent re-entrance - if already loading, return current config from store
  if (isLoadingConfig) {
    console.warn('[Config] Prevented re-entrant call to loadServiceConfig');
    const existingConfig = useDomainStore.getState().serviceConfig.parsed as ServiceConfig | null;
    return existingConfig || defaultConfig;
  }

  isLoadingConfig = true;

  try {
    const savedConfig = useDomainStore.getState().serviceConfig.raw;

    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig) as Partial<ServiceConfig>;

      // Validate and merge with defaults
      const config: ServiceConfig = {
        ...defaultConfig,
        ...parsedConfig,
        // TTS/STT: always self-hosted on GEX130 (legacy values map to 'self-hosted' via aliases)
        tts: TTS_SERVICES.SELF_HOSTED,
        stt: STT_SERVICES.SELF_HOSTED,
        ttsSettings: validateTTSSettings(parsedConfig.ttsSettings),
        sttEnabled: parsedConfig.sttEnabled !== false
      };

      // LLM: Migrate legacy DeepInfra provider to OpenRouter
      if (config.llm.provider !== LLM_SERVICES.OPENROUTER.name) {
        config.llm.provider = LLM_SERVICES.OPENROUTER.name;
        config.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
        // Defer save to prevent infinite loops during render
        queueMicrotask(() => saveServiceConfig(config));
      }

      // Validate model is a known OpenRouter model
      const validModels = Object.values(LLM_SERVICES.OPENROUTER.models);
      if (!validModels.includes(config.llm.model)) {
        config.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
        // Defer save to prevent infinite loops during render
        queueMicrotask(() => saveServiceConfig(config));
      }

      // DEV override: ensure TTS is enabled during development to avoid
      // silent failures due to stale mobile defaults stored in localStorage.
      if (import.meta.env.DEV && config.ttsEnabled === false) {
        config.ttsEnabled = true;
        // Defer to prevent infinite loops during render
        queueMicrotask(() => {
          try {
            const configStr = JSON.stringify(config);
            useDomainStore.getState().setServiceConfig({
              raw: configStr,
              parsed: config
            });
          } catch {}
        });
      }

      return isSelfHost
        ? { ...config, ttsEnabled: false, sttEnabled: false }
        : config;
    }
  } catch (error) {
    console.error('Error loading service config:', error);
  } finally {
    // Always reset the loading flag
    isLoadingConfig = false;
  }

  return isSelfHost
    ? { ...defaultConfig, ttsEnabled: false, sttEnabled: false }
    : defaultConfig;
};

// Save configuration to localStorage
export const saveServiceConfig = (config: Partial<ServiceConfig>): boolean => {
  try {
    // Validate config before saving
    const validatedConfig: ServiceConfig = {
      ...defaultConfig,
      ...config,
      ttsSettings: validateTTSSettings(config.ttsSettings)
    };

    // Update Zustand (which will also persist to localStorage via adapter)
    const configStr = JSON.stringify(validatedConfig);
    useDomainStore.getState().setServiceConfig({
      raw: configStr,
      parsed: validatedConfig
    });

    return true;
  } catch (error) {
    console.error('Error saving service config:', error);
    return false;
  }
};

// Helper for getting model display names
export const getModelDisplayName = (provider: string, modelId: string): string => {
  if (provider === 'openrouter') {
    return LLM_SERVICES.OPENROUTER.displayNames[modelId] || modelId;
  }
  return modelId;
};
