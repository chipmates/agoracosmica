import { FC, ReactNode } from 'react';
import { Check } from '@phosphor-icons/react';

interface Option {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
}

interface OptionButtonsProps {
  options: Option[];
  selected: string;
  onChange: (value: string) => void;
  layout?: 'horizontal' | 'grid';
}

// Option button group component
const OptionButtons: FC<OptionButtonsProps> = ({ 
  options, 
  selected, 
  onChange,
  layout = 'horizontal'  // 'horizontal' or 'grid'
}) => {
  return (
    <div className={`settings-options ${layout === 'grid' ? 'settings-options-grid' : ''}`}>
      {options.map(({ label, value, description, icon }) => (
        <button
          key={value}
          className={`option-button ${selected === value ? 'active' : ''}`}
          onClick={() => onChange(value)}
          aria-pressed={selected === value}
        >
          {icon && <span className="option-button-icon">{icon}</span>}
          <span className="option-button-label">{label}</span>
          {description && (
            <span className="option-button-description">{description}</span>
          )}
          {selected === value && (
            <span className="option-selected-indicator">
              <Check size={16} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default OptionButtons;