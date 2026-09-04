import React, { FC, ReactNode, CSSProperties, ChangeEvent, useRef, useState } from 'react';
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
  Fire,
  Circle,
  CheckCircle
} from '@phosphor-icons/react';
import ToggleSwitch from '../../ToggleSwitch';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMobileOrTablet } from '../../../utils/deviceDetection';
import { selfHostedTTS } from '../../../services/audio/tts/selfHostedTTS';
import { newPreviewSessionId } from '../../../services/audio/tts/ttsSessions';
import { bindAudioElement } from '../../../services/audio/audioFocus';
import {
  getGermanTechnicalVoice,
  getKokoroTechnicalVoice,
  QWEN_ENGLISH_TECHNICAL_VOICES,
  QWEN_ENGLISH_VOICES,
  resolveEnglishEngine,
  type GermanVoice,
  type EnglishVoice,
  type EnglishEngine,
  type QwenEnglishVoice
} from '../../../services/audio/voices';
import { isLocalModeEnglishTts } from '../../../services/audio/voices/voiceResolver';
import { useDomainStore } from '../../../stores/domainStore';
import { EN_VOICE_ENGINE_CHOICE } from '../../../config/features';
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
  /** Card key: the preview file on R2 and the selection state. */
  id: string;
  name: string;
  icon: ReactNode;
  /** Set when the card's id is already the id the gateway expects. */
  technical?: string;
  /** Stored preference name, when the card id is the gateway id instead. */
  cosmic?: string;
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

// ============================================
// English Voice Cards (Qwen on GEX130, five per gender)
// ============================================

// The Qwen English cast carries the same ten cosmic names as the German one,
// so name and icon come from there rather than being written twice.
const COSMIC_CARDS_BY_NAME: Record<string, CosmicVoice> = Object.fromEntries(
  [...GERMAN_FEMALE_VOICES, ...GERMAN_MALE_VOICES].map(voice => [voice.id, voice])
);

// The card id stays the gateway id: it also keys the R2 preview file, and the
// bare cosmic names there belong to the German recordings.
const qwenEnglishCard = (cosmic: QwenEnglishVoice): CosmicVoice => ({
  id: QWEN_ENGLISH_TECHNICAL_VOICES[cosmic],
  technical: QWEN_ENGLISH_TECHNICAL_VOICES[cosmic],
  cosmic,
  name: COSMIC_CARDS_BY_NAME[cosmic].name,
  icon: COSMIC_CARDS_BY_NAME[cosmic].icon,
});

// Ranked order, the one-to-one default first.
const QWEN_ENGLISH_FEMALE_VOICES: CosmicVoice[] = QWEN_ENGLISH_VOICES.female.map(qwenEnglishCard);
const QWEN_ENGLISH_MALE_VOICES: CosmicVoice[] = QWEN_ENGLISH_VOICES.male.map(qwenEnglishCard);

const PREVIEW_TEXT_EN = "The ideas of great minds are bridges between times and worlds, waiting only to be heard.";
const PREVIEW_TEXT_DE = "Die Ideen großer Köpfe sind Brücken zwischen Zeiten und Welten, sie warten nur darauf, gehört zu werden.";

// Pre-rendered voice samples live on R2 (see scripts/generate-voice-previews.mjs).
// Files are rendered at speed 1.00; the client applies playbackRate to honor
// the user's slider. Falls back to live self-hosted TTS on 404 or fetch error.
const PREVIEW_BASE_URL = 'https://media.agoracosmica.org/voice-previews';

// ============================================
// Plate language: night ground, one gold-deep hairline, gilded selection.
// ============================================

