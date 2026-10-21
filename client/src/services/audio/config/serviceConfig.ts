// src/services/audio/config/serviceConfig.ts

// Architecture: Self-hosted audio (GEX130) + OpenRouter BYOK / Nebius free-tier
import { useDomainStore } from '../../../stores';
import { adoptSavedServiceConfig } from '../../../stores/serviceConfigSync';
import { isSelfHost } from '../../../config/deployment';
import { audioApiUrl } from '../../../config/runtime';

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
  /**
   * Local Mode addition: when set, the LLM call uses a configurable OpenAI-compatible
   * endpoint instead of OpenRouter. `provider` carries the kind ('openrouter' |
   * 'custom-openai'), `baseURL` is the custom endpoint root (e.g.
   * 'http://localhost:1234/v1'), and `model` is whatever identifier the local
   * server reports.
   */
  kind?: 'openrouter' | 'custom-openai';
  baseURL?: string;
}

export interface LocalModeConfig {
  /** LLM routes to a custom OpenAI-compatible endpoint instead of OpenRouter. */
  llmEnabled: boolean;
  /** TTS routes to local Kokoro (EN) + Qwen (DE) instead of the hosted gateway. */
  ttsEnabled: boolean;
  /** STT routes to local Whisper instead of the hosted gateway. */
  sttEnabled: boolean;
  /** Override URLs (optional, fall back to compose defaults). */
  ttsKokoroURL?: string;
  ttsQwenURL?: string;
  sttURL?: string;
  /** Legacy master toggle from v1.1.0-alpha shape, kept for one-pass migration only. */
  enabled?: boolean;
}

export interface ServiceConfig {
  stt: string;
  sttEnabled: boolean;
  tts: string;
  ttsSettings: TTSSettings;
  ttsEnabled: boolean;
  llm: LLMConfig;
  localMode?: LocalModeConfig;
  /**
   * Self-host builds: set by every save that keeps the visitor's own voice and
   * transcription switches. Earlier self-host builds saved a forced off instead.
   */
  ownAudioSwitches?: boolean;
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
    model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
    kind: 'openrouter',
  },

  // Local Mode: per-service toggles, all off by default. Enabled via settings.
  localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false },
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

// Local Mode: migrate legacy `{enabled: bool}` master toggle to per-service
// flags. Pre-v1.1.0-beta stored a single `enabled` boolean that controlled
// LLM + TTS + STT together. From v1.1.0-beta each service flips
// independently. Legacy `enabled: true` → expand to all three true.
const normalizeLocalMode = (stored: unknown): { localMode: LocalModeConfig; migrated: boolean } => {
  const lm = (stored ?? {}) as Partial<LocalModeConfig> & { enabled?: boolean };
  const urls = { ttsKokoroURL: lm.ttsKokoroURL, ttsQwenURL: lm.ttsQwenURL, sttURL: lm.sttURL };
  const hasPerService =
    typeof lm.llmEnabled === 'boolean' ||
    typeof lm.ttsEnabled === 'boolean' ||
    typeof lm.sttEnabled === 'boolean';
  if (hasPerService) {
    return {
      localMode: { llmEnabled: !!lm.llmEnabled, ttsEnabled: !!lm.ttsEnabled, sttEnabled: !!lm.sttEnabled, ...urls },
      migrated: false,
    };
  }
  const legacyOn = lm.enabled === true;
  return {
    localMode: { llmEnabled: legacyOn, ttsEnabled: legacyOn, sttEnabled: legacyOn, ...urls },
    migrated: legacyOn || lm.enabled === false,
  };
};

// The conversation goes where `llm.kind` points. Local Mode's model switch
// says what that is: an earlier key save could leave the switch on while the
// route was OpenRouter's, and a switch that says local must never mean that.
const withRouteAgreed = (localMode: LocalModeConfig, llm: Partial<LLMConfig> | undefined): LocalModeConfig => {
  const kind = llm?.kind ?? (llm?.provider === 'custom-openai' ? 'custom-openai' : 'openrouter');
  const routeLocal = kind === 'custom-openai';
  return localMode.llmEnabled === routeLocal ? localMode : { ...localMode, llmEnabled: routeLocal };
};

