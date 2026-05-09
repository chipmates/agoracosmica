import { FC, KeyboardEvent } from 'react';
import {
  Shield,
  Database,
  Microphone,
  Eye,
  FileText,
  Gavel,
  Cookie,
  Warning,
  Brain,
  CheckCircle,
  Globe,
  Trash,
  ArrowSquareOut,
  Info,
} from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import { clearAllUserData } from '../../../services/storage/clearAllUserData';
import styles from '../../SettingsModal.module.css';

interface RechtDatenschutzPanelProps {
  onNavigateToAIInfo?: () => void;
}

type SubProcessorKey = 'hetzner' | 'nebius' | 'cloudflare' | 'openrouter';

const SUB_PROCESSORS: { key: SubProcessorKey; avatar: string }[] = [
  { key: 'hetzner', avatar: 'H' },
  { key: 'nebius', avatar: 'N' },
  { key: 'cloudflare', avatar: 'CF' },
  { key: 'openrouter', avatar: 'OR' },
];

const RechtDatenschutzPanel: FC<RechtDatenschutzPanelProps> = ({ onNavigateToAIInfo }) => {
  const { tString, tNode } = useTranslation();

  // Navigate to legal pages — allowlist prevents open redirect
  const LEGAL_PATHS = ['/impressum', '/datenschutz', '/cookie-policy', '/nutzungsbedingungen'] as const;
  const openLegalPage = (path: typeof LEGAL_PATHS[number]): void => {
    if (LEGAL_PATHS.includes(path)) {
      window.location.href = path;
    }
  };

  const handleClearAll = async (): Promise<void> => {
    const confirmMsg = tString(
      'settings.legal.privacyByDesign.clearAllConfirm',
      'This deletes all your conversations, your OpenRouter key, and every setting on this device. The app will reload. Continue?',
    );
    if (!window.confirm(confirmMsg)) return;
    await clearAllUserData();
  };

  return (
    <div className={styles.tabPanel}>
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}>
          <Gavel size={24} />
        </div>
        <h2 className={styles.sectionTitle}>
          {tNode('settings.legal.title')}
        </h2>
      </div>

      {/* AI Disclosure Banner */}
      <div className={styles.aiDisclosureBanner}>
        <div className={styles.aiDisclosureContent}>
          <Warning size={20} className={styles.aiDisclosureIcon} />
          <span className={styles.aiDisclosureText}>
            {tNode('quickHelp.aiDisclosure')}
          </span>
        </div>
        <button
          className={styles.aiDisclosureButton}
          onClick={onNavigateToAIInfo}
        >
          {tNode('quickHelp.learnMore')}
        </button>
      </div>

      {/* Legal Documents */}
      <div style={{ marginTop: '32px', marginBottom: '24px' }}>
        <h3 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--gold-subtle)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Gavel size={20} weight="regular" />
          {tNode('settings.legal.documents.title')}
        </h3>

        <div className={styles.legalGrid}>
          <div
            className={styles.legalCard}
            onClick={() => { window.location.href = '/about'; }}
            role="button"
            tabIndex={0}
            aria-label={tString('legal.links.about', 'About Us')}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' || e.key === ' ') && (window.location.href = '/about')}
          >
            <Info className={styles.legalCardIcon} />
            <div className={styles.legalCardTitle}>
              {tNode('legal.links.about')}
            </div>
            <div className={styles.legalCardDescription}>
              {tNode('settings.legal.documents.about.description')}
            </div>
          </div>

          <div
            className={styles.legalCard}
            onClick={() => openLegalPage('/impressum')}
            role="button"
            tabIndex={0}
            aria-label={tString('legal.links.imprint', 'Impressum')}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' || e.key === ' ') && openLegalPage('/impressum')}
          >
            <FileText className={styles.legalCardIcon} />
            <div className={styles.legalCardTitle}>
              {tNode('legal.links.imprint')}
            </div>
            <div className={styles.legalCardDescription}>
              {tNode('settings.legal.documents.imprint.description')}
            </div>
          </div>

          <div
            className={styles.legalCard}
            onClick={() => openLegalPage('/datenschutz')}
            role="button"
            tabIndex={0}
            aria-label={tString('legal.links.privacy', 'Datenschutz')}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' || e.key === ' ') && openLegalPage('/datenschutz')}
          >
            <Shield className={styles.legalCardIcon} />
            <div className={styles.legalCardTitle}>
              {tNode('legal.links.privacy')}
            </div>
            <div className={styles.legalCardDescription}>
              {tNode('settings.legal.documents.privacy.description')}
            </div>
          </div>

          <div
            className={styles.legalCard}
            onClick={() => openLegalPage('/cookie-policy')}
            role="button"
            tabIndex={0}
            aria-label={tString('legal.links.cookiePolicy', 'Cookie Policy')}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' || e.key === ' ') && openLegalPage('/cookie-policy')}
          >
            <Cookie className={styles.legalCardIcon} />
            <div className={styles.legalCardTitle}>
              {tNode('legal.links.cookiePolicy')}
            </div>
            <div className={styles.legalCardDescription}>
              {tNode('settings.legal.documents.cookie.description')}
            </div>
          </div>

          <div
            className={styles.legalCard}
            onClick={() => openLegalPage('/nutzungsbedingungen')}
            role="button"
            tabIndex={0}
            aria-label={tString('legal.links.terms', 'Nutzungsbedingungen')}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => (e.key === 'Enter' || e.key === ' ') && openLegalPage('/nutzungsbedingungen')}
          >
            <Gavel className={styles.legalCardIcon} />
            <div className={styles.legalCardTitle}>
              {tNode('legal.links.terms')}
            </div>
            <div className={styles.legalCardDescription}>
              {tNode('settings.legal.documents.terms.description')}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy by Design — trust strip + 4 cards */}
      <div style={{ marginTop: '32px', marginBottom: '24px' }}>
        <h3 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--gold-subtle)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Shield size={20} weight="regular" />
          {tNode('settings.legal.dataProtection.title')}
        </h3>

        <div className={styles.trustStrip}>
          <div className={styles.trustBadges}>
            <span className={styles.trustBadge}>
              <CheckCircle weight="fill" className={styles.trustBadgeIcon} />
              {tNode('settings.legal.privacyByDesign.trustNonprofit')}
            </span>
            <a
              href="https://github.com/chipmates/agoracosmica"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.trustBadge} ${styles.trustBadgeLink}`}
              aria-label={tString('settings.legal.privacyByDesign.trustOpenSourceAria')}
            >
              <CheckCircle weight="fill" className={styles.trustBadgeIcon} />
              {tNode('settings.legal.privacyByDesign.trustOpenSource')}
              <ArrowSquareOut weight="regular" className={styles.trustBadgeExternalIcon} aria-hidden="true" />
            </a>
            <span className={styles.trustBadge}>
              <CheckCircle weight="fill" className={styles.trustBadgeIcon} />
              {tNode('settings.legal.privacyByDesign.trustNoTracking')}
            </span>
          </div>
          <p className={styles.trustProof}>
            {tNode('settings.legal.privacyByDesign.trustProof')}
          </p>
        </div>

        <div className={styles.privacyGrid}>
          <div className={styles.privacyCard}>
            <div className={styles.privacyCardHeader}>
              <Database className={styles.privacyCardIcon} />
              <h4 className={styles.privacyCardTitle}>
                {tNode('quickHelp.privacy.dataStorage.title')}
              </h4>
            </div>
            <p className={styles.privacyCardDescription}>
              {tNode('quickHelp.privacy.dataStorage.description')}
            </p>
            <ul className={styles.privacyList}>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.dataStorage.points.0')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.dataStorage.points.1')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.dataStorage.points.2')}
              </li>
            </ul>
            <button
              type="button"
              className={styles.clearAllButton}
              onClick={handleClearAll}
            >
              <Trash size={14} weight="regular" />
              {tNode('settings.legal.privacyByDesign.clearAllButton')}
            </button>
          </div>

          <div className={styles.privacyCard}>
            <div className={styles.privacyCardHeader}>
              <Microphone className={styles.privacyCardIcon} />
              <h4 className={styles.privacyCardTitle}>
                {tNode('quickHelp.privacy.voice.title')}
              </h4>
            </div>
            <p className={styles.privacyCardDescription}>
              {tNode('quickHelp.privacy.voice.description')}
            </p>
            <ul className={styles.privacyList}>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.voice.points.0')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.voice.points.1')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.voice.points.2')}
              </li>
            </ul>
          </div>

          <div className={styles.privacyCard}>
            <div className={styles.privacyCardHeader}>
              <Eye className={styles.privacyCardIcon} />
              <h4 className={styles.privacyCardTitle}>
                {tNode('quickHelp.privacy.tracking.title')}
              </h4>
            </div>
            <p className={styles.privacyCardDescription}>
              {tNode('quickHelp.privacy.tracking.description')}
            </p>
            <ul className={styles.privacyList}>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.tracking.points.0')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.tracking.points.1')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.tracking.points.2')}
              </li>
            </ul>
          </div>

          <div className={styles.privacyCard}>
            <div className={styles.privacyCardHeader}>
              <Brain className={styles.privacyCardIcon} />
              <h4 className={styles.privacyCardTitle}>
                {tNode('quickHelp.privacy.aiModels.title')}
              </h4>
            </div>
            <p className={styles.privacyCardDescription}>
              {tNode('quickHelp.privacy.aiModels.description')}
            </p>
            <ul className={styles.privacyList}>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.aiModels.points.0')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.aiModels.points.1')}
              </li>
              <li className={styles.privacyListItem}>
                {tNode('quickHelp.privacy.aiModels.points.2')}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sub-processors — vendor transparency */}
      <div style={{ marginTop: '32px', marginBottom: '8px' }}>
        <h3 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--gold-subtle)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Globe size={20} weight="regular" />
          {tNode('settings.legal.subProcessors.title')}
        </h3>

        <p className={styles.subProcessorIntro}>
          {tNode('settings.legal.subProcessors.intro')}
        </p>

        <div className={styles.subProcessorList}>
          {SUB_PROCESSORS.map(({ key, avatar }) => (
            <div key={key} className={styles.subProcessorRow}>
              <div className={styles.subProcessorAvatar}>{avatar}</div>
              <h4 className={styles.subProcessorName}>
                {tNode(`settings.legal.subProcessors.${key}.name`)}
                <span className={styles.subProcessorRegion}>
                  · {tNode(`settings.legal.subProcessors.${key}.region`)}
                </span>
              </h4>
              <p className={styles.subProcessorPurpose}>
                {tNode(`settings.legal.subProcessors.${key}.purpose`)}
              </p>
              <span className={styles.subProcessorStatus}>
                {tNode(`settings.legal.subProcessors.${key}.status`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RechtDatenschutzPanel;
