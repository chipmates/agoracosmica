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
import { useDomainStore } from '../../../stores/domainStore';
import { describeFreeTier } from '../../../utils/freeTierState';
import { RippleButton } from '../../Button';

interface AiModelPanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
}

// Plate language: night ground, one gold-deep hairline, gilded active state,
// callouts on a navy plate with a gold-deep left rule.
// --text-secondary is self-referential inside `.setting-card` (voiding the token,
// so text falls back to inherited gold) and --text-tertiary is remapped to the
// dimmer --text-dim there. Both inks are derived from --text-primary, which is
// stable in this scope, and clear AA on every ground used below.
const INK_BODY = 'color-mix(in srgb, var(--text-primary) 88%, var(--bg-void))';
const INK_QUIET = 'color-mix(in srgb, var(--text-primary) 68%, var(--bg-void))';
const PLATE_GROUND = 'color-mix(in srgb, var(--bg-card) 82%, var(--bg-void))';
const PLATE_GROUND_ACTIVE = 'color-mix(in srgb, var(--bg-card) 88%, var(--gold-deep))';
const PLATE_HAIRLINE = '1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent)';
const CALLOUT_GROUND = 'color-mix(in srgb, var(--bg-card) 70%, var(--bg-void))';
const CALLOUT_RULE = '3px solid color-mix(in srgb, var(--gold-deep) 75%, transparent)';
const FIELD_GROUND = 'color-mix(in srgb, var(--bg-void) 80%, var(--bg-card))';
const FIELD_KEYLINE = 'color-mix(in srgb, var(--gold-deep) 45%, transparent)';
// Raw --coral-base lands at 4.2:1 on these grounds; warmed toward parchment it
// clears AA for the small failure text it carries.
const ALARM_INK = 'color-mix(in srgb, var(--coral-base) 65%, var(--text-primary))';

const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'color-mix(in srgb, var(--gold-deep) 70%, var(--gold-primary))',
};

type ValidationStatus = 'idle' | 'testing' | 'valid' | 'invalid' | 'not_configured';

interface KeyState {
  value: string;
  showKey: boolean;
  validationStatus: ValidationStatus;
  errorMessage: string;
  lastTested: Date | null;
  isDirty: boolean;
}

// The BYOK route is pinned to one OpenRouter model, so its name is a client
// constant. The free tier's name is not: the worker reports which model serves.
const BYOK_MODEL = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;

