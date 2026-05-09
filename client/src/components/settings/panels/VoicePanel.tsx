import React, { FC, ReactNode, CSSProperties, ChangeEvent, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  Play,
  Check,
  GenderFemale,
  GenderMale,
  Star,
  Moon,
  Sparkle,
  Crosshair,
  Planet,
  Lightning,
  Meteor,
  Atom,
  ShieldCheck,
  Info,
  Compass,
  Globe,
  Bird,
  Sun,
  Fire
} from '@phosphor-icons/react';
import ToggleSwitch from '../../ToggleSwitch';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMobileOrTablet } from '../../../utils/deviceDetection';
import { selfHostedTTS } from '../../../services/audio/tts/selfHostedTTS';
import { newPreviewSessionId } from '../../../services/audio/tts/ttsSessions';
import {
  getGermanTechnicalVoice,
  getKokoroTechnicalVoice,
  type GermanVoice,
  type EnglishVoice
} from '../../../services/audio/voices';
import { useDomainStore } from '../../../stores/domainStore';
import CollapsibleSection from '../CollapsibleSection';

interface CosmicTextProps {
  children: ReactNode;
  className?: string;
  variant?: string;
  style?: CSSProperties;
  [key: string]: any;
}

const CosmicText: FC<CosmicTextProps> = ({
  children,
  className = '',
  variant = 'body',
  ...props
}) => (
  <p className={`cosmic-text ${variant} ${className}`} {...props}>
    {children}
  </p>
);

interface TTSSettings {
  speed: number;
  [key: string]: any;
}

interface VoiceConfig {
  ttsEnabled?: boolean;
  tts?: string;
  ttsSettings: TTSSettings;
  [key: string]: any;
}

interface OptionButton {
  label: string;
  value: string;
}

interface VoicePanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
  OptionButtons: React.ComponentType<{
    options: OptionButton[];
    selected: string | undefined;
    onChange: (value: string) => void;
  }>;
  config: VoiceConfig;
  onChange: (key: string, value: any) => void;
}

interface CosmicVoice {
  id: string;
  name: string;
  icon: ReactNode;
}

// ============================================
// German Voice Cards (Qwen3-TTS / F5-TTS on GEX130)
// ============================================

const GERMAN_FEMALE_VOICES: CosmicVoice[] = [
  { id: 'lyra', name: 'Lyra', icon: <Star size={18} weight="fill" /> },
  { id: 'astra', name: 'Astra', icon: <Atom size={18} weight="fill" /> },
  { id: 'vega', name: 'Vega', icon: <Sparkle size={18} weight="duotone" /> },
  { id: 'andromeda', name: 'Andromeda', icon: <Globe size={18} weight="fill" /> },
  { id: 'ceres', name: 'Ceres', icon: <Compass size={18} weight="fill" /> },
];

const GERMAN_MALE_VOICES: CosmicVoice[] = [
  { id: 'solaris', name: 'Solaris', icon: <Sun size={18} weight="fill" /> },
  { id: 'umbra', name: 'Umbra', icon: <Moon size={18} weight="fill" /> },
  { id: 'phoenix', name: 'Phoenix', icon: <Fire size={18} weight="fill" /> },
  { id: 'hyperion', name: 'Hyperion', icon: <Lightning size={18} weight="fill" /> },
  { id: 'corvus', name: 'Corvus', icon: <Bird size={18} weight="fill" /> },
];

// ============================================
// English Voice Cards (Kokoro on GEX130, finetuned blends)
// ============================================

const ENGLISH_FEMALE_VOICES: CosmicVoice[] = [
  { id: 'stella', name: 'Stella', icon: <Star size={18} weight="fill" /> },
  { id: 'luna', name: 'Luna', icon: <Moon size={18} weight="fill" /> },
  { id: 'aurora', name: 'Aurora', icon: <Sparkle size={18} weight="fill" /> },
  { id: 'nova', name: 'Nova', icon: <Atom size={18} weight="fill" /> },
  { id: 'celeste', name: 'Celeste', icon: <Meteor size={18} weight="fill" /> },
];

const ENGLISH_MALE_VOICES: CosmicVoice[] = [
  { id: 'orion', name: 'Orion', icon: <Crosshair size={18} weight="fill" /> },
  { id: 'sirius', name: 'Sirius', icon: <Star size={18} weight="duotone" /> },
  { id: 'jupiter', name: 'Jupiter', icon: <Planet size={18} weight="fill" /> },
  { id: 'saturn', name: 'Saturn', icon: <Planet size={18} weight="duotone" /> },
  { id: 'mercury', name: 'Mercury', icon: <Lightning size={18} weight="fill" /> },
];

