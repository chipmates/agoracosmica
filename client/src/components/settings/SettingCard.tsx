import { FC, ReactNode } from 'react';
import { CosmicHeading } from '../Typography';
import { FadeInWhenVisible } from '../MicroInteractions';

interface CosmicCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass';
  elevate?: boolean;
  [key: string]: any;
}

interface CosmicTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'body' | 'body-small' | 'body-large';
  [key: string]: any;
}

interface SettingCardProps {
  title: string;
  icon: ReactNode;
  description?: string;
  className?: string;
  children: ReactNode;
}

// Temporary components until we properly extract them from UIShowcase
const CosmicCard: FC<CosmicCardProps> = ({ children, className = '', variant = 'default', elevate = false, ...props }) => (
  <div className={`cosmic-card ${variant} ${elevate ? 'elevate' : ''} ${className}`} {...props}>
    {children}
  </div>
);

const CosmicText: FC<CosmicTextProps> = ({ children, className = '', variant = 'body', ...props }) => (
  <p className={`cosmic-text ${variant} ${className}`} {...props}>
    {children}
  </p>
);

// Card setting component
const SettingCard: FC<SettingCardProps> = ({
  title,
  icon,
  description,
  className = '',
  children
}) => {
  return (
    <FadeInWhenVisible>
      <CosmicCard
        variant="glass"
        elevate={true}
        className={`setting-card ${className}`}
      >
        <div className="setting-card-header">
          <div className="setting-card-icon">{icon}</div>
          <CosmicHeading level={3} className="setting-card-title">
            {title}
          </CosmicHeading>
        </div>

        {description && (
          <CosmicText
            variant="body-small"
            className="setting-card-description"
          >
            {description}
          </CosmicText>
        )}

        <div className="setting-card-content">
          {children}
        </div>
      </CosmicCard>
    </FadeInWhenVisible>
  );
};

export default SettingCard;