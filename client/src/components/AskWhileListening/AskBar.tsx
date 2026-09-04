// src/components/AskWhileListening/AskBar.tsx
// The invitation. One row under the plate, never a sheet that opens itself.
import { FC } from 'react';
import { Microphone } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';

interface AskBarProps {
  figureName: string;
  onOpen: () => void;
}

const AskBar: FC<AskBarProps> = ({ figureName, onOpen }) => {
  const { tString } = useTranslation();
  const label = tString('askListen.bar', 'Ask {name} about this').replace('{name}', figureName);

  return (
    <div className="ask-bar">
      <button type="button" className="ask-bar__button" onClick={onOpen}>
        <Microphone size={18} weight="duotone" aria-hidden="true" />
        <span className="ask-bar__label">{label}</span>
      </button>
    </div>
  );
};

export default AskBar;
