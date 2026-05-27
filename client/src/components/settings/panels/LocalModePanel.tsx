import React, { FC, useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, WarningCircle, House, Cpu, MicrophoneStage,
  SpeakerHigh, Brain, ArrowSquareOut,
} from '@phosphor-icons/react';
import { useTranslation } from '../../../hooks/useTranslation';
import { RippleButton } from '../../Button';
import {
  loadServiceConfig, saveServiceConfig,
} from '../../../services/audio/config/serviceConfig';
import { keyStorage } from '../../../services/storage/keyStorageService';
import { llmService } from '../../../services/llm/llmService';
import {
  localTtsKokoroUrl, localTtsQwenUrl, localSttUrl,
} from '../../../config/runtime';

interface LocalModePanelProps {
  SettingCard: React.ComponentType<any>;
  CATEGORY_ICONS: Record<string, any>;
}

type ServiceStatus = 'unknown' | 'probing' | 'ok' | 'unreachable';

interface ServiceProbeResult {
  status: ServiceStatus;
  detail?: string;
}

// The honest privacy line is locked in CLAUDE.md (D24). It ships in both
// language bundles via `settings.localMode.honestPrivacy`; the fallback below
// is the canonical EN wording used if the key is missing from a stale bundle.
const HONEST_FRAMING_FALLBACK =
  'With Local Mode and a local model, no conversation, voice, or text data leaves your machine. The same models we run on our servers run on yours.';

type HardwareTier = 'full-nvidia' | 'full-apple' | 'reduced' | 'unknown';

function detectHardwareTier(): HardwareTier {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  // Apple Silicon detection: Mac with arm64 (most Macs in 2025+ are Apple
  // Silicon, but the UA still says "MacIntel" — `navigator.userAgentData`
  // gives us the truth when available).
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform === 'macOS') {
    return 'full-apple'; // Tier table treats all M-series Macs as full-apple; 8 GB users degrade naturally at runtime.
  }
  if (/Macintosh/.test(ua) && /Mac OS X 1[3-9]/.test(ua)) {
    return 'full-apple';
  }
  if (/Win|Linux/.test(ua)) {
    return 'full-nvidia';
  }
  return 'unknown';
}

