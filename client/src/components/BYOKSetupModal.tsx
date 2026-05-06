import { FC, useState } from 'react';
import { ModalContainer } from './Modal';
import { useTranslation } from '../hooks/useTranslation';
import { useDomainStore } from '../stores/domainStore';
import { keyStorage } from '../services/storage/keyStorageService';
import { llmService } from '../services/llm/llmService';
import { loadServiceConfig, saveServiceConfig, LLM_SERVICES } from '../services/audio/config/serviceConfig';
import { RippleButton } from './Button';
import { Key, ShieldCheck, CheckCircle, Eye, EyeSlash, ArrowRight, Warning } from '@phosphor-icons/react';

type WizardStep = 0 | 1 | 2;
type ValidationStatus = 'idle' | 'testing' | 'valid' | 'invalid';

const BYOKSetupModal: FC = () => {
  const { tString } = useTranslation();
  const { isOpen, triggerEndpoint } = useDomainStore((s) => s.byokModal);
  const closeByokModal = useDomainStore((s) => s.closeByokModal);

  const [step, setStep] = useState<WizardStep>(0);
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<ValidationStatus>('idle');
  // ZDR defaults ON — privacy-first, matches the brand's "Ohne Tracking" promise.
  // Free tier is already zero-retention via Nebius DPA; BYOK should match that posture.
  // Users who prefer EU routing / lower latency can opt out in the toggle.
  const [zdrEnabled, setZdrEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset state for next open
    setStep(0);
    setKeyValue('');
    setShowKey(false);
    setStatus('idle');
    setZdrEnabled(false);
    setErrorMessage('');
    closeByokModal();
  };

  const handleValidateAndSave = async () => {
    if (!keyValue.trim()) {
      setErrorMessage(tString('byok.wizard.errorEmpty', 'Please enter an API key.'));
      setStatus('invalid');
      return;
    }

    setStatus('testing');
    setErrorMessage('');

    try {
      const isValid = await llmService.validateKey(keyValue.trim());

      if (isValid) {
        // Save key
        await keyStorage.saveKey('openrouter', keyValue.trim(), {
          provider: 'openrouter',
          lastValidated: new Date().toISOString(),
        });

        // Update service config
        const config = loadServiceConfig();
        config.llm = {
          provider: LLM_SERVICES.OPENROUTER.name,
          model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
          zdr: zdrEnabled,
        };
        saveServiceConfig(config);

        // Update free-tier status
        useDomainStore.getState().setIsFreeTier(false);

        setStatus('valid');
        setStep(2);
      } else {
        setStatus('invalid');
        setErrorMessage(tString('byok.wizard.errorInvalid', 'Invalid key. Please check and try again.'));
      }
    } catch (error: any) {
      setStatus('invalid');
      setErrorMessage(error.message || tString('byok.wizard.errorFailed', 'Validation failed. Please try again.'));
    }
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={handleClose}
      modalType="compact"
      animationType="fade-scale"
      ariaLabel={tString('byok.wizard.ariaLabel', 'Set up your API key')}
    >
      <div style={{
        padding: 'clamp(20px, 3vw, 32px)',
        color: 'var(--text-primary)',
      }}>

        {/* Step 0: Value proposition */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--gold-base) 15%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Key size={28} weight="duotone" style={{ color: 'var(--gold-base)' }} />
            </div>

            <h2 style={{
              fontSize: 'clamp(1.1rem, 1rem + 0.5vw, 1.4rem)',
              color: 'var(--gold-base)',
              marginBottom: '12px',
              fontFamily: 'var(--heading-font-family)',
            }}>
              {tString('byok.wizard.valueTitle', 'Add your OpenRouter key')}
            </h2>

            <p style={{
              fontSize: 'var(--ui-font-size-body)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: '20px',
            }}>
              {tString('byok.wizard.valueBody', 'Use your own OpenRouter key. You pay OpenRouter directly, we take no cut.')}
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '20px',
              textAlign: 'left',
              padding: '14px',
              background: 'color-mix(in srgb, var(--gold-base) 6%, transparent)',
              borderRadius: '10px',
            }}>
              {[
                tString('byok.wizard.benefit1', 'No daily limits on messages, councils, or summaries'),
                tString('byok.wizard.benefit2', 'Same AI as the free tier'),
                tString('byok.wizard.benefit3', 'Zero data retention by default'),
                tString('byok.wizard.benefit4', 'Over 25 hours of conversation for $1'),
              ].map((benefit, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: 'var(--ui-font-size-body)',
                  color: 'var(--text-primary)',
                }}>
                  <CheckCircle size={18} weight="fill" style={{ color: 'var(--success-green)', flexShrink: 0 }} />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <RippleButton variant="gold" onClick={() => setStep(1)}>
                {tString('byok.wizard.getStarted', 'Get Started')}
                <ArrowRight size={16} weight="bold" style={{ marginLeft: 6 }} />
              </RippleButton>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 24px',
                  fontSize: 'var(--ui-font-size-small)',
                  color: 'var(--text-dim)',
                  background: 'transparent',
                  border: '1px solid color-mix(in srgb, var(--text-dim) 30%, transparent)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                {tString('byok.wizard.maybeLater', 'Maybe later')}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Guide + Key Input */}
        {step === 1 && (
          <div>
            <h2 style={{
              fontSize: 'clamp(1.05rem, 1rem + 0.4vw, 1.3rem)',
              color: 'var(--gold-base)',
              marginBottom: '16px',
              fontFamily: 'var(--heading-font-family)',
            }}>
              {tString('byok.wizard.guideTitle', 'Set Up Your Key')}
            </h2>

            {/* Why OpenRouter — small, dim context line before the action steps */}
            <p style={{
              fontSize: 'var(--ui-font-size-small)',
              lineHeight: 1.5,
              color: 'var(--text-dim)',
              marginBottom: '18px',
              fontStyle: 'italic',
            }}>
              {tString('byok.wizard.whyOpenRouter', 'Why OpenRouter? Easy sign-up, one key for many models, automatic failover if a provider goes down.')}
            </p>

            {/* Steps */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px',
            }}>
              {[
                tString('byok.wizard.step1', 'Create a free account at OpenRouter'),
                tString('byok.wizard.step2', 'Add credit ($5 lasts for months of daily use)'),
                tString('byok.wizard.step3', 'Create an API key and paste it below'),
              ].map((text, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  fontSize: 'var(--ui-font-size-body)',
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--gold-base) 15%, transparent)',
                    color: 'var(--gold-base)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ paddingTop: 2 }}>{text}</span>
                </div>
              ))}
            </div>

            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--gold-base)',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '16px',
              }}
            >
              {tString('byok.wizard.openRouterLink', 'Open OpenRouter Keys Page')}
              <span style={{ fontSize: '11px' }}>↗</span>
            </a>

            {/* Key input */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                  setErrorMessage('');
                }}
                placeholder={tString('byok.wizard.keyPlaceholder', 'sk-or-v1-...')}
                style={{
                  width: '100%',
                  padding: '11px 42px 11px 12px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  background: 'color-mix(in srgb, var(--bg-secondary) 50%, transparent)',
                  border: `1px solid ${status === 'invalid' ? 'var(--coral-base)' : status === 'valid' ? 'var(--success-green)' : 'color-mix(in srgb, var(--gold-base) 20%, transparent)'}`,
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Validation status */}
            {status === 'testing' && (
              <p style={{ fontSize: '13px', color: 'var(--gold-base)', marginBottom: '10px' }}>
                {tString('byok.wizard.validating', 'Validating your key...')}
              </p>
            )}

            {errorMessage && (
              <div style={{
                marginBottom: '10px',
                padding: '8px 10px',
                background: 'color-mix(in srgb, var(--coral-base) 10%, transparent)',
                borderLeft: '3px solid var(--coral-base)',
                borderRadius: '4px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Warning size={14} weight="fill" style={{ flexShrink: 0, color: 'var(--coral-base)' }} />
                <span style={{ color: 'var(--coral-base)', lineHeight: 1.4 }}>{errorMessage}</span>
              </div>
            )}

            {/* ZDR toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
              borderRadius: '8px',
              marginBottom: '16px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              <input
                type="checkbox"
                checked={zdrEnabled}
                onChange={(e) => setZdrEnabled(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 1,
                  accentColor: 'var(--gold-base)',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} weight="fill" style={{ color: 'var(--success-green)' }} />
                  {tString('byok.wizard.zdrLabel', 'Zero Data Retention')}
                </div>
                <div style={{ lineHeight: 1.4 }}>
                  {tString('byok.wizard.zdrNote', "On by default. Routes only to providers that don't store your data (typically US-based). Turning off allows any provider, some may log.")}
                </div>
              </div>
            </label>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <RippleButton
                variant="gold"
                onClick={handleValidateAndSave}
                disabled={!keyValue.trim() || status === 'testing'}
              >
                {status === 'testing'
                  ? tString('byok.wizard.validating', 'Validating your key...')
                  : tString('byok.wizard.validateButton', 'Save & Continue')}
              </RippleButton>
              <button
                onClick={() => setStep(0)}
                style={{
                  padding: '10px',
                  fontSize: 'var(--ui-font-size-small)',
                  color: 'var(--text-dim)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                {tString('byok.wizard.back', 'Back')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Success */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--success-green) 15%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle size={36} weight="fill" style={{ color: 'var(--success-green)' }} />
            </div>

            <h2 style={{
              fontSize: 'clamp(1.1rem, 1rem + 0.5vw, 1.4rem)',
              color: 'var(--success-green)',
              marginBottom: '12px',
              fontFamily: 'var(--heading-font-family)',
            }}>
              {tString('byok.wizard.successTitle', "You're All Set!")}
            </h2>

            <p style={{
              fontSize: 'var(--ui-font-size-body)',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              marginBottom: '24px',
            }}>
              {tString('byok.wizard.successBody', 'No more daily limits. Your conversations, councils, and summaries are now unlimited.')}
            </p>

            {zdrEnabled && (
              <p style={{
                fontSize: 'var(--ui-font-size-small)',
                color: 'var(--text-dim)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}>
                <ShieldCheck size={16} weight="fill" style={{ color: 'var(--success-green)' }} />
                {tString('byok.wizard.successZdr', 'Zero Data Retention is enabled.')}
              </p>
            )}

            <RippleButton variant="gold" onClick={handleClose}>
              {tString('byok.wizard.startButton', 'Start Chatting')}
            </RippleButton>
          </div>
        )}
      </div>
    </ModalContainer>
  );
};

export default BYOKSetupModal;