/**
 * Local Mode as held in a saved settings string, read the way loadServiceConfig
 * reads it. Pure: a render can call it, where loadServiceConfig may take over
 * another tab's settings and so update the store.
 */
export const localModeFromRaw = (raw: string | null | undefined): LocalModeConfig => {
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Partial<ServiceConfig> | null;
      return withRouteAgreed(normalizeLocalMode(saved?.localMode).localMode, saved?.llm);
    } catch {
      // Unreadable settings load as the defaults, here as in loadServiceConfig.
    }
  }
  return { ...defaultConfig.localMode! };
};

/** The model settings as held in a saved settings string. Pure, like localModeFromRaw. */
export const llmFromRaw = (raw: string | null | undefined): LLMConfig => {
  if (raw) {
    try {
      const llm = (JSON.parse(raw) as Partial<ServiceConfig> | null)?.llm;
      if (llm) {
        // An older save has no kind: derived from the provider, as loadServiceConfig does.
        const kind = llm.kind ?? (llm.provider === 'custom-openai' ? 'custom-openai' : 'openrouter');
        return { ...defaultConfig.llm, ...llm, kind };
      }
    } catch {
      // Unreadable settings load as the defaults, here as in loadServiceConfig.
    }
  }
  return { ...defaultConfig.llm };
};

// ============================================
// Self-host audio gate
// ============================================

// A self-host build has no hosted audio of its own: voice and transcription
// stay off until the operator's audio endpoint or the visitor's own service
// (Local Mode) can serve them. The off this forces is marked on the loaded
// object (a symbol key: spreads keep it, JSON drops it) so a save made from it
// writes back the visitor's own switches, not the forced off.
const SELF_HOST_FORCED_OFF = Symbol('selfHostForcedOff');
type ForcedOff = { tts: boolean; stt: boolean };

const withSelfHostAudioGate = (config: ServiceConfig): ServiceConfig => {
  if (!isSelfHost) return config;
  const lm = config.localMode;
  const forced: ForcedOff = {
    tts: config.ttsEnabled !== false && !audioApiUrl && !lm?.ttsEnabled,
    stt: config.sttEnabled !== false && !audioApiUrl && !lm?.sttEnabled,
  };
  if (!forced.tts && !forced.stt) return config;
  return {
    ...config,
    ...(forced.tts ? { ttsEnabled: false } : {}),
    ...(forced.stt ? { sttEnabled: false } : {}),
    [SELF_HOST_FORCED_OFF]: forced,
  } as ServiceConfig;
};

// Earlier self-host builds saved that forced off on every save, their key gate
// included, so an off saved without the mark is no choice: it reads as on, and
// the gate decides. The first save from this build writes the mark.
const withOwnAudioSwitches = (config: ServiceConfig): ServiceConfig => {
  if (!isSelfHost || config.ownAudioSwitches === true) return config;
  return { ...config, ttsEnabled: true, sttEnabled: true };
};

