import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Gear, Globe, SpeakerHigh, Microphone, Brain, ArrowCounterClockwise, House } from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import { keyStorage } from '../../../services/storage/keyStorageService';
import { useUIStore } from '../../../stores/uiStore';
import { useDomainStore } from '../../../stores/domainStore';
import { localModeFromRaw } from '../../../services/audio/config/serviceConfig';
import styles from '../../SettingsModal.module.css';
import CollapsibleSection from '../CollapsibleSection';

import LanguagePanel from './LanguagePanel';
import VoicePanel from './VoicePanel';
import SpeechPanel from './SpeechPanel';
import AiModelPanel from './AiModelPanel';
import LocalModePanel from './LocalModePanel';

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
  /** Opens this section expanded, e.g. after a rejected key. */
  expandSection?: 'aiModel';
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
  expandSection,
  SettingCard,
  OptionButtons,
  CATEGORY_ICONS,
}) => {
  const { tString, tNode } = useTranslation();

  // Track BYOK status so the AI Model badge can flip Free ↔ Your key.
  // Initial check on mount; AiModelPanel emits 'byok-key-changed' on save/clear
  // so the badge updates live during the same modal session.
  // 'rejected': a stored key OpenRouter turned down, shown as such rather than as the free tier.
  const [byokKey, setByokKey] = useState<'none' | 'usable' | 'rejected'>('none');

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
    let live = true;
    const checkKey = async () => {
      let state: 'none' | 'usable' | 'rejected' = 'none';
      try {
        if (await keyStorage.hasUsableKey('openrouter')) state = 'usable';
        else if (await keyStorage.hasKey('openrouter')) state = 'rejected';
      } catch {
        // Storage unreadable: show the free tier, as before.
      }
      if (live) setByokKey(state);
    };
    checkKey();

    // "No key" is also sent on a rejection, which keeps the key stored: read storage then.
    const handleKeyChange = (e: Event): void => {
      const detail = (e as CustomEvent<{ hasKey: boolean }>).detail;
      if (!detail) return;
      if (detail.hasKey) setByokKey('usable');
      else void checkKey();
    };
    window.addEventListener('byok-key-changed', handleKeyChange);
    return () => {
      live = false;
      window.removeEventListener('byok-key-changed', handleKeyChange);
    };
  }, []);

  // Opened for the key: bring its section into view, below the three above it.
  const aiModelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expandSection !== 'aiModel') return;
    const timer = window.setTimeout(() => {
      aiModelRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [expandSection]);

  // The saved settings, so the badges follow the Local Mode switches. Read as
  // they are: loadServiceConfig here could update the store during a render.
  const savedRaw = useDomainStore((state) => state.serviceConfig.raw);
  const localMode = useMemo(() => localModeFromRaw(savedRaw), [savedRaw]);

  const getLanguageBadge = (): string => {
    const langs: Record<string, string> = { en: 'English', de: 'Deutsch' };
    return langs[selectedLanguage] || selectedLanguage;
  };

  // Voice and voice input run on our servers in Germany, or locally in Local Mode.
  // The badge names whose servers they are: beside "Local", "Self-hosted" read as the visitor's own.
  const getVoiceBadge = (): string => {
    if (!config.ttsEnabled) return tString('common.disabled', 'Disabled');
    if (localMode?.ttsEnabled) return tString('settings.preferences.local', 'Local');
    return tString('settings.preferences.ourServers', 'Our servers');
  };

  const getSpeechBadge = (): string => {
    if (!config.sttEnabled) return tString('common.disabled', 'Disabled');
    if (localMode?.sttEnabled) return tString('settings.preferences.local', 'Local');
    return tString('settings.preferences.ourServers', 'Our servers');
  };

  // The badge names the route, the panel names the model: a model's name beside
  // the title leaves it no room on a phone. The free tier's models are not all
  // in the EU, so its badge names no model either.
  // A local model wins over a saved key, as it does for the conversation.
  const getAiModelBadge = (): string => {
    if (localMode?.llmEnabled) return tString('settings.preferences.aiModelBadgeLocal', 'Local model');
    if (byokKey === 'usable') return tString('settings.preferences.aiModelBadgeByok', 'Your key');
    if (byokKey === 'rejected') return tString('settings.preferences.aiModelBadgeRejected', 'Key rejected');
    return tString('settings.preferences.aiModelBadgeFree', 'Europe · Free tier');
  };

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
      <div ref={aiModelRef}>
      <CollapsibleSection
        title={tString('settings.aiModelKey.title', 'AI Model & Your Key')}
        icon={<Brain size={20} />}
        description={tString(
          'settings.aiModelKey.description',
          'The model that powers your conversations and your optional OpenRouter key',
        )}
        defaultExpanded={expandSection === 'aiModel'}
        showBadge={true}
        badgeText={getAiModelBadge()}
      >
        <AiModelPanel
          SettingCard={SettingCard}
          CATEGORY_ICONS={CATEGORY_ICONS}
        />
      </CollapsibleSection>
      </div>

      {/* Local Mode — run the whole pipeline on your own machine */}
      <CollapsibleSection
        title={tString('settings.localMode.title', 'Local Mode')}
        icon={<House size={20} />}
        description={tString(
          'settings.localMode.description',
          'Run the whole pipeline on your own machine: LLM, voice, transcription.',
        )}
        defaultExpanded={false}
      >
        <LocalModePanel
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
