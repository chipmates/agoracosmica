import { FC, ReactNode } from 'react';
import { Warning } from '@phosphor-icons/react';
import { RippleButton } from '../Button';
import { CosmicHeading } from '../Typography';
import { useTranslation } from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CosmicTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'body' | 'small' | 'large';
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

interface ChangesAlertDialogProps {
  isVisible: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

const ChangesAlertDialog: FC<ChangesAlertDialogProps> = ({ 
  isVisible, 
  onDiscard, 
  onSave 
}) => {
  const { tNode } = useTranslation();
  const trapRef = useFocusTrap({ onClose: onDiscard, enabled: isVisible });

  if (!isVisible) return null;

  return (
    <div className="settings-alert-overlay">
      <div ref={trapRef} className="settings-alert" role="alertdialog" aria-modal="true" tabIndex={-1}>
        <div className="settings-alert-icon">
          <Warning size={32} />
        </div>
        <CosmicHeading level={3}>
          {tNode('settings.unsavedChanges.title')}
        </CosmicHeading>
        <CosmicText>
          {tNode('settings.unsavedChanges.message')}
        </CosmicText>
        <div className="settings-alert-actions">
          <RippleButton
            variant="coral"
            onClick={onDiscard}
          >
            {tNode('settings.unsavedChanges.discard')}
          </RippleButton>
          <RippleButton
            variant="gold"
            onClick={onSave}
          >
            {tNode('settings.unsavedChanges.save')}
          </RippleButton>
        </div>
      </div>
    </div>
  );
};

export default ChangesAlertDialog;