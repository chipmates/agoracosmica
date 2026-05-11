import { FC } from 'react';
import { ModalContainer } from './Modal';
import { useTranslation } from '../hooks/useTranslation';
import { useDomainStore } from '../stores/domainStore';

/**
 * Format the time until `resetsAt` as a localized relative string ("in 3 hours" /
 * "in 5 minutes" / "in 3 Stunden"). Uses Intl.RelativeTimeFormat for native
 * pluralization in any locale — no hand-rolled plural rules.
 */
function formatAvailableAgain(resetsAt: string | null, language: string): string {
  if (!resetsAt) return '';
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  try {
    const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'always' });
    return minutes < 60
      ? rtf.format(minutes, 'minute')
      : rtf.format(Math.ceil(minutes / 60), 'hour');
  } catch {
    // Locale not supported by the runtime → fall back to a neutral form
    return minutes < 60 ? `in ${minutes} min` : `in ${Math.ceil(minutes / 60)}h`;
  }
}

const RateLimitModal: FC = () => {
  const { tString, language } = useTranslation();
  const { isOpen, endpoint, resetsAt } = useDomainStore((s) => s.rateLimitModal);
  const closeRateLimitModal = useDomainStore((s) => s.closeRateLimitModal);
  const openByokModal = useDomainStore((s) => s.openByokModal);

  if (!isOpen || !endpoint) return null;

  const titleKey = `quota.modal.${endpoint}Title`;
  const bodyKey = `quota.modal.${endpoint}Body`;

  const titleFallbacks: Record<string, string> = {
    chat: 'Message limit reached',
    council: 'Council limit reached',
    summary: 'Summary limit reached',
  };
  const bodyFallbacks: Record<string, string> = {
    chat: "You've used today's free messages.",
    council: "You've used today's free council.",
    summary: "You've used today's free summaries.",
  };

  const availableAgainText = formatAvailableAgain(resetsAt, language);

  const handleSetUpKey = () => {
    closeRateLimitModal();
    openByokModal(endpoint ?? undefined);
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={closeRateLimitModal}
      modalType="compact"
      animationType="fade-scale"
      overlayClassName="modal-priority"
      ariaLabel={tString(titleKey, titleFallbacks[endpoint])}
    >
      <div style={{
        padding: 'clamp(20px, 3vw, 32px)',
        textAlign: 'center',
        color: 'var(--text-primary)',
      }}>
        <h2 style={{
          fontSize: 'clamp(1.1rem, 1rem + 0.5vw, 1.4rem)',
          color: 'var(--gold-base)',
          marginBottom: '16px',
          fontFamily: 'var(--heading-font-family)',
        }}>
          {tString(titleKey, titleFallbacks[endpoint])}
        </h2>

        <p style={{
          fontSize: 'var(--ui-font-size-body)',
          lineHeight: 1.5,
          marginBottom: '8px',
          color: 'var(--text-secondary)',
        }}>
          {tString(bodyKey, bodyFallbacks[endpoint])}
        </p>

        {availableAgainText && (
          <p style={{
            fontSize: 'var(--ui-font-size-small)',
            color: 'var(--text-dim)',
            marginBottom: '20px',
          }}>
            {tString('quota.modal.availableAgain', 'Available again {{when}}.').replace('{{when}}', availableAgainText)}
          </p>
        )}

        <p style={{
          fontSize: 'var(--ui-font-size-small)',
          color: 'var(--text-tertiary)',
          marginBottom: '24px',
          fontStyle: 'italic',
        }}>
          {tString('quota.modal.unlimitedNote', 'With your own OpenRouter key, there are no daily limits.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleSetUpKey}
            style={{
              padding: '12px 24px',
              fontSize: 'var(--ui-font-size-body)',
              fontWeight: 600,
              color: 'var(--bg-primary)',
              background: 'var(--gold-base)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              minHeight: '44px',
              transition: 'opacity 0.2s',
            }}
          >
            {tString('quota.modal.setupKey', 'Add OpenRouter Key')}
          </button>
          <button
            onClick={closeRateLimitModal}
            style={{
              padding: '10px 24px',
              fontSize: 'var(--ui-font-size-small)',
              color: 'var(--text-dim)',
              background: 'transparent',
              border: '1px solid color-mix(in srgb, var(--text-dim) 30%, transparent)',
              borderRadius: '10px',
              cursor: 'pointer',
              minHeight: '44px',
              transition: 'opacity 0.2s',
            }}
          >
            {tString('quota.modal.dismiss', 'Maybe later')}
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};

export default RateLimitModal;