const PREVIEW_TEXT_EN = "The ideas of great minds are bridges between times and worlds, waiting only to be heard.";
const PREVIEW_TEXT_DE = "Die Ideen großer Köpfe sind Brücken zwischen Zeiten und Welten, sie warten nur darauf, gehört zu werden.";

// Pre-rendered voice samples live on R2 (see scripts/generate-voice-previews.mjs).
// Files are rendered at speed 1.00; the client applies playbackRate to honor
// the user's slider. Falls back to live self-hosted TTS on 404 or fetch error.
const PREVIEW_BASE_URL = 'https://media.agoracosmica.org/voice-previews';

const VoicePanel: FC<VoicePanelProps> = ({
  SettingCard,
  CATEGORY_ICONS,
  config,
  onChange
}) => {
  const { tString, tNode } = useTranslation();
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Cleanup preview audio on unmount
  React.useEffect(() => {
    return () => {
      if (previewAudio) {
        const blobUrl = previewAudio.src;
        previewAudio.pause();
        previewAudio.src = '';
        if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      }
    };
  }, [previewAudio]);

  // Voice preferences from Zustand
  const voicePrefs = useDomainStore(
    useShallow((state) => ({
      german: state.german,
      english: state.english
    }))
  );
  const saveVoicePreferences = useDomainStore((state) => state.saveVoicePreferences);

  // Current language determines which voice set to show
  const language = useDomainStore((state) => state.language.current);
  const isGerman = language === 'de';

  // State for voice selection
  const [selectedGermanFemale, setSelectedGermanFemale] = useState<GermanVoice>(voicePrefs.german.femaleVoice);
  const [selectedGermanMale, setSelectedGermanMale] = useState<GermanVoice>(voicePrefs.german.maleVoice);
  const [selectedEnglishFemale, setSelectedEnglishFemale] = useState<EnglishVoice>(voicePrefs.english.femaleVoice);
  const [selectedEnglishMale, setSelectedEnglishMale] = useState<EnglishVoice>(voicePrefs.english.maleVoice);

  // Preview voice — prefers the R2-cached sample (rendered at speed 1.00)
  // and applies the user's current speed via playbackRate. Falls back to
  // a live self-hosted TTS call if the cached file isn't reachable.
  const handlePreview = async (voice: CosmicVoice, voiceLanguage: 'german' | 'english') => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
    }

    setPreviewingVoice(voice.id);

    const userSpeed = config.ttsSettings?.speed ?? 1.0;

    const playAudio = (audioEl: HTMLAudioElement) => {
      // preservesPitch keeps voice character stable while adjusting rate.
      // Supported in all evergreen browsers; the assignment is a no-op elsewhere.
      (audioEl as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      audioEl.playbackRate = userSpeed;
      setPreviewAudio(audioEl);
      audioEl.addEventListener('ended', () => setPreviewingVoice(null));
      return audioEl.play();
    };

    // 1) Try the R2-cached pre-render first.
    try {
      const res = await fetch(`${PREVIEW_BASE_URL}/${voice.id}.webm`, { cache: 'force-cache' });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        await playAudio(new Audio(blobUrl));
        return;
      }
      // Fall through to live TTS on 404 / error.
    } catch (err) {
      console.warn('[VoicePanel] Cached preview fetch failed, falling back to live TTS:', err);
    }

    // 2) Fallback: live self-hosted TTS.
    try {
      const technicalId = voiceLanguage === 'german'
        ? getGermanTechnicalVoice(voice.id as GermanVoice)
        : getKokoroTechnicalVoice(voice.id as EnglishVoice);
      const previewText = voiceLanguage === 'german' ? PREVIEW_TEXT_DE : PREVIEW_TEXT_EN;
      const langCode = voiceLanguage === 'german' ? 'de' : 'en';

      const audio = await selfHostedTTS(
        previewText,
        `preview_${voice.id}`,
        voice.id,
        1.0,
        technicalId,
        undefined,
        langCode,
        newPreviewSessionId()
      );

      await playAudio(new Audio(audio.url));
    } catch (err) {
      console.error('[VoicePanel] Preview failed:', err);
      setPreviewingVoice(null);
    }
  };

  // Select German voice and save
  const handleSelectGermanVoice = (voice: CosmicVoice) => {
    const isFemale = GERMAN_FEMALE_VOICES.find(v => v.id === voice.id);

    if (isFemale) {
      setSelectedGermanFemale(voice.id as GermanVoice);
      saveVoicePreferences({
        german: {
          femaleVoice: voice.id as GermanVoice,
          maleVoice: selectedGermanMale
        }
      });
    } else {
      setSelectedGermanMale(voice.id as GermanVoice);
      saveVoicePreferences({
        german: {
          femaleVoice: selectedGermanFemale,
          maleVoice: voice.id as GermanVoice
        }
      });
    }
  };

  // Select English voice and save
  const handleSelectEnglishVoice = (voice: CosmicVoice) => {
    const isFemale = ENGLISH_FEMALE_VOICES.find(v => v.id === voice.id);

    if (isFemale) {
      setSelectedEnglishFemale(voice.id as EnglishVoice);
      saveVoicePreferences({
        english: {
          femaleVoice: voice.id as EnglishVoice,
          maleVoice: selectedEnglishMale
        }
      });
    } else {
      setSelectedEnglishMale(voice.id as EnglishVoice);
      saveVoicePreferences({
        english: {
          femaleVoice: selectedEnglishFemale,
          maleVoice: voice.id as EnglishVoice
        }
      });
    }
  };

  // Render voice grid for a language
  const renderVoiceSection = (
    voiceLanguage: 'german' | 'english',
    femaleVoices: CosmicVoice[],
    maleVoices: CosmicVoice[],
    selectedFemale: string,
    selectedMale: string,
    onSelect: (voice: CosmicVoice) => void
  ) => (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{
        fontSize: '14px',
        marginBottom: '16px',
        color: 'var(--gold-base)',
        fontWeight: 'bold'
      }}>
        {tNode('settings.voice.voiceSelection.title')}
      </h4>

      {/* Female Voices */}
      <CollapsibleSection
        title={tString('settings.voice.voiceSelection.femaleVoices', 'Female Voices')}
        icon={<GenderFemale size={18} />}
        description={tString('settings.voice.voiceSelection.femaleDescription', 'Choose a female voice')}
        defaultExpanded={false}
        showBadge={true}
        badgeText={femaleVoices.find(v => v.id === selectedFemale)?.name || femaleVoices[0].name}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobileOrTablet() ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          marginTop: '12px'
        }}>
          {femaleVoices.map(voice => (
            <CosmicVoiceCard
              key={voice.id}
              voice={voice}
              selected={selectedFemale === voice.id}
              previewing={previewingVoice === voice.id}
              onPreview={() => handlePreview(voice, voiceLanguage)}
              onSelect={() => onSelect(voice)}
              showPreview={true}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Male Voices */}
      <CollapsibleSection
        title={tString('settings.voice.voiceSelection.maleVoices', 'Male Voices')}
        icon={<GenderMale size={18} />}
        description={tString('settings.voice.voiceSelection.maleDescription', 'Choose a male voice')}
        defaultExpanded={false}
        showBadge={true}
        badgeText={maleVoices.find(v => v.id === selectedMale)?.name || maleVoices[0].name}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobileOrTablet() ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          marginTop: '12px'
        }}>
          {maleVoices.map(voice => (
            <CosmicVoiceCard
              key={voice.id}
              voice={voice}
              selected={selectedMale === voice.id}
              previewing={previewingVoice === voice.id}
              onPreview={() => handlePreview(voice, voiceLanguage)}
              onSelect={() => onSelect(voice)}
              showPreview={true}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );

  return (
    <SettingCard
      title={tString('settings.voice.title', 'Voice')}
      icon={CATEGORY_ICONS.voice}
      description={tString('settings.voice.description', 'Configure voice settings')}
    >
      <div className="voice-settings-toggle-group" style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(20, 28, 58, 0.3)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <CosmicText variant="body-small" className="setting-label" style={{fontWeight: 'bold'}}>
            {tNode('settings.voice.enabled')}
          </CosmicText>
          <ToggleSwitch
            checked={config.ttsEnabled !== false}
            onChange={(value) => onChange('ttsEnabled', value)}
            size="medium"
          />
        </div>
      </div>

      {config.ttsEnabled !== false && (
        <>
          {/* Self-hosted info banner */}
          <div style={{
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'rgba(46, 213, 115, 0.1)',
            borderLeft: '3px solid var(--green-base, #2ED573)',
            borderRadius: '4px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <ShieldCheck size={16} weight="fill" style={{ flexShrink: 0 }} />
            <span className="note-text" style={{ opacity: 0.9, lineHeight: 1.4 }}>
              {tString('settings.voice.privacyNote', 'All voices are processed on our own servers in Germany. No data leaves the EU.')}
            </span>
          </div>

          {/* Scope note: voices apply to live modes, curated content has its own narrators */}
          <div style={{
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'color-mix(in srgb, var(--gold-subtle) 8%, transparent)',
            borderLeft: '3px solid var(--gold-subtle)',
            borderRadius: '4px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <Info size={16} weight="fill" style={{ flexShrink: 0, color: 'var(--gold-subtle)' }} />
            <span className="note-text" style={{ opacity: 0.9, lineHeight: 1.4 }}>
              {tString('settings.voice.voiceSelection.scopeNote', 'These voices power live conversations with the figures. Stories, prisms and councils come with their own handpicked narrators.')}
            </span>
          </div>

          {/* Voice selection based on current language */}
          {isGerman
            ? renderVoiceSection(
                'german',
                GERMAN_FEMALE_VOICES,
                GERMAN_MALE_VOICES,
                selectedGermanFemale,
                selectedGermanMale,
                handleSelectGermanVoice
              )
            : renderVoiceSection(
                'english',
                ENGLISH_FEMALE_VOICES,
                ENGLISH_MALE_VOICES,
                selectedEnglishFemale,
                selectedEnglishMale,
                handleSelectEnglishVoice
              )
          }

          {/* Speed control */}
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <CosmicText variant="body-small" style={{
                fontWeight: 'bold',
                margin: 0,
                fontSize: '14px'
              }}>
                {tNode('settings.voice.speed')}
              </CosmicText>
              <span style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'var(--gold-base)'
              }}>
                {config.ttsSettings.speed.toFixed(2)}x
              </span>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.01"
                value={config.ttsSettings.speed}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange('ttsSettings.speed', e.target.value)
                }
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
                aria-valuemin={0.8}
                aria-valuemax={1.3}
                aria-valuenow={config.ttsSettings.speed}
                aria-valuetext={`${config.ttsSettings.speed.toFixed(2)}x`}
              />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              opacity: 0.7
            }}>
              <span>{tNode('settings.voice.speedSlower')}</span>
              <span>{tNode('settings.voice.speedFaster')}</span>
            </div>
          </div>
        </>
      )}
    </SettingCard>
  );
};

