import React, { FC } from 'react';
import {
  Info,
  Sparkle,
  Heart,
  WarningCircle,
  CheckCircle,
  XCircle,
  GithubLogo,
  ArrowSquareOut
} from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import styles from '../../SettingsModal.module.css';

const InfoPanel: FC = () => {
  const { t, tNode, tArray, tString } = useTranslation();
  
  return (
    <div className={styles.tabPanel}>
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}>
          <Info size={24} />
        </div>
        <h2 className={styles.sectionTitle}>
          {tNode('settings.tabs.info')}
        </h2>
      </div>
      
      {/* KI-Echos Information */}
      <div id="ki-echos-section" style={{ marginBottom: '32px' }}>
        <h3 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '20px',
          fontWeight: '600',
          color: 'var(--gold-subtle)',
          marginBottom: '24px',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {tNode('quickHelp.echoes.title')}
        </h3>
        
        {/* What They Are */}
        <div className={styles.infoCard} style={{
          background: `linear-gradient(135deg,
            color-mix(in srgb, var(--success-color, #5cb85c) 15%, transparent) 0%,
            color-mix(in srgb, var(--success-color, #5cb85c) 10%, transparent) 100%)`,
          borderColor: 'var(--success-color, #5cb85c)',
          marginBottom: '20px'
        }}>
          <div className={styles.infoCardHeader}>
            <CheckCircle className={styles.infoCardIcon} style={{ color: 'var(--success-color, #5cb85c)' }} />
            <h4 className={styles.infoCardTitle}>
              {tNode('quickHelp.echoes.whatTheyAre.title')}
            </h4>
          </div>
          <div className={styles.infoCardContent}>
            <p style={{ marginBottom: '16px' }}>
              {tNode('quickHelp.echoes.whatTheyAre.description')}
            </p>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {tArray('quickHelp.echoes.whatTheyAre.points').map((point: string, index: number) => (
                <li key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '6px 0',
                  color: 'var(--text-primary)'
                }}>
                  <CheckCircle size={16} style={{ 
                    flexShrink: 0, 
                    marginTop: '2px',
                    color: 'var(--gold-primary)' 
                  }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* What They Are NOT */}
        <div className={styles.infoCard} style={{
          background: `linear-gradient(135deg,
            color-mix(in srgb, var(--mode-quest) 15%, transparent) 0%,
            color-mix(in srgb, var(--mode-quest) 10%, transparent) 100%)`,
          borderColor: 'var(--mode-quest)',
          marginBottom: '20px'
        }}>
          <div className={styles.infoCardHeader}>
            <XCircle className={styles.infoCardIcon} style={{ color: 'var(--mode-quest)' }} />
            <h4 className={styles.infoCardTitle}>
              {tNode('quickHelp.echoes.whatTheyAreNot.title')}
            </h4>
          </div>
          <div className={styles.infoCardContent}>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {tArray('quickHelp.echoes.whatTheyAreNot.points').map((point: string, index: number) => (
                <li key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '6px 0',
                  color: 'var(--text-primary)'
                }}>
                  <XCircle size={16} style={{ 
                    flexShrink: 0, 
                    marginTop: '2px',
                    color: 'var(--gold-primary)' 
                  }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Quote */}
        <div style={{
          position: 'relative',
          padding: '24px 28px',
          margin: '24px 0',
          background: 'rgba(16, 19, 56, 0.4)',
          borderLeft: '3px solid var(--gold-subtle)',
          borderRadius: '12px',
          fontStyle: 'italic'
        }}>
          <p style={{
            margin: 0,
            lineHeight: '1.8',
            color: 'var(--text-primary)',
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '15px'
          }}>
            {tNode('quickHelp.echoes.quote')}
          </p>
        </div>
        
        {/* Note */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px',
          background: 'color-mix(in srgb, var(--gold-subtle) 8%, transparent)',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--gold-subtle) 20%, transparent)'
        }}>
          <WarningCircle size={20} style={{ 
            flexShrink: 0, 
            marginTop: '2px',
            color: 'var(--gold-subtle)' 
          }} />
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('quickHelp.echoes.note')}
          </p>
        </div>
      </div>
      
      {/* ChipMates Mission Statement */}
      <div className={styles.missionStatement} style={{
        background: `linear-gradient(
          135deg,
          color-mix(in srgb, var(--mode-wisdom) 8%, transparent) 0%,
          color-mix(in srgb, var(--mode-wisdom) 5%, transparent) 100%
        )`,
        borderColor: 'var(--mode-wisdom)'
      }}>
        <Heart className={styles.missionIcon} style={{ color: 'var(--mode-wisdom)' }} />
        <h3 className={styles.missionTitle}>
          {tNode('settings.help.mission.title')}
        </h3>
        <p className={styles.missionText} style={{ whiteSpace: 'pre-line' }}>
          {tNode('settings.help.mission.text')}
        </p>

        {/* Our Values */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'color-mix(in srgb, var(--mode-wisdom) 10%, transparent)',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--mode-wisdom) 20%, transparent)'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--mode-wisdom)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.values.title')}
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            <p style={{ margin: 0 }}>• {tNode('settings.help.values.gratitude')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.values.curiosity')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.values.openness')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.values.transformation')}</p>
          </div>
        </div>

        {/* Breaking Down Barriers */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'color-mix(in srgb, var(--mode-wisdom) 10%, transparent)',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--mode-wisdom) 20%, transparent)'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--mode-wisdom)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.barriers.title')}
          </h4>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.barriers.intro')}
          </p>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            <p style={{ margin: 0 }}>• {tNode('settings.help.barriers.geographic')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.barriers.economic')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.barriers.academic')}</p>
            <p style={{ margin: 0 }}>• {tNode('settings.help.barriers.age')}</p>
          </div>
        </div>

        {/* Vision */}
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'color-mix(in srgb, var(--mode-wisdom) 10%, transparent)',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--mode-wisdom) 20%, transparent)'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--mode-wisdom)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.vision.title')}
          </h4>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.vision.text')}
          </p>
        </div>

        {/* Community */}
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'color-mix(in srgb, var(--mode-wisdom) 10%, transparent)',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--mode-wisdom) 20%, transparent)'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--mode-wisdom)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.community.title')}
          </h4>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            {tNode('settings.help.community.text')}
          </p>
        </div>

        <div style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-secondary)',
          fontSize: '13px'
        }}>
          <Sparkle size={16} style={{ color: 'var(--mode-wisdom)' }} />
          <span style={{ color: 'var(--mode-wisdom)' }}>
            {tNode('settings.help.broughtBy')}
          </span>
        </div>

        <div className={styles.githubSourceLinkRow}>
          <a
            href="https://github.com/chipmates/agoracosmica"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubSourceLink}
            aria-label={tString('settings.help.viewSourceOnGithubAria')}
          >
            <GithubLogo size={16} weight="regular" />
            <span>{tNode('settings.help.viewSourceOnGithub')}</span>
            <ArrowSquareOut size={12} weight="regular" className={styles.githubSourceLinkExternalIcon} aria-hidden="true" />
          </a>
        </div>
      </div>

    </div>
  );
};

export default InfoPanel;