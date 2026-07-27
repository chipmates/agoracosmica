import React, { FC, ReactNode, CSSProperties } from 'react';
import { Rocket, DeviceMobile, Microphone, Article, DotsThree } from '@phosphor-icons/react';
import ToggleSwitch from '../../ToggleSwitch';
import { useTranslation } from '../../../hooks/useTranslation';
import { isIOSSafari } from '../../../utils/deviceDetection';
// STT is always self-hosted on GEX130 — no service selection needed

interface CosmicTextProps {
  children: ReactNode;
  className?: string;
  variant?: string;
  style?: CSSProperties;
  [key: string]: any;
}

// Temporary CosmicText until we properly extract it
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

// Plate language: night ground, one gold-deep hairline, callouts on a navy
// plate with a gold-deep left rule.
// --text-secondary is self-referential inside `.setting-card`, which voids the
// token and leaves text inheriting gold. Body ink is derived from --text-primary,
// which is stable in this scope.
const INK_BODY = 'color-mix(in srgb, var(--text-primary) 88%, var(--bg-void))';
const PLATE_GROUND = 'color-mix(in srgb, var(--bg-card) 82%, var(--bg-void))';
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

interface SpeechConfig {
  sttEnabled?: boolean;
  stt?: string;
  [key: string]: any;
}

interface SpeechPanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
  config: SpeechConfig;
  onChange: (key: string, value: any) => void;
}

const SpeechPanel: FC<SpeechPanelProps> = ({
  SettingCard,
  CATEGORY_ICONS,
  config,
  onChange
}) => {
  const { t, tString, tNode } = useTranslation();


  return (
    <SettingCard
      title={t('settings.speech.title')}
      icon={CATEGORY_ICONS.speech}
      description={t('settings.speech.description')}
    >
      {/* Voice Input Only Toggle */}
      <div style={{
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
            {tNode('settings.speech.enabled')}
          </CosmicText>
          <ToggleSwitch
            checked={config.sttEnabled !== false}
            onChange={(value) => onChange('sttEnabled', value)}
            size="medium"
            ariaLabel={tString('settings.speech.enabled')}
          />
        </div>
      </div>

      {/* Self-hosted STT info */}
      <div style={{
        marginTop: '12px',
        padding: '12px 14px',
        background: CALLOUT_GROUND,
        borderLeft: CALLOUT_RULE,
        borderRadius: '4px',
        fontSize: '13px',
        color: INK_BODY
      }}>
        <div style={{ ...kickerStyle, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Rocket size={16} weight="fill" style={{ flexShrink: 0, color: 'var(--gold-deep)' }} />
          {tString('settings.speech.privacyTitle', 'Whisper · EU Server · No profiling')}
        </div>
        <div style={{ lineHeight: 1.5 }}>
          {tString('settings.speech.privacyNote', 'Speech recognition runs on our own servers in Germany. No data leaves the EU.')}
        </div>
      </div>

      {/* iOS Safari Microphone Setup Guide - LAST */}
      {isIOSSafari() && config.sttEnabled !== false && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: PLATE_GROUND,
          border: PLATE_HAIRLINE,
          borderRadius: '6px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
            fontFamily: 'var(--font-content)',
            fontWeight: 400,
            fontSize: '17px',
            color: 'var(--gold-primary)'
          }}>
            <DeviceMobile size={20} weight="duotone" color="var(--gold-deep)" />
            <span>{tNode('settings.speech.ios.title')}</span>
          </div>

          <CosmicText variant="body-small" style={{ marginBottom: '12px', color: INK_BODY, lineHeight: 1.5 }}>
            {tNode('settings.speech.ios.intro')}
          </CosmicText>

          <ol style={{
            margin: '0 0 12px 0',
            paddingLeft: '20px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: INK_BODY
          }}>
            <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>
                {tNode('settings.speech.ios.step1')} <Article size={18} weight="fill" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 3px', opacity: 0.9 }} /> {tNode('settings.speech.ios.step1b')}
              </span>
            </li>
            <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>
                {tNode('settings.speech.ios.step2')} <DotsThree size={18} weight="fill" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 3px', opacity: 0.9 }} /> {tNode('settings.speech.ios.step2b')}
              </span>
            </li>
            <li style={{ marginBottom: '6px' }}>
              {tNode('settings.speech.ios.step3')}
            </li>
            <li style={{ marginBottom: '6px' }}>
              {tNode('settings.speech.ios.step4')}
            </li>
          </ol>

          <div style={{
            padding: '10px 14px',
            background: CALLOUT_GROUND,
            borderLeft: CALLOUT_RULE,
            borderRadius: '4px',
            fontSize: '13px',
            color: INK_BODY,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Microphone size={16} weight="fill" color="var(--gold-deep)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ lineHeight: 1.5 }}>
              {tNode('settings.speech.ios.benefit')}
            </span>
          </div>
        </div>
      )}
    </SettingCard>
  );
};

export default SpeechPanel;