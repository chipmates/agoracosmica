import { useState, useEffect, FC, ReactNode } from 'react';
import {
  Shield,
  Gear,
  Info,
  Monitor,
  Globe,
  SpeakerHigh,
  Microphone,
  Brain,
  Gavel,
  Key
} from '@phosphor-icons/react';
import { ModalContainer, ModalHeader } from './Modal';
import { RippleButton } from './Button';
import { useTranslation } from '../hooks/useTranslation';
import { useDomainStore } from '../stores/domainStore';
import styles from './SettingsModal.module.css';
import './SettingsModal.css'; // For ChangesAlertDialog and other component styles

// Import required components for panels (EXACT same as old SettingsModal)
import SettingCard from './settings/SettingCard';
import OptionButtons from './settings/OptionButtons';
import ChangesAlertDialog from './settings/ChangesAlertDialog';

// Import panel components
import RechtDatenschutzPanel from './settings/panels/RechtDatenschutzPanel';
import PraeferenzenPanel from './settings/panels/PraeferenzenPanel';
import InfoPanel from './settings/panels/InfoPanel';

// Import settings service
import {
  handleConfigChange,
  saveConfiguration,
  loadServiceConfig
} from '../services/settings/settingsService';
// TTS/STT fully self-hosted on GEX130 — no provider selection needed

interface Tab {
  id: string;
  icon: ReactNode;
  titleKey: string;
}

interface CategoryIcons {
  [key: string]: ReactNode;
}

interface Config {
  [key: string]: any;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

// Category icons mapping - EXACT same as old SettingsModal
const CATEGORY_ICONS: CategoryIcons = {
  legal: <Gavel size={24} />,
  display: <Monitor size={24} />,
  language: <Globe size={24} />,
  voice: <SpeakerHigh size={24} />,
  speech: <Microphone size={24} />,
  model: <Brain size={24} />,
  apiKeys: <Key size={24} />,
  info: <Info size={24} />
};

// Tab configuration with optimized icons
const TABS: Tab[] = [
  {
    id: 'legal',
    icon: <Shield size={20} />, // Shield conveys protection & privacy perfectly
    titleKey: 'settings.tabs.legal'
  },
  {
    id: 'preferences',
    icon: <Gear size={20} />, // Settings is universally understood
    titleKey: 'settings.tabs.preferences'
  },
  {
    id: 'info',
    icon: <Info size={20} />, // Info icon for KI-Echos and mission
    titleKey: 'settings.tabs.info'
  }
];

const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'legal');
  const [config, setConfig] = useState<Config>(loadServiceConfig());
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [showChangesAlert, setShowChangesAlert] = useState<boolean>(false);
  
  const { tString, tNode } = useTranslation();
  const language = useDomainStore((state) => state.language.current);
  const setLanguage = useDomainStore((state) => state.setLanguage);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);

  // Reset state when modal opens
  // NOTE: Only depend on isOpen, not language, to prevent infinite loops
  // Language changes are handled separately and don't require full reset
  useEffect(() => {
    if (isOpen) {
      setConfig(loadServiceConfig());
      setSelectedLanguage(language);
      setIsDirty(false);
      setActiveTab(initialTab || 'legal');
      setShowChangesAlert(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Handle tab change
  const handleTabChange = (tabId: string): void => {
    if (isDirty && activeTab === 'preferences') {
      setShowChangesAlert(true);
      return;
    }
    setActiveTab(tabId);
  };
  
  // Handle config changes
  const handleChange = (section: string, value: any): void => {
    setConfig((prev) => {
      const newConfig = handleConfigChange(prev as any, section, value);
      setIsDirty(true);
      return newConfig;
    });
  };
  
  // Handle language change
  // Note: TTS/STT auto-migration removed (Oct 2025) - DeepInfra handles all languages
  const handleLanguageChange = (newLang: string): void => {
    setSelectedLanguage(newLang);
    setIsDirty(true);
  };
  
  // Save changes
  const handleSave = (): void => {
    saveConfiguration(config as any);
    if (selectedLanguage !== language) {
      setLanguage(selectedLanguage);
    }
    setIsDirty(false);
    setShowChangesAlert(false);
  };
  
  // Discard changes
  const handleDiscard = (): void => {
    setConfig(loadServiceConfig());
    setSelectedLanguage(language);
    setIsDirty(false);
    setShowChangesAlert(false);
  };
  
  // Handle close with dirty check
  const handleClose = (): void => {
    if (isDirty) {
      setShowChangesAlert(true);
    } else {
      onClose();
    }
  };
  
  // Handle navigation to AI info
  const handleNavigateToAIInfo = (): void => {
    setActiveTab('info');
    setTimeout(() => {
      const kiEchosSection = document.getElementById('ki-echos-section');
      if (kiEchosSection) {
        kiEchosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  
  // Render tab content
  const renderTabContent = (): ReactNode => {
    switch (activeTab) {
      case 'legal':
        return <RechtDatenschutzPanel onNavigateToAIInfo={handleNavigateToAIInfo} />;

      case 'preferences':
        return (
          <PraeferenzenPanel
            config={config}
            selectedLanguage={selectedLanguage}
            onChange={handleChange}
            onLanguageChange={handleLanguageChange}
            // Pass ALL required props for child panels - EXACT same as old SettingsModal
            SettingCard={SettingCard}
            OptionButtons={OptionButtons}
            CATEGORY_ICONS={CATEGORY_ICONS}
          />
        );

      case 'info':
        return <InfoPanel />;

      default:
        return null;
    }
  };
  
  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.modal}
      animationType="fade-scale"
      backgroundVariant="onboarding"
    >
      {/* Changes Alert Dialog - Using the ACTUAL component from old SettingsModal */}
      <ChangesAlertDialog
        isVisible={showChangesAlert}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
      
      {/* Modal Header */}
      <ModalHeader
        layout="three-column"
        title={tString('settings.title', 'Einstellungen')}
        onClose={handleClose}
        closeAriaLabel={tString('common.close', 'Close')}
        cosmicStars={true}
      />
      
      {/* Tab Navigation */}
      <nav className={styles.tabNav} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`${tab.id}-tab-button`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tNode(tab.titleKey)}</span>
          </button>
        ))}
      </nav>
      
      {/* Content Area */}
      <div className={styles.content}>
        {TABS.map((tab) => (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${tab.id}-tab-button`}
            hidden={activeTab !== tab.id}
            className={styles.tabPanel}
          >
            {activeTab === tab.id && renderTabContent()}
          </div>
        ))}
      </div>
      
      {/* Footer — only the save/discard actions for unsaved preference edits.
          The Logout button was removed: in a local-first app with no account
          there is no session to end, and deleting the profile only forced
          returning visitors back through the first-run entry. */}
      {isDirty && activeTab === 'preferences' && (
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <RippleButton
              variant="coral"
              onClick={handleDiscard}
              size="small"
            >
              {tNode('settings.cancel')}
            </RippleButton>
            <RippleButton
              variant="gold"
              onClick={handleSave}
              size="small"
            >
              {tNode('settings.save')}
            </RippleButton>
          </div>
        </div>
      )}
    </ModalContainer>
  );
};

export default SettingsModal;