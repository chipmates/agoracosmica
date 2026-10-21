import { FC, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Key } from '@phosphor-icons/react';
import { ModalContainer } from './Modal';
import { useTranslation } from '../hooks/useTranslation';
import { useDomainStore } from '../stores/domainStore';
import {
  answerOwnKeyAsk,
  currentOwnKeyAsk,
  subscribeOwnKeyAsk,
} from '../services/llm/ownKeyConsent';
import { openKeySettings } from '../utils/openKeySettings';

const FALLBACKS = {
  title: 'OpenRouter did not accept your key',
  chatBody: "You can carry on with today's free messages. This conversation then goes through our servers, including everything you have already written in it.",
  councilBody: "You can use today's free council instead. Your question to the council then goes through our servers.",
  summaryBody: "You can use one of today's free summaries instead. This conversation then goes through our servers to be summarized.",
  chatYes: "Yes, use today's free messages",
  councilYes: "Yes, use today's free council",
  summaryYes: 'Yes, use a free summary',
  checkKey: 'Check my key',
} as const;

// Both answers carry the same weight: this is a question, not an offer.
const ANSWER_STYLE = {
  width: '100%',
  minHeight: '44px',
  padding: '12px 20px',
  fontSize: 'var(--ui-font-size-body)',
  fontWeight: 600,
  lineHeight: 1.3,
  // German labels can run to two lines on a narrow phone; break them evenly.
  textWrap: 'balance',
  color: 'var(--text-primary)',
  background: 'color-mix(in srgb, var(--gold-base) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--gold-deep) 55%, transparent)',
  borderRadius: '4px',
  cursor: 'pointer',
} as const;

/**
 * Asks before the free tier answers a visitor whose stored key was rejected.
 * Nothing is sent until the yes; closing the dialog is a no.
 */
const OwnKeyRejectedModal: FC = () => {
  const { tString } = useTranslation();
  const ask = useSyncExternalStore(subscribeOwnKeyAsk, currentOwnKeyAsk, currentOwnKeyAsk);

  if (!ask) return null;

  const text = (key: keyof typeof FALLBACKS) => tString(`byok.rejected.${key}`, FALLBACKS[key]);
  const body = text(`${ask.kind}Body` as const);
  const yes = text(`${ask.kind}Yes` as const);

  const handleYes = () => {
    // The turn counter and the daily limits show from here on, as for any
    // visitor on the free tier.
    useDomainStore.getState().setIsFreeTier(true);
    answerOwnKeyAsk('yes');
  };

  const handleCheckKey = () => {
    answerOwnKeyAsk('check-key');
    openKeySettings();
  };

  // On the body, above every loader: a council or a summary asks while its loader still covers the page.
  return createPortal(
    <ModalContainer
      isOpen
      onClose={() => answerOwnKeyAsk('dismissed')}
      modalType="compact"
      animationType="fade-scale"
      overlayClassName="modal-above-loaders"
      ariaLabel={text('title')}
    >
      <div
        data-testid="own-key-rejected"
        style={{
          padding: 'clamp(20px, 3vw, 32px)',
          textAlign: 'center',
          color: 'var(--text-primary)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--gold-base) 15%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Key size={24} weight="duotone" style={{ color: 'var(--gold-base)' }} />
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.1rem, 1rem + 0.5vw, 1.35rem)',
            lineHeight: 1.3,
            color: 'var(--gold-base)',
            margin: '0 0 12px',
            fontFamily: 'var(--heading-font-family)',
          }}
        >
          {text('title')}
        </h2>

        <p
          style={{
            fontSize: 'var(--ui-font-size-body)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            margin: '0 0 22px',
          }}
        >
          {body}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" onClick={handleYes} style={ANSWER_STYLE}>
            {yes}
          </button>
          <button type="button" onClick={handleCheckKey} style={ANSWER_STYLE}>
            {text('checkKey')}
          </button>
        </div>
      </div>
    </ModalContainer>,
    document.body,
  );
};

export default OwnKeyRejectedModal;