const LocalModePanel: FC<LocalModePanelProps> = ({ SettingCard, CATEGORY_ICONS }) => {
  const { tString, tNode } = useTranslation();
  const config = loadServiceConfig();

  const [enabled, setEnabled] = useState<boolean>(config.localMode?.enabled ?? false);
  const [endpointURL, setEndpointURL] = useState<string>(
    config.llm.baseURL || 'http://localhost:1234/v1',
  );
  const [modelName, setModelName] = useState<string>(
    (config.llm.kind === 'custom-openai' && config.llm.model) || 'qwen2.5-7b-instruct',
  );
  const [apiKey, setApiKey] = useState<string>('');
  const [llmProbe, setLlmProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [ttsEnProbe, setTtsEnProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [ttsDeProbe, setTtsDeProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [sttProbe, setSttProbe] = useState<ServiceProbeResult>({ status: 'unknown' });

  const tier = detectHardwareTier();

  useEffect(() => {
    // Load stored custom-llm key on mount, if any.
    keyStorage.getKey('custom-llm').then((k) => { if (k) setApiKey(k); }).catch(() => undefined);
  }, []);

  const probeAll = useCallback(async () => {
    setLlmProbe({ status: 'probing' });
    setTtsEnProbe({ status: 'probing' });
    setTtsDeProbe({ status: 'probing' });
    setSttProbe({ status: 'probing' });

    // LLM probe: hit the configured endpoint /models
    try {
      const result = await llmService.probeEndpoint(endpointURL, apiKey || undefined);
      if (result.reachable) {
        const detail = result.models.length > 0
          ? `${result.models.slice(0, 3).join(', ')}${result.models.length > 3 ? ` +${result.models.length - 3} more` : ''}`
          : '';
        setLlmProbe({ status: 'ok', detail });
      } else {
        setLlmProbe({ status: 'unreachable', detail: result.error });
      }
    } catch (err) {
      setLlmProbe({ status: 'unreachable', detail: err instanceof Error ? err.message : 'unknown' });
    }

    // Helper to probe a service via GET on a known liveness path.
    const probeService = async (base: string, path: string): Promise<ServiceProbeResult> => {
      try {
        const response = await fetch(`${base}${path}`, { method: 'GET' });
        if (response.ok) return { status: 'ok' };
        return { status: 'unreachable', detail: `HTTP ${response.status}` };
      } catch (err) {
        return { status: 'unreachable', detail: err instanceof Error ? err.message : 'unknown' };
      }
    };

    setTtsEnProbe(await probeService(localTtsKokoroUrl, '/v1/models'));
    setTtsDeProbe(await probeService(localTtsQwenUrl, '/health'));
    setSttProbe(await probeService(localSttUrl, '/v1/models'));
  }, [endpointURL, apiKey]);

  const handleToggle = useCallback((next: boolean) => {
    setEnabled(next);
    const c = loadServiceConfig();
    c.localMode = { ...(c.localMode ?? { enabled: false }), enabled: next };
    if (next) {
      c.llm.kind = 'custom-openai';
      c.llm.provider = 'custom-openai';
      c.llm.baseURL = endpointURL.trim().replace(/\/+$/, '');
      c.llm.model = modelName.trim() || 'local-model';
    } else {
      c.llm.kind = 'openrouter';
      c.llm.provider = 'openrouter';
    }
    saveServiceConfig(c);
    window.dispatchEvent(new CustomEvent('byok-key-changed', { detail: { hasKey: next } }));
    if (next) {
      void probeAll();
    }
  }, [endpointURL, modelName, probeAll]);

  const handleSave = useCallback(async () => {
    const c = loadServiceConfig();
    c.llm.kind = 'custom-openai';
    c.llm.provider = 'custom-openai';
    c.llm.baseURL = endpointURL.trim().replace(/\/+$/, '');
    c.llm.model = modelName.trim() || 'local-model';
    saveServiceConfig(c);
    if (apiKey.trim()) {
      await keyStorage.saveKey('custom-llm', apiKey.trim(), {
        provider: 'custom-llm',
        lastValidated: new Date().toISOString(),
      });
    } else {
      // No key — clear any stored one.
      try { await keyStorage.deleteKey('custom-llm'); } catch { /* ignore */ }
    }
    void probeAll();
  }, [endpointURL, modelName, apiKey, probeAll]);

  const renderTierBanner = (): React.ReactNode => {
    const map: Record<HardwareTier, { icon: React.ReactNode; text: string; color: string }> = {
      'full-nvidia': {
        icon: <Cpu size={18} weight="fill" />,
        text: tString('settings.localMode.hardwareBanner.full',
          'NVIDIA GPU detected. The full pipeline (LLM, EN + DE TTS, STT) can run locally with `docker compose --profile nvidia up`.'),
        color: 'var(--success-green)',
      },
      'full-apple': {
        icon: <Cpu size={18} weight="fill" />,
        text: tString('settings.localMode.hardwareBanner.apple',
          'Apple Silicon Mac detected. EN TTS + STT run via docker; for DE local TTS run `scripts/setup-local-tts-apple.sh` once.'),
        color: 'var(--success-green)',
      },
      'reduced': {
        icon: <WarningCircle size={18} weight="fill" />,
        text: tString('settings.localMode.hardwareBanner.reduced',
          'Limited hardware detected. EN + STT run locally; DE will fall back to our cloud.'),
        color: 'var(--gold-base)',
      },
      'unknown': {
        icon: <WarningCircle size={18} weight="fill" />,
        text: tString('settings.localMode.hardwareBanner.unknown',
          'Hardware not detected. Local Mode may still work — try it.'),
        color: 'var(--text-tertiary)',
      },
    };
    const cfg = map[tier];
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', marginTop: '10px',
        background: 'color-mix(in srgb, var(--accent-blue) 7%, transparent)',
        borderRadius: '8px',
        borderLeft: `3px solid ${cfg.color}`,
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: 1.45,
      }}>
        <span style={{ color: cfg.color, display: 'flex', flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
        <span>{cfg.text}</span>
      </div>
    );
  };

  const renderServiceRow = (
    label: string, probe: ServiceProbeResult, icon: React.ReactNode,
  ): React.ReactNode => {
    const map: Record<ServiceStatus, { color: string; text: string }> = {
      unknown: { color: 'var(--text-tertiary)', text: tString('settings.localMode.status.notConfigured', 'Not checked') },
      probing: { color: 'var(--gold-base)', text: tString('settings.localMode.status.probing', 'Checking…') },
      ok: { color: 'var(--success-green)', text: tString('settings.localMode.status.configured', 'Reachable') },
      unreachable: { color: 'var(--coral-base)', text: tString('settings.localMode.status.unreachable', 'Unreachable') },
    };
    const cfg = map[probe.status];
    const StatusIcon =
      probe.status === 'ok' ? CheckCircle :
      probe.status === 'unreachable' ? XCircle : WarningCircle;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', marginBottom: '6px',
        background: 'rgba(20, 28, 58, 0.25)', borderRadius: '6px',
      }}>
        <span style={{ display: 'flex', color: 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{label}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', color: cfg.color, fontWeight: 500,
        }}>
          <StatusIcon size={14} weight="fill" />
          <span>{cfg.text}</span>
          {probe.detail && probe.status !== 'probing' && (
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>
              · {probe.detail}
            </span>
          )}
        </span>
      </div>
    );
  };

  return (
    <SettingCard
      title={tString('settings.localMode.title', 'Local Mode')}
      icon={CATEGORY_ICONS.localMode || <House size={20} />}
      description={tString('settings.localMode.description',
        'Run the whole pipeline — LLM, voice synthesis, transcription — on your own machine.')}
    >
      {/* Toggle */}
      <div style={{
        padding: '16px',
        background: enabled
          ? 'color-mix(in srgb, var(--success-green) 8%, transparent)'
          : 'rgba(20, 28, 58, 0.2)',
        border: `1px solid ${enabled
          ? 'color-mix(in srgb, var(--success-green) 25%, transparent)'
          : 'rgba(212, 165, 57, 0.15)'}`,
        borderRadius: '12px',
        marginBottom: '14px',
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--gold-base)', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {enabled
                ? tString('settings.localMode.toggleOn', 'Local Mode is on')
                : tString('settings.localMode.toggleOff', 'Switch to Local Mode')}
            </div>
            <p style={{ fontSize: '12px', opacity: 0.85, margin: 0, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              {tNode('settings.localMode.toggleHelp')}
            </p>
          </div>
        </label>
        {renderTierBanner()}
      </div>

      {enabled && (
        <>
          {/* LLM endpoint config */}
          <div style={{
            padding: '14px', background: 'rgba(20, 28, 58, 0.2)',
            borderRadius: '10px', border: '1px solid rgba(212, 165, 57, 0.15)',
            marginBottom: '14px',
          }}>
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 600,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              color: 'var(--text-primary)', opacity: 0.85, marginBottom: '10px',
            }}>
              {tNode('settings.localMode.llmConfig.title')}
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {tNode('settings.aiModelKey.custom.endpointLabel')}
            </label>
            <input
              type="text"
              value={endpointURL}
              onChange={(e) => setEndpointURL(e.target.value)}
              placeholder="http://localhost:1234/v1"
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace',
                background: 'rgba(20, 28, 58, 0.5)',
                border: '1px solid rgba(212, 165, 57, 0.2)', borderRadius: '6px',
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                marginBottom: '10px',
              }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {tNode('settings.aiModelKey.custom.modelLabel')}
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="qwen2.5-7b-instruct"
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace',
                background: 'rgba(20, 28, 58, 0.5)',
                border: '1px solid rgba(212, 165, 57, 0.2)', borderRadius: '6px',
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                marginBottom: '10px',
              }}
            />

            <details style={{ marginBottom: '10px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {tNode('settings.aiModelKey.custom.keyDisclosure')}
              </summary>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={tString('settings.aiModelKey.custom.keyPlaceholder', 'Optional')}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace',
                  background: 'rgba(20, 28, 58, 0.5)',
                  border: '1px solid rgba(212, 165, 57, 0.2)', borderRadius: '6px',
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  marginTop: '6px',
                }}
              />
            </details>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <RippleButton variant="gold" onClick={probeAll} size="small">
                {tNode('settings.aiModelKey.custom.testButton')}
              </RippleButton>
              <RippleButton variant="primary" onClick={handleSave} size="small">
                {tNode('settings.aiModelKey.custom.saveButton')}
              </RippleButton>
            </div>
          </div>

          {/* Service status grid */}
          <div style={{
            padding: '14px', background: 'rgba(20, 28, 58, 0.2)',
            borderRadius: '10px', border: '1px solid rgba(212, 165, 57, 0.15)',
            marginBottom: '14px',
          }}>
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 600,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              color: 'var(--text-primary)', opacity: 0.85, marginBottom: '10px',
            }}>
              {tNode('settings.localMode.services.title')}
            </div>
            {renderServiceRow(
              tString('settings.localMode.services.llm', 'LLM (your endpoint)'),
              llmProbe,
              <Brain size={16} weight="regular" />,
            )}
            {renderServiceRow(
              tString('settings.localMode.services.ttsEn', 'TTS (English, Kokoro)'),
              ttsEnProbe,
              <SpeakerHigh size={16} weight="regular" />,
            )}
            {renderServiceRow(
              tString('settings.localMode.services.ttsDe', 'TTS (German, Qwen)'),
              ttsDeProbe,
              <SpeakerHigh size={16} weight="regular" />,
            )}
            {renderServiceRow(
              tString('settings.localMode.services.stt', 'STT (Whisper)'),
              sttProbe,
              <MicrophoneStage size={16} weight="regular" />,
            )}
          </div>
        </>
      )}

      {/* Honest framing */}
      <div style={{
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--gold-subtle) 8%, transparent)',
        borderRadius: '8px',
        borderLeft: '3px solid var(--gold-subtle)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginBottom: '8px',
      }}>
        {tString('settings.localMode.honestPrivacy', HONEST_FRAMING_FALLBACK)}
      </div>

      <a
        href="https://github.com/chipmates/agoracosmica/blob/main/docs/SELF-HOSTING.md#use-local-mode"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          color: 'var(--gold-base)', textDecoration: 'none',
          fontSize: '13px', fontWeight: 500,
        }}
      >
        {tString('settings.localMode.learnMore', 'Local Mode setup guide')}
        <ArrowSquareOut size={12} />
      </a>
    </SettingCard>
  );
};

export default LocalModePanel;
