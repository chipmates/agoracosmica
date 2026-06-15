import React, { FC, ReactNode, useState, useEffect } from 'react';
import {
  Eye, EyeSlash, CheckCircle, XCircle, WarningCircle,
  Warning, ShieldCheck, LockKey, Sparkle, Info,
} from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import { keyStorage } from '../../../services/storage/keyStorageService';
import { llmService } from '../../../services/llm/llmService';
import {
  loadServiceConfig, saveServiceConfig, LLM_SERVICES,
} from '../../../services/audio/config/serviceConfig';
import { RippleButton } from '../../Button';

interface AiModelPanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
}

type ValidationStatus = 'idle' | 'testing' | 'valid' | 'invalid' | 'not_configured';

interface KeyState {
  value: string;
  showKey: boolean;
  validationStatus: ValidationStatus;
  errorMessage: string;
  lastTested: Date | null;
  isDirty: boolean;
}

const AiModelPanel: FC<AiModelPanelProps> = ({ SettingCard, CATEGORY_ICONS }) => {
  const { tString, tNode } = useTranslation();

  const [openRouterKey, setOpenRouterKey] = useState<KeyState>({
    value: '',
    showKey: false,
    validationStatus: 'not_configured',
    errorMessage: '',
    lastTested: null,
    isDirty: false,
  });

  // ZDR is stored on config.llm.zdr; defaults to true so the protection is on
  // even before the user adds a key (matches the BYOK setup wizard default).
  const [zdrEnabled, setZdrEnabled] = useState<boolean>(
    () => loadServiceConfig().llm.zdr ?? true,
  );

  useEffect(() => {
    const loadKeys = async () => {
      try {
        let orKey = await keyStorage.getKey('openrouter');

        if (!orKey && import.meta.env.DEV) {
          const devKey = localStorage.getItem('dev_openrouter_key');
          if (devKey) {
            await keyStorage.saveKey('openrouter', devKey, {
              lastValidated: new Date().toISOString(),
            });
            orKey = devKey;
          }
        }

        if (orKey) {
          const meta = await keyStorage.getKeyMetadata('openrouter');
          // A key only reaches storage after a passing test, so show it valid
          // unless it was later marked invalid (then prompt a re-test).
          const usable = meta !== null && meta.valid !== false;
          setOpenRouterKey(prev => ({
            ...prev,
            value: orKey,
            validationStatus: usable ? 'valid' : 'idle',
            lastTested: meta?.lastValidated ? new Date(String(meta.lastValidated)) : null,
          }));
        }
      } catch (error) {
        console.error('Failed to load OpenRouter key:', error);
      }
    };
    loadKeys();
  }, []);

  const isByokActive = openRouterKey.validationStatus === 'valid';

  const handleKeyChange = (value: string) => {
    setOpenRouterKey(prev => ({
      ...prev,
      value,
      isDirty: true,
      validationStatus:
        prev.validationStatus === 'valid' || prev.validationStatus === 'invalid'
          ? 'idle'
          : prev.validationStatus,
    }));
  };

  const handleTestKey = async () => {
    if (!openRouterKey.value.trim()) {
      setOpenRouterKey(prev => ({
        ...prev,
        validationStatus: 'invalid',
        errorMessage: tString('settings.apiKeys.errorEmpty', 'Cannot save empty key'),
      }));
      return;
    }
    setOpenRouterKey(prev => ({ ...prev, validationStatus: 'testing', errorMessage: '' }));
    try {
      const isValid = await llmService.validateKey(openRouterKey.value.trim());
      setOpenRouterKey(prev => ({
        ...prev,
        validationStatus: isValid ? 'valid' : 'invalid',
        lastTested: isValid ? new Date() : null,
        errorMessage: isValid
          ? ''
          : tString('settings.apiKeys.errorInvalid', 'Invalid API key. Please check and try again.'),
      }));
    } catch (error: any) {
      setOpenRouterKey(prev => ({
        ...prev,
        validationStatus: 'invalid',
        errorMessage:
          error.message ||
          tString('settings.apiKeys.errorValidate', 'Failed to validate key. Please try again.'),
      }));
    }
  };

  const handleSaveKey = async () => {
    if (!openRouterKey.value.trim()) return;
    // Only persist a key that passed a test. Storing an untested key as valid
    // is what made the three "has a usable key" checks disagree; now a saved
    // record always means tested-good (markInvalid flips it off on rejection).
    if (openRouterKey.validationStatus !== 'valid') return;
    try {
      await keyStorage.saveKey('openrouter', openRouterKey.value.trim(), {
        provider: 'openrouter',
        lastValidated: new Date().toISOString(),
      });
      const config = loadServiceConfig();
      config.llm = {
        provider: LLM_SERVICES.OPENROUTER.name,
        model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
        zdr: zdrEnabled,
      };
      saveServiceConfig(config);
      setOpenRouterKey(prev => ({ ...prev, isDirty: false }));
      // Notify the parent collapsible badge so it can flip Free → Your key live.
      window.dispatchEvent(new CustomEvent('byok-key-changed', { detail: { hasKey: true } }));
    } catch (error) {
      console.error('Failed to save OpenRouter key:', error);
      setOpenRouterKey(prev => ({
        ...prev,
        errorMessage: tString('settings.apiKeys.errorSave', 'Failed to save key.'),
      }));
    }
  };

  const handleClearKey = async () => {
    const confirmMsg = tString(
      'settings.apiKeys.confirmClear',
      'Are you sure you want to remove your OpenRouter API key?',
    ).replace('{provider}', 'OpenRouter');
    if (!window.confirm(confirmMsg)) return;
    try {
      await keyStorage.deleteKey('openrouter');
      setOpenRouterKey({
        value: '',
        showKey: false,
        validationStatus: 'not_configured',
        errorMessage: '',
        lastTested: null,
        isDirty: false,
      });
      window.dispatchEvent(new CustomEvent('byok-key-changed', { detail: { hasKey: false } }));
    } catch (error) {
      console.error('Failed to clear OpenRouter key:', error);
    }
  };

  const handleZdrToggle = (enabled: boolean) => {
    setZdrEnabled(enabled);
    const config = loadServiceConfig();
    config.llm.zdr = enabled;
    saveServiceConfig(config);
  };

  const StatusPill: FC = () => {
    const map: Record<ValidationStatus, { icon: ReactNode; color: string; text: string }> = {
      not_configured: {
        icon: <WarningCircle size={16} weight="fill" />,
        color: 'var(--text-tertiary)',
        text: tString('settings.apiKeys.statusNotConfigured', 'Not configured'),
      },
      idle: {
        icon: <WarningCircle size={16} weight="fill" />,
        color: 'var(--gold-base)',
        text: tString('settings.apiKeys.statusNotTested', 'Not tested'),
      },
      testing: {
        icon: <WarningCircle size={16} weight="fill" />,
        color: 'var(--gold-base)',
        text: tString('settings.apiKeys.statusTesting', 'Testing...'),
      },
      valid: {
        icon: <CheckCircle size={16} weight="fill" />,
        color: 'var(--success-green)',
        text: openRouterKey.lastTested
          ? `${tString('settings.apiKeys.statusValid', 'Valid')} (${openRouterKey.lastTested.toLocaleTimeString()})`
          : tString('settings.apiKeys.statusValid', 'Valid'),
      },
      invalid: {
        icon: <XCircle size={16} weight="fill" />,
        color: 'var(--coral-base)',
        text: tString('settings.apiKeys.statusInvalid', 'Invalid'),
      },
    };
    const cfg = map[openRouterKey.validationStatus];
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '10px',
        padding: '8px 10px',
        background: 'rgba(20, 28, 58, 0.25)',
        borderRadius: '6px',
        borderLeft: `3px solid ${cfg.color}`,
        fontSize: '13px',
        color: cfg.color,
        fontWeight: 500,
      }}>
        <span style={{ display: 'flex' }}>{cfg.icon}</span>
        <span>{cfg.text}</span>
      </div>
    );
  };

  return (
    <SettingCard
      title={tString('settings.aiModelKey.title', 'Your Key & AI Model')}
      icon={CATEGORY_ICONS.model || '🧠'}
      description={tString(
        'settings.aiModelKey.description',
        'Your optional OpenRouter key and the model that powers your conversations',
      )}
    >
      {/* 1. Key section — primary action, surfaced first */}
      <div style={{
        padding: '16px',
        background: 'rgba(20, 28, 58, 0.2)',
        borderRadius: '12px',
        border: '1px solid rgba(212, 165, 57, 0.15)',
        marginBottom: '14px',
      }}>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          margin: '0 0 12px',
          lineHeight: 1.5,
          opacity: 0.9,
        }}>
          {tNode('settings.aiModelKey.keySectionIntro')}
        </p>

        <div style={{ position: 'relative', marginBottom: '6px' }}>
          <input
            type={openRouterKey.showKey ? 'text' : 'password'}
            value={openRouterKey.value}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder={tString('settings.apiKeys.openRouterPlaceholder', 'sk-or-v1-...')}
            style={{
              width: '100%',
              padding: '11px 42px 11px 12px',
              fontSize: '16px',
              fontFamily: 'monospace',
              background: 'rgba(20, 28, 58, 0.5)',
              border: '1px solid rgba(212, 165, 57, 0.2)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--gold-base)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(212, 165, 57, 0.2)'; }}
          />
          <button
            type="button"
            onClick={() => setOpenRouterKey(prev => ({ ...prev, showKey: !prev.showKey }))}
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
            aria-label={
              openRouterKey.showKey
                ? tString('settings.apiKeys.hideKey', 'Hide key')
                : tString('settings.apiKeys.showKey', 'Show key')
            }
          >
            {openRouterKey.showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <StatusPill />

        {openRouterKey.errorMessage && (
          <div style={{
            marginTop: '10px',
            padding: '8px 10px',
            background: 'rgba(233, 116, 81, 0.1)',
            borderLeft: '3px solid var(--coral-base)',
            borderRadius: '4px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            color: 'var(--coral-base)',
            lineHeight: 1.4,
          }}>
            <Warning size={14} weight="fill" style={{ flexShrink: 0 }} />
            <span>{openRouterKey.errorMessage}</span>
          </div>
        )}

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: '12px',
        }}>
          <RippleButton
            variant="gold"
            onClick={handleTestKey}
            disabled={!openRouterKey.value.trim() || openRouterKey.validationStatus === 'testing'}
            size="small"
          >
            {openRouterKey.validationStatus === 'testing'
              ? tNode('settings.apiKeys.statusTesting')
              : tNode('settings.apiKeys.buttonTest')}
          </RippleButton>

          <RippleButton
            variant="primary"
            onClick={handleSaveKey}
            disabled={!openRouterKey.value.trim() || !openRouterKey.isDirty || openRouterKey.validationStatus !== 'valid'}
            size="small"
          >
            {tNode('settings.apiKeys.buttonSave')}
          </RippleButton>

          {openRouterKey.value && (
            <RippleButton variant="coral" onClick={handleClearKey} size="small">
              {tNode('settings.apiKeys.buttonClear')}
            </RippleButton>
          )}
        </div>

        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(212, 165, 57, 0.1)',
        }}>
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
            }}
          >
            {tNode('settings.apiKeys.openRouterGetKey')}
            <span style={{ fontSize: '11px' }}>→</span>
          </a>
        </div>
      </div>

      {/* 2. ZDR toggle — directly tied to key behavior */}
      <div style={{
        padding: '14px',
        background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
        borderRadius: '10px',
        border: '1px solid color-mix(in srgb, var(--accent-blue) 15%, transparent)',
        marginBottom: '14px',
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={zdrEnabled}
            onChange={(e) => handleZdrToggle(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              accentColor: 'var(--gold-base)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>
              <ShieldCheck size={16} weight="fill" style={{ color: 'var(--success-green)' }} />
              {tString('settings.apiKeys.zdrLabel', 'Zero Data Retention')}
            </div>
            <p style={{
              fontSize: '12px',
              opacity: 0.85,
              margin: 0,
              lineHeight: 1.45,
              color: 'var(--text-secondary)',
            }}>
              {tNode('settings.apiKeys.zdrDescription')}
            </p>
          </div>
        </label>
      </div>

      {/* 3. About OpenRouter — context for the chosen vendor */}
      <div style={{
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--accent-blue) 7%, transparent)',
        borderRadius: '8px',
        borderLeft: '3px solid color-mix(in srgb, var(--accent-blue) 50%, transparent)',
        marginBottom: '14px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          opacity: 0.85,
        }}>
          <Info size={14} weight="fill" style={{ color: 'var(--accent-blue)' }} />
          {tNode('settings.aiModelKey.aboutOpenRouter.title')}
        </div>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          margin: '0 0 8px',
          lineHeight: 1.5,
        }}>
          {tNode('settings.aiModelKey.aboutOpenRouter.body1')}
        </p>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          margin: '0 0 10px',
          lineHeight: 1.5,
        }}>
          {tNode('settings.aiModelKey.aboutOpenRouter.body2')}
        </p>
        <a
          href="https://openrouter.ai/docs/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--accent-blue)',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {tNode('settings.aiModelKey.aboutOpenRouter.learnMore')}
          <span style={{ fontSize: '11px' }}>→</span>
        </a>
      </div>

      {/* 4. Currently using model card — confirms what's running right now */}
      <div style={{
        padding: '16px 18px',
        background: isByokActive
          ? 'color-mix(in srgb, var(--gold-subtle) 10%, transparent)'
          : 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
        border: `1px solid ${isByokActive
          ? 'color-mix(in srgb, var(--gold-subtle) 28%, transparent)'
          : 'color-mix(in srgb, var(--accent-blue) 25%, transparent)'}`,
        borderRadius: '12px',
        marginBottom: '14px',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '6px',
          opacity: 0.85,
        }}>
          {tNode('settings.aiModelKey.currentlyUsing')}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}>
          <Sparkle size={18} weight="fill" style={{ color: 'var(--gold-base)' }} />
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '17px',
            fontWeight: 700,
            color: 'var(--gold-base)',
            letterSpacing: '0.3px',
          }}>
            Qwen3 235B
          </span>
        </div>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '10px',
          opacity: 0.9,
        }}>
          {tNode('settings.aiModelKey.modelTagline')}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: isByokActive ? 'var(--gold-primary)' : 'var(--accent-blue-hover, var(--accent-blue))',
          fontWeight: 500,
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isByokActive ? 'var(--gold-primary)' : 'var(--accent-blue)',
            display: 'inline-block',
          }} />
          {isByokActive
            ? tNode('settings.aiModelKey.statusByok')
            : tNode('settings.aiModelKey.statusFree')}
        </div>
      </div>

      {/* 5. Encryption note — pointer to Tab 1 for deeper privacy detail */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--gold-subtle) 6%, transparent)',
        borderRadius: '8px',
        borderLeft: '3px solid var(--gold-subtle)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        <LockKey size={16} weight="regular" style={{ flexShrink: 0, color: 'var(--gold-subtle)', marginTop: 1 }} />
        <span>
          {tNode('settings.aiModelKey.encryptionNote')}{' '}
          <span style={{ color: 'var(--gold-base)', opacity: 0.85 }}>
            ({tNode('settings.aiModelKey.learnMoreLink')})
          </span>
        </span>
      </div>
    </SettingCard>
  );
};

export default AiModelPanel;
