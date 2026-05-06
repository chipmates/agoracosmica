/**
 * EchoExplainerHelp — HelperPopup explaining what Echoes are.
 * Shown once on first WisdomGallery visit. Combines the ECHO-CONCEPT
 * philosophy (modern knowledge, historical lens) with transparent AI disclosure.
 */
import React, { FC, CSSProperties, ReactNode } from 'react';
import HelperPopup from './HelperPopup/HelperPopup';
import useTranslation from '../hooks/useTranslation';
import { useUIStore } from '../stores/uiStore';
import { Sparkle, Eye, ChatCircleDots, WarningCircle } from '@phosphor-icons/react';

interface EchoExplainerHelpProps {
  onDismiss: () => void;
}

const HELP_ID = 'hideEchoExplainer';

const sectionHeader: CSSProperties = {
  color: 'var(--gold-subtle)',
  marginBottom: '0.5rem',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontWeight: 600,
};

const sectionBox: CSSProperties = {
  marginBottom: '1rem',
  background: 'linear-gradient(135deg, rgba(212, 165, 57, 0.08), rgba(212, 165, 57, 0.03))',
  borderRadius: '8px',
  padding: '0.75rem',
  border: '1px solid rgba(212, 165, 57, 0.15)',
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '26px',
  opacity: 0.9,
  fontSize: '0.9rem',
  listStyle: 'none',
};

const listItem: CSSProperties = {
  marginBottom: '0.35rem',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  lineHeight: 1.5,
};

const bulletIcon: CSSProperties = {
  color: 'var(--gold-subtle)',
  opacity: 0.7,
  flexShrink: 0,
  marginTop: '2px',
};

const EchoExplainerHelp: FC<EchoExplainerHelpProps> = ({ onDismiss }) => {
  const { tString, tArray } = useTranslation();
  const dismissHelp = useUIStore((state) => state.dismissHelp);

  const handleDontAskAgain = (): void => {
    dismissHelp(HELP_ID);
  };

  const content: ReactNode = (
    <div style={{ fontSize: '0.95rem' }}>
      {/* The concept — what makes echoes special */}
      <div style={sectionBox}>
        <h4 style={sectionHeader}>
          <Sparkle size={18} style={{ color: 'var(--gold-subtle)' }} />
          {tString('helpers.echoExplainer.concept.title', 'Living Perspectives')}
        </h4>
        <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.6 }}>
          {tString(
            'helpers.echoExplainer.concept.text',
            'An echo carries a figure\'s perspective, values, and way of thinking into the present. Echoes know about the modern world, but they see everything through their own lens, their own era, their own philosophy.'
          )}
        </p>
      </div>

      {/* How they work — transparent about AI */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={sectionHeader}>
          <ChatCircleDots size={18} style={{ color: 'var(--gold-subtle)' }} />
          {tString('helpers.echoExplainer.howTheyWork.title', 'How Echoes Work')}
        </h4>
        <ul style={listStyle}>
          {tArray('helpers.echoExplainer.howTheyWork.points').map((point: string, i: number) => (
            <li key={i} style={listItem}>
              <Sparkle size={12} style={bulletIcon} />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Good to know — honest disclaimers */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={sectionHeader}>
          <Eye size={18} style={{ color: 'var(--gold-subtle)' }} />
          {tString('helpers.echoExplainer.goodToKnow.title', 'Good to Know')}
        </h4>
        <ul style={listStyle}>
          {tArray('helpers.echoExplainer.goodToKnow.points').map((point: string, i: number) => (
            <li key={i} style={listItem}>
              <WarningCircle size={12} style={{ ...bulletIcon, color: 'color-mix(in srgb, var(--color-error) 80%, transparent)' }} />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Closing quote */}
      <blockquote style={{
        background: 'linear-gradient(135deg, rgba(212, 165, 57, 0.05), rgba(212, 165, 57, 0.05))',
        borderLeft: '3px solid var(--gold-subtle)',
        padding: '0.75rem 1rem',
        margin: '0',
        fontStyle: 'italic',
        opacity: 0.85,
        lineHeight: 1.6,
        fontSize: '0.9rem',
        borderRadius: '0 6px 6px 0',
      }}>
        {tString(
          'helpers.echoExplainer.quote',
          'When you meet Plato here, you are engaging with an AI interpretation inspired by his philosophy. A digital echo of his wisdom, not the person himself.'
        )}
      </blockquote>
    </div>
  );

  return (
    <HelperPopup
      isOpen={true}
      onDismiss={onDismiss}
      title={tString('helpers.echoExplainer.title', 'What is an Echo?')}
      content={content}
      buttonText={tString('helpers.common.beginExploring', 'Begin Exploring')}
      showDontAskAgain={true}
      onDontAskAgain={handleDontAskAgain}
    />
  );
};

export { HELP_ID as ECHO_EXPLAINER_HELP_ID };
export default EchoExplainerHelp;