// --text-secondary is self-referential inside `.setting-card` (voiding the token,
// so text falls back to inherited gold) and --text-tertiary is remapped to the
// dimmer --text-dim there. Both inks are derived from --text-primary, which is
// stable in this scope, and clear AA on every ground used below.
const INK_BODY = 'color-mix(in srgb, var(--text-primary) 88%, var(--bg-void))';
const INK_QUIET = 'color-mix(in srgb, var(--text-primary) 68%, var(--bg-void))';
const PLATE_GROUND = 'color-mix(in srgb, var(--bg-card) 82%, var(--bg-void))';
const PLATE_GROUND_CHOSEN = 'color-mix(in srgb, var(--bg-card) 88%, var(--gold-deep))';
const PLATE_HAIRLINE = '1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent)';
const CALLOUT_GROUND = 'color-mix(in srgb, var(--bg-card) 70%, var(--bg-void))';
const CALLOUT_RULE = '3px solid color-mix(in srgb, var(--gold-deep) 75%, transparent)';

const kickerStyle: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'color-mix(in srgb, var(--gold-deep) 70%, var(--gold-primary))',
};

const calloutStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '10px 14px',
  background: CALLOUT_GROUND,
  borderLeft: CALLOUT_RULE,
  borderRadius: '4px',
  fontSize: '13px',
  color: INK_BODY,
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
};

// Engraved ink buttons need :hover / :focus-visible / :disabled, which inline
// styles cannot express. Scoped to this panel's own class prefix.
const VOICE_PLATE_CSS = `
.voice-plate-btn {
  padding: 10px 4px;
  min-height: 44px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 45%, transparent);
  border-radius: 4px;
  color: var(--gold-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.voice-plate-btn--select {
  background: color-mix(in srgb, var(--gold-subtle) 10%, transparent);
  border-color: color-mix(in srgb, var(--gold-deep) 60%, transparent);
}
.voice-plate-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--gold-subtle) 16%, transparent);
  border-color: color-mix(in srgb, var(--gold-deep) 85%, transparent);
}
.voice-plate-btn:active:not(:disabled) {
  transform: translateY(1px);
}
.voice-plate-btn:focus-visible {
  outline: 1.5px dashed var(--gold-primary);
  outline-offset: 3px;
}
.voice-plate-btn--playing {
  background: color-mix(in srgb, var(--gold-subtle) 16%, transparent);
  border-color: color-mix(in srgb, var(--gold-primary) 70%, transparent);
  cursor: not-allowed;
}
.voice-plate-btn--chosen {
  background: transparent;
  border-color: color-mix(in srgb, var(--gold-deep) 32%, transparent);
  cursor: not-allowed;
}
.voice-engine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}
.voice-engine-btn {
  min-height: 44px;
  padding: 12px 14px;
  text-align: left;
  background: color-mix(in srgb, var(--bg-card) 82%, var(--bg-void));
  border: 1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.voice-engine-btn:hover:not(.voice-engine-btn--chosen) {
  background: color-mix(in srgb, var(--gold-subtle) 12%, transparent);
  border-color: color-mix(in srgb, var(--gold-deep) 85%, transparent);
}
.voice-engine-btn:focus-visible {
  outline: 1.5px dashed var(--gold-primary);
  outline-offset: 3px;
}
.voice-engine-btn--chosen {
  background: color-mix(in srgb, var(--bg-card) 88%, var(--gold-deep));
  border-color: var(--gold-primary);
  cursor: default;
}
.voice-engine-btn--locked {
  opacity: 0.55;
  cursor: not-allowed;
}
.voice-engine-btn__name {
  font-family: var(--font-content);
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 0.01em;
  margin-bottom: 4px;
}
.voice-engine-btn__note {
  font-size: 13px;
  line-height: 1.45;
}
@media (prefers-reduced-motion: reduce) {
  .voice-plate-btn { transition: none; }
  .voice-plate-btn:active:not(:disabled) { transform: none; }
  .voice-engine-btn { transition: none; }
}
`;

