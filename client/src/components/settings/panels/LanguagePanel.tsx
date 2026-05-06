import React, { FC, ReactNode } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';

interface CosmicTextProps {
  children: ReactNode;
  className?: string;
  variant?: string;
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

interface LanguagePanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
  OptionButtons: React.ComponentType<any>;
  selectedLanguage: string;
  onChange: (value: string) => void;
}

const LanguagePanel: FC<LanguagePanelProps> = ({
  SettingCard,
  CATEGORY_ICONS,
  OptionButtons,
  selectedLanguage,
  onChange
}) => {
  const { tNode } = useTranslation();

  return (
    <SettingCard
      title={tNode('settings.language.title')}
      icon={CATEGORY_ICONS.language}
      description=""
    >
      <div className="language-selector">
        <CosmicText variant="body-small" className="setting-label">
          {tNode('settings.language.selectLabel')}
        </CosmicText>
        <OptionButtons
          options={[
            { label: 'English', value: 'en' },
            { label: 'German', value: 'de' }
          ]}
          selected={selectedLanguage}
          onChange={onChange}
        />
      </div>
    </SettingCard>
  );
};

export default LanguagePanel;