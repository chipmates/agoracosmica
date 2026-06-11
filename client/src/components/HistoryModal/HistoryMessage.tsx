import React, { FC, ReactNode } from 'react';
import { sanitizeContent } from '../../utils/sanitizeContent';
import { MODES } from './historyModalConstants';
import type { Message } from './historyModalTypes';

interface HistoryMessageProps {
  entry: Message;
  index: number;
  selectedFigureName: string;
  seekerLabel: string;
  formatSummary: (content: string) => ReactNode;
}

const HistoryMessage: FC<HistoryMessageProps> = ({
  entry,
  index,
  selectedFigureName,
  seekerLabel,
  formatSummary
}) => {
  if (entry.isSummary) {
    return <React.Fragment key={index}>{formatSummary(entry.content)}</React.Fragment>;
  }

  const mode = entry.mode || 'introduction';
  const modeConfig = MODES[mode];
  const Icon = modeConfig?.icon;

  return (
    <div
      key={index}
      className={`message ${entry.role} mode-${mode}`}
      style={entry.role === 'user' ? {
        backgroundColor: 'var(--mode-quest)',
        color: 'white'
      } : {}}
    >
      <div className="message-header">
        {Icon && <Icon size={16} className="mode-icon" />}
        <strong>
          {entry.role === 'user' ? seekerLabel + ': ' : `${selectedFigureName}: `}
        </strong>
        {entry.timestamp && (
          <span className="message-timestamp">
            {new Date(entry.timestamp).toLocaleString()}
          </span>
        )}
      </div>
      <div className="message-content">
        <span
          className="history-message"
          dangerouslySetInnerHTML={{ __html: sanitizeContent(entry.content, 'HISTORY_ENTRY') }}
        />
      </div>
    </div>
  );
};

export default HistoryMessage;