const VoicePanel: FC<VoicePanelProps> = ({
  SettingCard,
  CATEGORY_ICONS,
  config,
  onChange
}) => {
  const { tString, tNode } = useTranslation();
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const previewUnbindRef = useRef<(() => void) | null>(null);

  // Leave the audio-focus coordinator when the panel unmounts. Kept in its own
  // mount-only effect on purpose: the [previewAudio] effect below re-runs on
  // every preview, and unbinding there would tear down the binding we just
  // created for the new preview (it holds the live ref, already reassigned).
  React.useEffect(() => {
    return () => {
      previewUnbindRef.current?.();
      previewUnbindRef.current = null;
    };
  }, []);

  // Release the preview element (pause + revoke its blob) when it is replaced
  // or the panel unmounts.
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
      english: state.english,
      qwenEnglish: state.qwenEnglishVoices
    }))
  );
  const saveVoicePreferences = useDomainStore((state) => state.saveVoicePreferences);
  const updateQwenEnglishPreferences = useDomainStore((state) => state.updateQwenEnglishPreferences);
  // Unset until the visitor picks, so the plate shows the default as chosen.
  const storedEngine = resolveEnglishEngine(useDomainStore((state) => state.englishEngine));
  const setEnglishEngine = useDomainStore((state) => state.setEnglishEngine);
  const showEngineChoice = EN_VOICE_ENGINE_CHOICE;
  // Local Mode runs Kokoro for English, so the choice is shown but frozen and
  // the stored pick is left alone until Local Mode goes off.
  const localModeEnglish = showEngineChoice && isLocalModeEnglishTts();
  const englishEngine = localModeEnglish ? 'kokoro' : storedEngine;
  const onQwenEnglish = showEngineChoice && englishEngine === 'qwen';

  // Current language determines which voice set to show
  const language = useDomainStore((state) => state.language.current);
  const isGerman = language === 'de';

  // State for voice selection
  const [selectedGermanFemale, setSelectedGermanFemale] = useState<GermanVoice>(voicePrefs.german.femaleVoice);
  const [selectedGermanMale, setSelectedGermanMale] = useState<GermanVoice>(voicePrefs.german.maleVoice);
  const [selectedEnglishFemale, setSelectedEnglishFemale] = useState<EnglishVoice>(voicePrefs.english.femaleVoice);
  const [selectedEnglishMale, setSelectedEnglishMale] = useState<EnglishVoice>(voicePrefs.english.maleVoice);
  const [selectedQwenFemale, setSelectedQwenFemale] = useState<QwenEnglishVoice>(voicePrefs.qwenEnglish.female);
  const [selectedQwenMale, setSelectedQwenMale] = useState<QwenEnglishVoice>(voicePrefs.qwenEnglish.male);

  // Preview voice — prefers the R2-cached sample (rendered at speed 1.00)
  // and applies the user's current speed via playbackRate. Falls back to
  // a live self-hosted TTS call if the cached file isn't reachable.
  const handlePreview = async (voice: CosmicVoice, voiceLanguage: 'german' | 'english') => {
    // Unregister the previous preview first, unconditionally — previewAudio can
    // still be stale here during the async fetch/TTS window before it is set.
    previewUnbindRef.current?.();
    previewUnbindRef.current = null;
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
      // Join the audio-focus coordinator (before play()) so a voice preview
      // pauses other content audio, and is paused when something else starts.
      previewUnbindRef.current = bindAudioElement(audioEl);
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
      const technicalId = voice.technical
        ?? (voiceLanguage === 'german'
          ? getGermanTechnicalVoice(voice.id as GermanVoice)
          : getKokoroTechnicalVoice(voice.id as EnglishVoice));
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

  // Select Qwen English voice and save. The card id is the gateway id, the
  // stored pick is the cosmic name.
  const handleSelectQwenEnglishVoice = (voice: CosmicVoice) => {
    const cosmic = (voice.cosmic ?? voice.id) as QwenEnglishVoice;

    if (QWEN_ENGLISH_FEMALE_VOICES.some(v => v.id === voice.id)) {
      setSelectedQwenFemale(cosmic);
      updateQwenEnglishPreferences(undefined, cosmic);
    } else {
      setSelectedQwenMale(cosmic);
      updateQwenEnglishPreferences(cosmic, undefined);
    }
  };

  // Engine choice for English. German runs one stack, so it has no plate here.
  const renderEngineChoice = (): ReactNode => {
    const engines: { id: EnglishEngine; name: string; note: string }[] = [
      {
        id: 'qwen',
        name: tString('settings.voice.engine.qwenLabel', 'Qwen'),
        note: tString(
          'settings.voice.engine.qwenNote',
          'Our newest English voices. One voice per figure, picked by gender.'
        ),
      },
      {
        id: 'kokoro',
        name: tString('settings.voice.engine.kokoroLabel', 'Kokoro'),
        note: tString(
          'settings.voice.engine.kokoroNote',
          'The earlier cast. Ten voices you can pick from.'
        ),
      },
    ];

    return (
      <div style={{ marginTop: '4px', marginBottom: '4px' }}>
        <h4 style={{ ...kickerStyle, margin: '0 0 12px' }}>
          {tNode('settings.voice.engine.title')}
        </h4>

        <div className="voice-engine-grid">
          {engines.map(engine => {
            const chosen = englishEngine === engine.id;
            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => setEnglishEngine(engine.id)}
                aria-pressed={chosen}
                disabled={localModeEnglish}
                className={`voice-engine-btn${chosen ? ' voice-engine-btn--chosen' : ''}${localModeEnglish ? ' voice-engine-btn--locked' : ''}`}
              >
                <span style={{
                  display: 'flex',
                  flexShrink: 0,
                  marginTop: '2px',
                  color: chosen ? 'var(--gold-primary)' : 'var(--gold-deep)',
                }}>
                  {chosen ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
                </span>
                <span>
                  <span
                    className="voice-engine-btn__name"
                    style={{
                      display: 'block',
                      color: chosen ? 'var(--gold-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {engine.name}
                  </span>
                  <span className="voice-engine-btn__note" style={{ display: 'block', color: INK_BODY }}>
                    {engine.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.5, color: INK_QUIET }}>
          {localModeEnglish
            ? tString(
                'settings.voice.engine.localModeNote',
                'Local Mode uses Kokoro for English, so the choice waits until you turn Local Mode voice off.'
              )
            : tString(
                'settings.voice.engine.help',
                'Both run on our own servers. The opening message follows your choice, so it always matches the voice that answers.'
              )}
        </p>
      </div>
    );
  };

  // Render voice grid for a language
  const renderVoiceSection = (
    voiceLanguage: 'german' | 'english',
    femaleVoices: CosmicVoice[],
    maleVoices: CosmicVoice[],
    selectedFemale: string,
    selectedMale: string,
    onSelect: (voice: CosmicVoice) => void,
    note?: string
  ) => (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ ...kickerStyle, margin: '0 0 16px' }}>
        {tNode('settings.voice.voiceSelection.title')}
      </h4>

      {note && (
        <p style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5, color: INK_BODY }}>
          {note}
        </p>
      )}

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
      <style>{VOICE_PLATE_CSS}</style>

      <div className="voice-settings-toggle-group" style={{
        marginBottom: '16px',
        padding: '14px',
        background: PLATE_GROUND,
        border: PLATE_HAIRLINE,
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <CosmicText
            variant="body-small"
            className="setting-label"
            style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}
          >
            {tNode('settings.voice.enabled')}
          </CosmicText>
          <ToggleSwitch
            checked={config.ttsEnabled !== false}
            onChange={(value) => onChange('ttsEnabled', value)}
            size="medium"
            ariaLabel={tString('settings.voice.enabled')}
          />
        </div>
      </div>

      {config.ttsEnabled !== false && (
        <>
          {/* Self-hosted info banner */}
          <div style={calloutStyle}>
            <ShieldCheck
              size={16}
              weight="fill"
              style={{ flexShrink: 0, marginTop: '2px', color: 'var(--gold-deep)' }}
            />
            <span className="note-text" style={{ lineHeight: 1.5 }}>
              {tString('settings.voice.privacyNote', 'All voices are processed on our own servers in Germany. No data leaves the EU.')}
            </span>
          </div>

          {/* Scope note: voices apply to live modes, curated content has its own narrators */}
          <div style={calloutStyle}>
            <Info
              size={16}
              weight="fill"
              style={{ flexShrink: 0, marginTop: '2px', color: 'var(--gold-deep)' }}
            />
            <span className="note-text" style={{ lineHeight: 1.5 }}>
              {tString('settings.voice.voiceSelection.scopeNote', 'These voices power live conversations with the figures. Stories, prisms and councils come with their own handpicked narrators.')}
            </span>
          </div>

          {/* Engine choice sits above the cast: it decides which cast shows. */}
          {!isGerman && showEngineChoice && renderEngineChoice()}

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
            : onQwenEnglish
              ? renderVoiceSection(
                  'english',
                  QWEN_ENGLISH_FEMALE_VOICES,
                  QWEN_ENGLISH_MALE_VOICES,
                  QWEN_ENGLISH_TECHNICAL_VOICES[selectedQwenFemale],
                  QWEN_ENGLISH_TECHNICAL_VOICES[selectedQwenMale],
                  handleSelectQwenEnglishVoice,
                  tString(
                    'settings.voice.engine.qwenCastNote',
                    'Pick the voice that answers for female figures and the one for male figures. The opening line follows your pick.'
                  )
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
              <CosmicText variant="body-small" style={{ ...kickerStyle, margin: 0 }}>
                {tNode('settings.voice.speed')}
              </CosmicText>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--gold-primary)'
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
                  cursor: 'pointer',
                  minHeight: '44px',
                  accentColor: 'var(--gold-primary)'
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
              fontSize: '13px',
              color: INK_QUIET
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
  /** Off for a cast with one voice per gender, where there is nothing to pick. */
  showSelect?: boolean;
}

const CosmicVoiceCard: FC<CosmicVoiceCardProps> = ({
  voice,
  selected,
  previewing,
  onPreview,
  onSelect,
  showPreview = true,
  showSelect = true
}) => {
  const { tNode } = useTranslation();

  return (
    <div className="voice-plate-card" style={{
      padding: '12px',
      background: selected ? PLATE_GROUND_CHOSEN : PLATE_GROUND,
      border: selected ? '1px solid var(--gold-primary)' : PLATE_HAIRLINE,
      borderRadius: '4px',
      transition: 'background 0.2s ease, border-color 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{
        fontFamily: 'var(--font-content)',
        fontSize: '16px',
        fontWeight: 400,
        letterSpacing: '0.01em',
        textAlign: 'center',
        color: selected ? 'var(--gold-primary)' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <span style={{ display: 'flex', color: selected ? 'var(--gold-primary)' : 'var(--gold-deep)' }}>
          {voice.icon}
        </span>
        <span>{voice.name}</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: showPreview && showSelect ? '1fr 1fr' : '1fr',
        gap: '6px'
      }}>
        {showPreview && (
          <button
            onClick={onPreview}
            disabled={previewing}
            className={`voice-plate-btn${previewing ? ' voice-plate-btn--playing' : ''}`}
          >
            <Play size={16} weight="fill" />
            {previewing ? tNode('settings.voice.voiceSelection.playing') : tNode('settings.voice.voiceSelection.preview')}
          </button>
        )}
        {showSelect && (
          <button
            onClick={onSelect}
            disabled={selected}
            className={`voice-plate-btn ${selected ? 'voice-plate-btn--chosen' : 'voice-plate-btn--select'}`}
          >
            {selected ? <><Check size={16} weight="bold" /> {tNode('settings.voice.voiceSelection.selected')}</> : tNode('settings.voice.voiceSelection.select')}
          </button>
        )}
      </div>
    </div>
  );
};

export default VoicePanel;
