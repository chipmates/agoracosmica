import React, { FC, useEffect, useState } from 'react';
import { Gear, Globe, SpeakerHigh, Microphone, Brain, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import { keyStorage } from '../../../services/storage/keyStorageService';
import { useUIStore } from '../../../stores/uiStore';
import styles from '../../SettingsModal.module.css';
import CollapsibleSection from '../CollapsibleSection';

import LanguagePanel from './LanguagePanel';
import VoicePanel from './VoicePanel';
import SpeechPanel from './SpeechPanel';
import AiModelPanel from './AiModelPanel';

interface Config {
  ttsEnabled?: boolean;
  tts?: string;
  sttEnabled?: boolean;
  stt?: string;
  [key: string]: any;
}

interface PraeferenzenPanelProps {
  config: Config;
  selectedLanguage: string;
  onChange: (key: string, value: any) => void;
  onLanguageChange: (language: string) => void;
  // These props are passed down to child panels
  SettingCard: React.ComponentType<any>;
  OptionButtons: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
}

/**
 * PraeferenzenPanel - Container for all user preference settings.
 * Four collapsibles: Language, Voice, Speech, AI Model & Your Key.
 * The AI Model section folds in the OpenRouter key flow — same model
 * runs on free tier and BYOK, so they live together.
 */
const PraeferenzenPanel: FC<PraeferenzenPanelProps> = ({
  config,
  selectedLanguage,
  onChange,
  onLanguageChange,
  SettingCard,
  OptionButtons,
  CATEGORY_ICONS,
}) => {
  const { tString, tNode } = useTranslation();

  // Track BYOK status so the AI Model badge can flip Free ↔ Your key.
  // Initial check on mount; AiModelPanel emits 'byok-key-changed' on save/clear
  // so the badge updates live during the same modal session.
  const [hasByokKey, setHasByokKey] = useState(false);

  // Reset onboarding helpers — confirmation/success state lives only here, not persisted.
  const resetHelpPreferences = useUIStore((s) => s.resetHelpPreferences);
  const [helpResetState, setHelpResetState] = useState<'idle' | 'confirming' | 'done'>('idle');
  const handleResetHelpers = (): void => {
    if (helpResetState !== 'confirming') {
      setHelpResetState('confirming');
      return;
    }
    resetHelpPreferences();
    setHelpResetState('done');
    window.setTimeout(() => setHelpResetState('idle'), 2400);
  };
  useEffect(() => {
    const checkKey = async () => {
      try {
        const meta = await keyStorage.getKeyMetadata('openrouter');
        setHasByokKey(!!meta?.lastValidated);
      } catch {
        setHasByokKey(false);
      }
    };
    checkKey();

    const handleKeyChange = (e: Event): void => {
      const detail = (e as CustomEvent<{ hasKey: boolean }>).detail;
      if (detail) setHasByokKey(detail.hasKey);
    };
    window.addEventListener('byok-key-changed', handleKeyChange);
    return () => window.removeEventListener('byok-key-changed', handleKeyChange);
  }, []);

  const getLanguageBadge = (): string => {
    const langs: Record<string, string> = { en: 'English', de: 'Deutsch' };
    return langs[selectedLanguage] || selectedLanguage;
  };

  // TTS/STT are always self-hosted on GEX130 (Germany) — no service selection.
  const getVoiceBadge = (): string => {
    if (!config.ttsEnabled) return tString('common.disabled', 'Disabled');
    return tString('settings.preferences.selfHosted', 'Self-hosted');
  };

  const getSpeechBadge = (): string => {
    if (!config.sttEnabled) return tString('common.disabled', 'Disabled');
    return tString('settings.preferences.selfHosted', 'Self-hosted');
  };

  const getAiModelBadge = (): string => hasByokKey
    ? tString('settings.preferences.aiModelBadgeByok', 'Qwen3 235B · Your key')
    : tString('settings.preferences.aiModelBadgeFree', 'Qwen3 235B · Free');

  return (
    <div className={styles.tabPanel}>
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}>
          <Gear size={24} />
        </div>
        <h2 className={styles.sectionTitle}>
          {tNode('settings.tabs.preferences')}
        </h2>
      </div>

      {/* Info text */}
      <p style={{
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '14px',
        marginBottom: '24px',
        fontFamily: 'Space Grotesk, sans-serif',
        opacity: 0.9,
      }}>
        {tNode('settings.preferences.hint')}
      </p>

      {/* Language */}
      <CollapsibleSection
        title={tString('settings.language.title', 'Display Language')}
        icon={<Globe size={20} />}
        description={tString('settings.language.description', 'Choose your preferred interface language')}
        defaultExpanded={false}
        showBadge={true}
        badgeText={getLanguageBadge()}
      >
        <LanguagePanel
          SettingCard={SettingCard}
          CATEGORY_ICONS={CATEGORY_ICONS}
          OptionButtons={OptionButtons}
          selectedLanguage={selectedLanguage}
          onChange={onLanguageChange}
        />
      </CollapsibleSection>

      {/* Voice */}
      <CollapsibleSection
        title={tString('settings.voice.title', 'Voice Settings')}
        icon={<SpeakerHigh size={20} />}
        description={tString('settings.voice.description', 'Configure how responses are read aloud')}
        defaultExpanded={false}
        showBadge={true}
        badgeText={getVoiceBadge()}
      >
        <VoicePanel
          SettingCard={SettingCard}
          CATEGORY_ICONS={CATEGORY_ICONS}
          OptionButtons={OptionButtons}
          config={config as any}
          onChange={onChange}
        />
      </CollapsibleSection>

      {/* Speech Recognition */}
      <CollapsibleSection
        title={tString('settings.speech.title', 'Speech Recognition')}
        icon={<Microphone size={20} />}
        description={tString('settings.speech.description', 'Select which service processes your voice input')}
        defaultExpanded={false}
        showBadge={true}
        badgeText={getSpeechBadge()}
      >
        <SpeechPanel
          SettingCard={SettingCard}
          CATEGORY_ICONS={CATEGORY_ICONS}
          config={config}
          onChange={onChange}
        />
      </CollapsibleSection>

      {/* AI Model & Your Key — combined panel (model + OpenRouter key + ZDR) */}
      <CollapsibleSection
        title={tString('settings.aiModelKey.title', 'AI Model & Your Key')}
        icon={<Brain size={20} />}
        description={tString(
          'settings.aiModelKey.description',
          'The model that powers your conversations and your optional OpenRouter key',
        )}
        defaultExpanded={false}
        showBadge={true}
        badgeText={getAiModelBadge()}
      >
        <AiModelPanel
          SettingCard={SettingCard}
          CATEGORY_ICONS={CATEGORY_ICONS}
        />
      </CollapsibleSection>

      {/* Reset onboarding helpers */}
      <CollapsibleSection
        title={tString('settings.help.title', 'Help & Tips')}
        icon={<ArrowCounterClockwise size={20} />}
        description={tString('settings.help.description', 'Manage tutorial and help preferences')}
        defaultExpanded={false}
      >
        <div style={{ padding: '0.5rem 0', fontFamily: 'Space Grotesk, sans-serif' }}>
          <p style={{
            margin: '0 0 1rem',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}>
            {tNode('settings.help.resetDescription')}
          </p>
          <button
            type="button"
            onClick={handleResetHelpers}
            disabled={helpResetState === 'done'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: '44px',
              padding: '0.6rem 1.1rem',
              borderRadius: '2rem',
              border: '1px solid color-mix(in srgb, var(--gold-subtle) 40%, transparent)',
              background: helpResetState === 'confirming'
                ? 'color-mix(in srgb, var(--mode-quest, #E07A5F) 25%, transparent)'
                : 'color-mix(in srgb, var(--gold-subtle) 18%, transparent)',
              color: helpResetState === 'confirming' ? 'var(--mode-quest, #E07A5F)' : 'var(--gold-subtle)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: helpResetState === 'done' ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            {helpResetState === 'confirming'
              ? tString('settings.help.resetConfirmation', 'Reset all help tips?')
              : helpResetState === 'done'
                ? tString('settings.help.resetSuccess', 'Help tips have been reset.')
                : tString('settings.help.resetButton', 'Reset Help Tips')}
          </button>
          {helpResetState === 'confirming' && (
            <button
              type="button"
              onClick={() => setHelpResetState('idle')}
              style={{
                marginLeft: '0.75rem',
                minHeight: '44px',
                padding: '0.6rem 1rem',
                borderRadius: '2rem',
                border: '1px solid color-mix(in srgb, white 15%, transparent)',
                background: 'transparent',
                color: 'color-mix(in srgb, white 70%, transparent)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {tString('common.cancel', 'Cancel')}
            </button>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default PraeferenzenPanel;