/** The switches as the visitor set them: a forced off still standing goes back to on. */
const withoutSelfHostAudioGate = (config: Partial<ServiceConfig>): Partial<ServiceConfig> => {
  const { [SELF_HOST_FORCED_OFF]: forced, ...own } = config as Partial<ServiceConfig> & { [SELF_HOST_FORCED_OFF]?: ForcedOff };
  if (!forced) return own;
  return {
    ...own,
    ...(forced.tts && own.ttsEnabled === false ? { ttsEnabled: true } : {}),
    ...(forced.stt && own.sttEnabled === false ? { sttEnabled: true } : {}),
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
    return withSelfHostAudioGate(withOwnAudioSwitches(existingConfig || defaultConfig));
  }

  isLoadingConfig = true;

  try {
    // Another tab may have changed the settings since this tab last looked.
    adoptSavedServiceConfig();
    const savedConfig = useDomainStore.getState().serviceConfig.raw;

    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig) as Partial<ServiceConfig>;

      // Validate and merge with defaults
      let config: ServiceConfig = {
        ...defaultConfig,
        ...parsedConfig,
        // TTS/STT: always self-hosted on GEX130 (legacy values map to 'self-hosted' via aliases)
        tts: TTS_SERVICES.SELF_HOSTED,
        stt: STT_SERVICES.SELF_HOSTED,
        ttsSettings: validateTTSSettings(parsedConfig.ttsSettings),
        sttEnabled: parsedConfig.sttEnabled !== false
      };

      // LLM kind: derive from `provider` when not explicitly set on stored config.
      if (!config.llm.kind) {
        config.llm.kind = config.llm.provider === 'custom-openai' ? 'custom-openai' : 'openrouter';
      }

      // LLM provider migration:
      //   - 'custom-openai': whitelist (Local Mode user-configured endpoint).
      //   - anything else: revert to OpenRouter (legacy 'deepinfra' / unknown).
      if (
        config.llm.provider !== LLM_SERVICES.OPENROUTER.name &&
        config.llm.provider !== 'custom-openai'
      ) {
        config.llm.provider = LLM_SERVICES.OPENROUTER.name;
        config.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
        config.llm.kind = 'openrouter';
        // Defer save to prevent infinite loops during render
        queueMicrotask(() => saveServiceConfig(config));
      }

      // Validate model is a known OpenRouter model — only when kind is openrouter.
      // For custom-openai the model is whatever the local server has loaded; we
      // accept any string.
      if (config.llm.kind === 'openrouter') {
        const validModels = Object.values(LLM_SERVICES.OPENROUTER.models);
        if (!validModels.includes(config.llm.model)) {
          config.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
          // Defer save to prevent infinite loops during render
          queueMicrotask(() => saveServiceConfig(config));
        }
      }

      const { localMode, migrated } = normalizeLocalMode(config.localMode);
      config.localMode = withRouteAgreed(localMode, config.llm);
      if (migrated) {
        queueMicrotask(() => saveServiceConfig(config));
      }

      config = withOwnAudioSwitches(config);

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

      return withSelfHostAudioGate(config);
    }
  } catch (error) {
    console.error('Error loading service config:', error);
  } finally {
    // Always reset the loading flag
    isLoadingConfig = false;
  }

  return withSelfHostAudioGate(defaultConfig);
};

// Save configuration to localStorage
export const saveServiceConfig = (config: Partial<ServiceConfig>): boolean => {
  try {
    // Validate config before saving
    const own = withoutSelfHostAudioGate(config);
    const validatedConfig: ServiceConfig = {
      ...defaultConfig,
      ...own,
      ttsSettings: validateTTSSettings(own.ttsSettings),
      ...(isSelfHost ? { ownAudioSwitches: true } : {}),
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

/**
 * The settings after an OpenRouter key is saved: the key's route, unless Local
 * Mode's model is on, which keeps the conversation (the key waits for it to be
 * switched off).
 */
export const withOpenRouterKey = (config: ServiceConfig, zdr: boolean): ServiceConfig => {
  if (config.localMode?.llmEnabled && config.llm.kind === 'custom-openai') {
    return { ...config, llm: { ...config.llm, zdr } };
  }
  return {
    ...config,
    llm: {
      provider: LLM_SERVICES.OPENROUTER.name,
      model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
      kind: 'openrouter',
      zdr,
    },
  };
};

// Helper for getting model display names
export const getModelDisplayName = (provider: string, modelId: string): string => {
  if (provider === 'openrouter') {
    return LLM_SERVICES.OPENROUTER.displayNames[modelId] || modelId;
  }
  return modelId;
};