const AiModelPanel: FC<AiModelPanelProps> = ({ SettingCard, CATEGORY_ICONS }) => {
  const { t, tString, tNode } = useTranslation();
  const freeTier = useDomainStore((state) => state.quota.freeTier);

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

  // The free tier's model, its region, and the day's budget, as the worker
  // reported them. Absent until /v1/quota answers, and never read for a BYOK
  // user: their key decides the model, not our routing.
  const serving = !isByokActive && freeTier ? describeFreeTier(freeTier) : null;
  const modelName = (label: string) => tString(`settings.aiModelKey.models.${label}`, label);
  const regionName = (region: string) => tString(`settings.aiModelKey.regions.${region}`, region);
  const filled = (key: string, values: Record<string, string>): string => {
    const text = t(key, values);
    return typeof text === 'string' ? text : key;
  };

  const currentModel = isByokActive
    ? LLM_SERVICES.OPENROUTER.displayNames[BYOK_MODEL]
    : serving && modelName(serving.now.label);

  // Where the answering model runs, and what takes over. Quiet: they describe
  // the setup, not what changed today.
  const servingLines = serving
    ? [
      filled('settings.aiModelKey.servedIn', { region: regionName(serving.now.region) }),
      ...(serving.after
        ? [filled('settings.aiModelKey.afterBudget', {
          model: modelName(serving.after.label),
          region: regionName(serving.after.region),
        })]
        : []),
    ]
    : [];

  // Today's budget. Brighter than the lines above it: this one can change while
  // the panel is open, and it is the reason the model above may have changed.
  const budgetLine = serving?.budget === 'within'
    ? tString('settings.aiModelKey.budgetWithin', 'Today: within the budget')
    : serving?.budget === 'reached'
      ? filled('settings.aiModelKey.budgetReached', { model: modelName(serving.now.label) })
      : '';

  // The tagline claims one model across both routes, which only holds while the
  // free tier and BYOK run the same one.
  const showTagline = isByokActive || serving === null || serving.budget === null;

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
        color: INK_QUIET,
        text: tString('settings.apiKeys.statusNotConfigured', 'Not configured'),
      },
      idle: {
        icon: <WarningCircle size={16} weight="fill" />,
        color: 'var(--gold-subtle)',
        text: tString('settings.apiKeys.statusNotTested', 'Not tested'),
      },
      testing: {
        icon: <WarningCircle size={16} weight="fill" />,
        color: 'var(--gold-subtle)',
        text: tString('settings.apiKeys.statusTesting', 'Testing...'),
      },
      valid: {
        icon: <CheckCircle size={16} weight="fill" />,
        color: 'var(--gold-primary)',
        text: openRouterKey.lastTested
          ? `${tString('settings.apiKeys.statusValid', 'Valid')} (${openRouterKey.lastTested.toLocaleTimeString()})`
          : tString('settings.apiKeys.statusValid', 'Valid'),
      },
      invalid: {
        icon: <XCircle size={16} weight="fill" />,
        color: ALARM_INK,
        text: tString('settings.apiKeys.statusInvalid', 'Invalid'),
      },
    };
    const cfg = map[openRouterKey.validationStatus];
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '10px',
        padding: '8px 12px',
        background: CALLOUT_GROUND,
        borderRadius: '4px',
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
        background: PLATE_GROUND,
        borderRadius: '6px',
        border: PLATE_HAIRLINE,
        marginBottom: '14px',
      }}>
        <p style={{
          fontSize: '13px',
          color: INK_BODY,
          margin: '0 0 12px',
          lineHeight: 1.5,
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
              background: FIELD_GROUND,
              border: `1px solid ${FIELD_KEYLINE}`,
              borderRadius: '4px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--gold-primary)'; }}
            onBlur={(e) => { e.target.style.borderColor = FIELD_KEYLINE; }}
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
              color: 'var(--gold-deep)',
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
            padding: '8px 12px',
            background: CALLOUT_GROUND,
            borderLeft: `3px solid ${ALARM_INK}`,
            borderRadius: '4px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            color: ALARM_INK,
            lineHeight: 1.5,
          }}>
            <Warning size={14} weight="fill" style={{ flexShrink: 0, marginTop: '3px' }} />
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
          borderTop: '1px solid color-mix(in srgb, var(--gold-deep) 28%, transparent)',
        }}>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--gold-primary)',
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
        background: PLATE_GROUND,
        borderRadius: '6px',
        border: PLATE_HAIRLINE,
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
              accentColor: 'var(--gold-primary)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-content)',
              fontWeight: 400,
              fontSize: '16px',
              color: 'var(--gold-primary)',
              marginBottom: '6px',
            }}>
              <ShieldCheck size={16} weight="fill" style={{ flexShrink: 0, color: 'var(--gold-deep)' }} />
              {tString('settings.apiKeys.zdrLabel', 'Zero Data Retention')}
            </div>
            <p style={{
              fontSize: '13px',
              margin: 0,
              lineHeight: 1.5,
              color: INK_BODY,
            }}>
              {tNode('settings.apiKeys.zdrDescription')}
            </p>
          </div>
        </label>
      </div>

      {/* 3. About OpenRouter — context for the chosen vendor */}
      <div style={{
        padding: '12px 14px',
        background: CALLOUT_GROUND,
        borderRadius: '4px',
        borderLeft: CALLOUT_RULE,
        marginBottom: '14px',
      }}>
        <div style={{
          ...kickerStyle,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}>
          <Info size={14} weight="fill" style={{ flexShrink: 0, color: 'var(--gold-deep)' }} />
          {tNode('settings.aiModelKey.aboutOpenRouter.title')}
        </div>
        <p style={{
          fontSize: '13px',
          color: INK_BODY,
          margin: '0 0 8px',
          lineHeight: 1.5,
        }}>
          {tNode('settings.aiModelKey.aboutOpenRouter.body1')}
        </p>
        <p style={{
          fontSize: '13px',
          color: INK_BODY,
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
            color: 'var(--gold-primary)',
            textDecoration: 'none',
            fontSize: '13px',
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
        background: isByokActive ? PLATE_GROUND_ACTIVE : PLATE_GROUND,
        border: isByokActive ? '1px solid var(--gold-primary)' : PLATE_HAIRLINE,
        borderRadius: '6px',
        marginBottom: '14px',
      }}>
        <div style={{ ...kickerStyle, marginBottom: '10px' }}>
          {tNode('settings.aiModelKey.currentlyUsing')}
        </div>
        {currentModel && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px',
          }}>
            <Sparkle size={18} weight="fill" style={{ flexShrink: 0, color: 'var(--gold-deep)' }} />
            <span style={{
              fontFamily: 'var(--font-content)',
              fontSize: '19px',
              fontWeight: 400,
              color: 'var(--gold-primary)',
              letterSpacing: '0.01em',
            }}>
              {currentModel}
            </span>
          </div>
        )}
        {showTagline && (
          <div style={{
            fontSize: '13px',
            color: INK_BODY,
            lineHeight: 1.5,
            marginBottom: '10px',
          }}>
            {tNode('settings.aiModelKey.modelTagline')}
          </div>
        )}
        {servingLines.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            fontSize: '13px',
            color: INK_QUIET,
            lineHeight: 1.5,
            marginBottom: budgetLine ? '6px' : '10px',
          }}>
            {servingLines.map((text) => <span key={text}>{text}</span>)}
          </div>
        )}
        {budgetLine && (
          <div style={{
            fontSize: '13px',
            color: INK_BODY,
            fontWeight: 500,
            lineHeight: 1.5,
            marginBottom: '10px',
          }}>
            {budgetLine}
          </div>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: isByokActive ? 'var(--gold-primary)' : INK_BODY,
          fontWeight: 500,
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isByokActive ? 'var(--gold-primary)' : 'var(--gold-deep)',
            display: 'inline-block',
            flexShrink: 0,
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
        background: CALLOUT_GROUND,
        borderRadius: '4px',
        borderLeft: CALLOUT_RULE,
        fontSize: '13px',
        color: INK_BODY,
        lineHeight: 1.5,
      }}>
        <LockKey size={16} weight="regular" style={{ flexShrink: 0, color: 'var(--gold-deep)', marginTop: '2px' }} />
        <span>
          {tNode('settings.aiModelKey.encryptionNote')}{' '}
          <span style={{ color: 'var(--gold-primary)' }}>
            ({tNode('settings.aiModelKey.learnMoreLink')})
          </span>
        </span>
      </div>
    </SettingCard>
  );
};

export default AiModelPanel;