// ============================================
// Cosmic Voice Card Component
// ============================================

interface CosmicVoiceCardProps {
  voice: CosmicVoice;
  selected: boolean;
  previewing: boolean;
  onPreview: () => void;
  onSelect: () => void;
  showPreview?: boolean;
}

const CosmicVoiceCard: FC<CosmicVoiceCardProps> = ({
  voice,
  selected,
  previewing,
  onPreview,
  onSelect,
  showPreview = true
}) => {
  const { tNode } = useTranslation();

  return (
    <div style={{
      padding: '12px',
      background: selected ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 255, 255, 0.05)',
      border: `2px solid ${selected ? 'var(--gold-base)' : 'rgba(255, 255, 255, 0.1)'}`,
      borderRadius: '8px',
      transition: 'all 0.2s',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{
        fontSize: '15px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: selected ? 'var(--gold-base)' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
      }}>
        <span>{voice.icon}</span>
        <span>{voice.name}</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr',
        gap: '6px'
      }}>
        {showPreview && (
          <button
            onClick={onPreview}
            disabled={previewing}
            style={{
              padding: '10px 4px',
              fontSize: '12px',
              background: previewing ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: previewing ? 'orange' : 'var(--text-primary)',
              border: previewing ? '1px solid orange' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: previewing ? 'not-allowed' : 'pointer',
              outline: 'none',
              minHeight: '44px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            <Play size={16} weight="fill" />
            {previewing ? tNode('settings.voice.voiceSelection.playing') : tNode('settings.voice.voiceSelection.preview')}
          </button>
        )}
        <button
          onClick={onSelect}
          disabled={selected}
          style={{
            padding: '10px 4px',
            fontSize: '12px',
            fontWeight: 'bold',
            background: selected ? 'var(--gold-base)' : 'rgba(255, 255, 255, 0.1)',
            color: selected ? 'var(--bg-primary)' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: selected ? 'not-allowed' : 'pointer',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          {selected ? <><Check size={16} weight="bold" /> {tNode('settings.voice.voiceSelection.selected')}</> : tNode('settings.voice.voiceSelection.select')}
        </button>
      </div>
    </div>
  );
};

export default VoicePanel;
