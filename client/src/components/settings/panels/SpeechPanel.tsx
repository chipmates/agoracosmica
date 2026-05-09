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
            {tNode('settings.speech.enabled')}
          </CosmicText>
          <ToggleSwitch
            checked={config.sttEnabled !== false}
            onChange={(value) => onChange('sttEnabled', value)}
            size="medium"
          />
        </div>
      </div>

      {/* Self-hosted STT info */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: 'rgba(46, 213, 115, 0.08)',
        borderLeft: '3px solid var(--success-green)',
        borderRadius: '4px',
        fontSize: '13px'
      }}>
        <div style={{ marginBottom: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Rocket size={16} weight="fill" />
          {tString('settings.speech.privacyTitle', 'Whisper · EU Server · No User Tracking')}
        </div>
        <div style={{ opacity: 0.9, lineHeight: 1.4 }}>
          {tString('settings.speech.privacyNote', 'Speech recognition runs on our own servers in Germany. No data leaves the EU.')}
        </div>
      </div>

      {/* iOS Safari Microphone Setup Guide - LAST */}
      {isIOSSafari() && config.sttEnabled !== false && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(212, 165, 57, 0.08)',
          border: '1px solid rgba(212, 165, 57, 0.2)',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            <DeviceMobile size={20} weight="duotone" color="var(--gold-base)" />
            <span>{tNode('settings.speech.ios.title')}</span>
          </div>

          <CosmicText variant="body-small" style={{ marginBottom: '12px', opacity: 0.9, lineHeight: 1.5 }}>
            {tNode('settings.speech.ios.intro')}
          </CosmicText>

          <ol style={{
            margin: '0 0 12px 0',
            paddingLeft: '20px',
            fontSize: '13px',
            lineHeight: 1.6
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
            padding: '10px 12px',
            background: 'rgba(212, 165, 57, 0.12)',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <Microphone size={16} weight="fill" color="var(--gold-base)" />
            <span style={{ opacity: 0.95, lineHeight: 1.4 }}>
              {tNode('settings.speech.ios.benefit')}
            </span>
          </div>
        </div>
      )}
    </SettingCard>
  );
};

export default SpeechPanel;