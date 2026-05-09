// Settings service for managing configuration changes
import {
  TTS_SERVICES,
  STT_SERVICES,
  LLM_SERVICES,
  loadServiceConfig,
  saveServiceConfig,
  getModelDisplayName,
  type ServiceConfig
} from '../audio/config/serviceConfig';

interface ModelOption {
  label: string;
  value: string;
}

type TranslationFunction = (key: string, params?: Record<string, any>) => string;

/**
 * Handle configuration changes based on section
 */
export const handleConfigChange = (config: ServiceConfig, section: string, value: any): ServiceConfig => {
  const newConfig = { ...config };
  
  switch (section) {
    case 'llm.provider':
      newConfig.llm.provider = LLM_SERVICES.OPENROUTER.name;
      newConfig.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
      break;
    case 'llm.model':
      newConfig.llm.model = value;
      break;
    case 'tts':
      newConfig.tts = value;
      break;
    case 'ttsSettings.speed':
      newConfig.ttsSettings.speed = parseFloat(value);
      break;
    default:
      (newConfig as any)[section] = value; // stt, displayMode, ttsEnabled, sttEnabled
  }
  
  return newConfig;
};

/**
 * Get model options based on selected provider
 */
export const getModelOptions = (_config: ServiceConfig): ModelOption[] => {
  const models = Object.values(LLM_SERVICES.OPENROUTER.models);

  return models.map((m) => ({
    label: getModelDisplayName('openrouter', m),
    value: m
  }));
};

/**
 * Save configuration and trigger change event
 */
export const saveConfiguration = (config: ServiceConfig): void => {
  saveServiceConfig(config);
  window.dispatchEvent(new Event('configChanged'));
};

/**
 * Get description text for a category
 */
export const getCategoryDescription = (category: string, config: ServiceConfig, t: TranslationFunction): string => {
  switch (category) {
    case 'legal':
      return t('settings.categoriesDescription.legal');
    case 'language':
      const languages = ["English", "German"].join(", ");
      return `${languages} - ${t('settings.language.description')}`;
    case 'display':
      return t('settings.categoriesDescription.display');
    case 'voice':
      return t('settings.categoriesDescription.voice', {
        serviceText: 'Self-hosted TTS',
        speed: config.ttsSettings.speed.toFixed(2)
      });
    case 'speech':
      return t('settings.categoriesDescription.speech', { service: 'Self-hosted STT' });
    case 'model':
      return t('settings.categoriesDescription.model');
    case 'help':
      return t('settings.categoriesDescription.help');
    default:
      return '';
  }
};

// Re-export for convenience
export {
  TTS_SERVICES,
  STT_SERVICES,
  LLM_SERVICES,
  loadServiceConfig,
  saveServiceConfig
};