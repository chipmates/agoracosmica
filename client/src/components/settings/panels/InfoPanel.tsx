import { CSSProperties, FC } from 'react';
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

/* Plate language for the mission block. Inline because the shell stylesheet
   is shared with the other settings panels. */
const headingInk = 'color-mix(in srgb, var(--gold-primary) 85%, var(--text-tertiary))';
const quietGold = 'color-mix(in srgb, var(--gold-deep) 90%, var(--text-tertiary))';

const plateCard: CSSProperties = {
  marginTop: '20px',
  padding: '18px 20px',
  background: 'color-mix(in srgb, var(--bg-card) 72%, var(--bg-void))',
  border: '1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent)',
  borderRadius: '3px',
  textAlign: 'left'
};

const plateTitle: CSSProperties = {
  margin: '0 0 14px 0',
  fontFamily: 'var(--font-content)',
  fontSize: '1.02rem',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: 1.35,
  color: headingInk
};

const plateBody: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-content)',
  fontSize: '0.92rem',
  lineHeight: 1.7,
  color: 'var(--text-primary)'
};

const plateList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  fontFamily: 'var(--font-content)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
  color: 'var(--text-primary)'
};

/* Hanging indent keeps wrapped German lines off the bullet column */
const plateListItem: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1em',
  textIndent: '-1.1em'
};

const InfoPanel: FC = () => {
  const { tNode, tArray, tString, language } = useTranslation();
  const echoesPath = language === 'de' ? '/de/echoes/' : '/echoes/';
  
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
          fontFamily: 'var(--font-content)',
          fontSize: 'clamp(1.15rem, 1.05rem + 0.5vw, 1.35rem)',
          fontWeight: 400,
          color: headingInk,
          margin: '0 0 24px 0',
          textAlign: 'left',
          letterSpacing: 0,
          lineHeight: 1.3
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

        {/* The full disclosure essay (Tier 3) on the landing site */}
        <div className={styles.githubSourceLinkRow}>
          <a
            href={echoesPath}
            target="_blank"
            rel="noopener"
            className={styles.githubSourceLink}
          >
            <span>{tNode('quickHelp.echoes.essayLink')}</span>
            <ArrowSquareOut size={12} weight="regular" className={styles.githubSourceLinkExternalIcon} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* ChipMates Mission Statement */}
      <div className={styles.missionStatement} style={{ textAlign: 'left' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '18px'
        }}>
          <Heart size={18} style={{ flexShrink: 0, marginTop: '4px', color: quietGold }} />
          <h3 className={styles.missionTitle} style={{
            margin: 0,
            fontFamily: 'var(--font-content)',
            fontSize: 'clamp(1.15rem, 1.05rem + 0.5vw, 1.35rem)',
            fontWeight: 400,
            letterSpacing: 0,
            lineHeight: 1.3,
            textTransform: 'none',
            color: headingInk
          }}>
            {tNode('settings.help.mission.title')}
          </h3>
        </div>
        <p className={styles.missionText} style={{
          whiteSpace: 'pre-line',
          margin: 0,
          maxWidth: '64ch',
          fontFamily: 'var(--font-content)',
          fontSize: 'clamp(0.95rem, 0.92rem + 0.2vw, 1.02rem)',
          lineHeight: 1.75,
          textAlign: 'left',
          color: 'var(--text-primary)'
        }}>
          {tNode('settings.help.mission.text')}
        </p>

        {/* Our Values */}
        <div style={{ ...plateCard, marginTop: '24px' }}>
          <h4 style={plateTitle}>
            {tNode('settings.help.values.title')}
          </h4>
          <div style={plateList}>
            <p style={plateListItem}>• {tNode('settings.help.values.gratitude')}</p>
            <p style={plateListItem}>• {tNode('settings.help.values.curiosity')}</p>
            <p style={plateListItem}>• {tNode('settings.help.values.openness')}</p>
            <p style={plateListItem}>• {tNode('settings.help.values.transformation')}</p>
          </div>
        </div>

        {/* Breaking Down Barriers */}
        <div style={plateCard}>
          <h4 style={plateTitle}>
            {tNode('settings.help.barriers.title')}
          </h4>
          <p style={{ ...plateBody, marginBottom: '12px' }}>
            {tNode('settings.help.barriers.intro')}
          </p>
          <div style={plateList}>
            <p style={plateListItem}>• {tNode('settings.help.barriers.geographic')}</p>
            <p style={plateListItem}>• {tNode('settings.help.barriers.economic')}</p>
            <p style={plateListItem}>• {tNode('settings.help.barriers.academic')}</p>
            <p style={plateListItem}>• {tNode('settings.help.barriers.age')}</p>
          </div>
        </div>

        {/* Vision */}
        <div style={plateCard}>
          <h4 style={plateTitle}>
            {tNode('settings.help.vision.title')}
          </h4>
          <p style={plateBody}>
            {tNode('settings.help.vision.text')}
          </p>
        </div>

        {/* Community */}
        <div style={plateCard}>
          <h4 style={plateTitle}>
            {tNode('settings.help.community.title')}
          </h4>
          <p style={plateBody}>
            {tNode('settings.help.community.text')}
          </p>
        </div>

        <div style={{
          marginTop: '22px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-content)',
          fontSize: '0.85rem',
          lineHeight: 1.5
        }}>
          <Sparkle size={14} style={{ flexShrink: 0, marginTop: '3px', color: quietGold }} />
          <span>
            {tNode('settings.help.broughtBy')}
          </span>
        </div>

        <div className={styles.githubSourceLinkRow} style={{ justifyContent: 'flex-start', marginTop: '18px' }}>
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