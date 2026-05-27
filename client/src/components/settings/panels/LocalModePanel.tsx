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
  'When all three services below run locally, no conversation, voice, or text data leaves your machine. The same models we run on our servers can run on yours.';

type HardwareTier = 'full-nvidia' | 'full-apple' | 'reduced' | 'unknown';

function detectHardwareTier(): HardwareTier {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  // Apple Silicon detection: Mac with arm64 (most Macs in 2025+ are Apple
  // Silicon, but the UA still says "MacIntel" — `navigator.userAgentData`
  // gives us the truth when available).
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform === 'macOS') {
    return 'full-apple';
  }
  if (/Macintosh/.test(ua) && /Mac OS X 1[3-9]/.test(ua)) {
    return 'full-apple';
  }
  if (/Win|Linux/.test(ua)) {
    return 'full-nvidia';
  }
  return 'unknown';
}

// Visual style helpers shared across the three service sections.
const sectionContainerStyle = (active: boolean): React.CSSProperties => ({
  padding: '14px',
  background: active
    ? 'color-mix(in srgb, var(--success-green) 6%, transparent)'
    : 'rgba(20, 28, 58, 0.2)',
  border: `1px solid ${active
    ? 'color-mix(in srgb, var(--success-green) 22%, transparent)'
    : 'rgba(212, 165, 57, 0.15)'}`,
  borderRadius: '12px',
  marginBottom: '12px',
});

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace',
  background: 'rgba(20, 28, 58, 0.5)',
  border: '1px solid rgba(212, 165, 57, 0.2)', borderRadius: '6px',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  marginBottom: '10px',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px',
};

const sectionHelpStyle: React.CSSProperties = {
  fontSize: '12px', opacity: 0.85, margin: 0, lineHeight: 1.45, color: 'var(--text-secondary)',
};

const LocalModePanel: FC<LocalModePanelProps> = ({ SettingCard, CATEGORY_ICONS }) => {
  const { tString, tNode } = useTranslation();
  const config = loadServiceConfig();
  const lm = config.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false };

  const [llmEnabled, setLlmEnabled] = useState<boolean>(lm.llmEnabled);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(lm.ttsEnabled);
  const [sttEnabled, setSttEnabled] = useState<boolean>(lm.sttEnabled);

  const [endpointURL, setEndpointURL] = useState<string>(
    config.llm.baseURL || 'http://localhost:1234/v1',
  );
  const [modelName, setModelName] = useState<string>(
    (config.llm.kind === 'custom-openai' && config.llm.model) || 'qwen3.6-27b-instruct',
  );
  const [apiKey, setApiKey] = useState<string>('');

  const [kokoroURL, setKokoroURL] = useState<string>(lm.ttsKokoroURL || localTtsKokoroUrl);
  const [qwenURL, setQwenURL] = useState<string>(lm.ttsQwenURL || localTtsQwenUrl);
  const [sttURL, setSttURL] = useState<string>(lm.sttURL || localSttUrl);

  const [llmProbe, setLlmProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [ttsEnProbe, setTtsEnProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [ttsDeProbe, setTtsDeProbe] = useState<ServiceProbeResult>({ status: 'unknown' });
  const [sttProbe, setSttProbe] = useState<ServiceProbeResult>({ status: 'unknown' });

  const tier = detectHardwareTier();

  useEffect(() => {
    keyStorage.getKey('custom-llm').then((k) => { if (k) setApiKey(k); }).catch(() => undefined);
  }, []);

  // Probe one OpenAI-compat reachability via GET on a known liveness path.
  const probeService = useCallback(async (base: string, path: string): Promise<ServiceProbeResult> => {
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}${path}`, { method: 'GET' });
      if (response.ok) return { status: 'ok' };
      return { status: 'unreachable', detail: `HTTP ${response.status}` };
    } catch (err) {
      return { status: 'unreachable', detail: err instanceof Error ? err.message : 'unknown' };
    }
  }, []);

  const probeLLM = useCallback(async () => {
    setLlmProbe({ status: 'probing' });
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
  }, [endpointURL, apiKey]);

  const probeTTS = useCallback(async () => {
    setTtsEnProbe({ status: 'probing' });
    setTtsDeProbe({ status: 'probing' });
    setTtsEnProbe(await probeService(kokoroURL, '/v1/models'));
    setTtsDeProbe(await probeService(qwenURL, '/health'));
  }, [kokoroURL, qwenURL, probeService]);

  const probeSTT = useCallback(async () => {
    setSttProbe({ status: 'probing' });
    setSttProbe(await probeService(sttURL, '/v1/models'));
  }, [sttURL, probeService]);

  // Toggle handlers — each flips its own bit, the LLM toggle additionally
  // flips `llm.kind` so the chat path picks the right provider.
  const handleToggleLLM = useCallback((next: boolean) => {
    setLlmEnabled(next);
    const c = loadServiceConfig();
    c.localMode = {
      ...(c.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false }),
      llmEnabled: next,
    };
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
    if (next) void probeLLM();
  }, [endpointURL, modelName, probeLLM]);

  const handleToggleTTS = useCallback((next: boolean) => {
    setTtsEnabled(next);
    const c = loadServiceConfig();
    c.localMode = {
      ...(c.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false }),
      ttsEnabled: next,
    };
    saveServiceConfig(c);
    if (next) void probeTTS();
  }, [probeTTS]);

  const handleToggleSTT = useCallback((next: boolean) => {
    setSttEnabled(next);
    const c = loadServiceConfig();
    c.localMode = {
      ...(c.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false }),
      sttEnabled: next,
    };
    saveServiceConfig(c);
    if (next) void probeSTT();
  }, [probeSTT]);

  // Save handlers — persist the per-section config + run a probe so the user
  // sees the result of the change.
  const handleSaveLLM = useCallback(async () => {
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
      try { await keyStorage.deleteKey('custom-llm'); } catch { /* ignore */ }
    }
    void probeLLM();
  }, [endpointURL, modelName, apiKey, probeLLM]);

  const handleSaveTTS = useCallback(() => {
    const c = loadServiceConfig();
    c.localMode = {
      ...(c.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false }),
      ttsKokoroURL: kokoroURL.trim().replace(/\/+$/, '') || undefined,
      ttsQwenURL: qwenURL.trim().replace(/\/+$/, '') || undefined,
    };
    saveServiceConfig(c);
    void probeTTS();
  }, [kokoroURL, qwenURL, probeTTS]);

  const handleSaveSTT = useCallback(() => {
    const c = loadServiceConfig();
    c.localMode = {
      ...(c.localMode ?? { llmEnabled: false, ttsEnabled: false, sttEnabled: false }),
      sttURL: sttURL.trim().replace(/\/+$/, '') || undefined,
    };
    saveServiceConfig(c);
    void probeSTT();
  }, [sttURL, probeSTT]);

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
          'Hardware not detected. Local Mode may still work, try it.'),
        color: 'var(--text-tertiary)',
      },
    };
    const cfg = map[tier];
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', marginBottom: '12px',
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

  const renderProbePill = (probe: ServiceProbeResult, label?: string): React.ReactNode => {
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
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '12px', color: cfg.color, fontWeight: 500,
      }}>
        {label && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{label}:</span>}
        <StatusIcon size={14} weight="fill" />
        <span>{cfg.text}</span>
        {probe.detail && probe.status !== 'probing' && (
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>
            · {probe.detail}
          </span>
        )}
      </div>
    );
  };

  const renderToggleHeader = (
    icon: React.ReactNode,
    checked: boolean,
    label: string,
    helpText: React.ReactNode,
    onChange: (next: boolean) => void,
  ): React.ReactNode => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: checked ? '14px' : 0 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--gold-base)', flexShrink: 0 }}
      />
      <span style={{ display: 'flex', color: 'var(--text-secondary)', marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={sectionLabelStyle}>{label}</div>
        <p style={sectionHelpStyle}>{helpText}</p>
      </div>
    </label>
  );

  return (
    <SettingCard
      title={tString('settings.localMode.title', 'Local Mode')}
      icon={CATEGORY_ICONS.localMode || <House size={20} />}
      description={tString('settings.localMode.description',
        'Run any combination of the three services on your own machine: LLM, voice, transcription.')}
    >
      {renderTierBanner()}

      {/* ─── LLM section ──────────────────────────────────────────────── */}
      <div style={sectionContainerStyle(llmEnabled)}>
        {renderToggleHeader(
          <Brain size={18} weight="regular" />,
          llmEnabled,
          tString('settings.localMode.sections.llm.label', 'Run LLM locally'),
          tString('settings.localMode.sections.llm.help',
            'Route chat to an OpenAI-compatible endpoint you run (LM Studio, Ollama, vLLM, llama.cpp).'),
          handleToggleLLM,
        )}

        {llmEnabled && (
          <>
            <label style={labelStyle}>
              {tNode('settings.aiModelKey.custom.endpointLabel')}
            </label>
            <input
              type="text"
              value={endpointURL}
              onChange={(e) => setEndpointURL(e.target.value)}
              placeholder="http://localhost:1234/v1"
              style={inputStyle}
            />

            <label style={labelStyle}>
              {tNode('settings.aiModelKey.custom.modelLabel')}
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="qwen3.6-27b-instruct"
              style={inputStyle}
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
                style={{ ...inputStyle, marginTop: '6px', marginBottom: 0 }}
              />
            </details>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
              <RippleButton variant="gold" onClick={probeLLM} size="small">
                {tNode('settings.aiModelKey.custom.testButton')}
              </RippleButton>
              <RippleButton variant="primary" onClick={handleSaveLLM} size="small">
                {tNode('settings.aiModelKey.custom.saveButton')}
              </RippleButton>
              <span style={{ marginLeft: 'auto' }}>{renderProbePill(llmProbe)}</span>
            </div>
          </>
        )}
      </div>

      {/* ─── TTS section ──────────────────────────────────────────────── */}
      <div style={sectionContainerStyle(ttsEnabled)}>
        {renderToggleHeader(
          <SpeakerHigh size={18} weight="regular" />,
          ttsEnabled,
          tString('settings.localMode.sections.tts.label', 'Run voice synthesis locally'),
          tString('settings.localMode.sections.tts.help',
            'Route read-aloud audio to your local Kokoro container (English) and Qwen3-TTS service (German).'),
          handleToggleTTS,
        )}

        {ttsEnabled && (
          <>
            <label style={labelStyle}>
              {tString('settings.localMode.urlOverrides.kokoroLabel', 'English endpoint (Kokoro)')}
            </label>
            <input
              type="text"
              value={kokoroURL}
              onChange={(e) => setKokoroURL(e.target.value)}
              placeholder="http://localhost:8880"
              style={inputStyle}
            />

            <label style={labelStyle}>
              {tString('settings.localMode.urlOverrides.qwenLabel', 'German endpoint (Qwen3-TTS)')}
            </label>
            <input
              type="text"
              value={qwenURL}
              onChange={(e) => setQwenURL(e.target.value)}
              placeholder="http://localhost:8887"
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
              <RippleButton variant="gold" onClick={probeTTS} size="small">
                {tNode('settings.aiModelKey.custom.testButton')}
              </RippleButton>
              <RippleButton variant="primary" onClick={handleSaveTTS} size="small">
                {tNode('settings.aiModelKey.custom.saveButton')}
              </RippleButton>
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px' }}>
              {renderProbePill(ttsEnProbe, tString('settings.localMode.sections.tts.labelEn', 'EN'))}
              {renderProbePill(ttsDeProbe, tString('settings.localMode.sections.tts.labelDe', 'DE'))}
            </div>
          </>
        )}
      </div>

      {/* ─── STT section ──────────────────────────────────────────────── */}
      <div style={sectionContainerStyle(sttEnabled)}>
        {renderToggleHeader(
          <MicrophoneStage size={18} weight="regular" />,
          sttEnabled,
          tString('settings.localMode.sections.stt.label', 'Run transcription locally'),
          tString('settings.localMode.sections.stt.help',
            'Route microphone audio to your local Whisper container instead of our cloud transcription.'),
          handleToggleSTT,
        )}

        {sttEnabled && (
          <>
            <label style={labelStyle}>
              {tString('settings.localMode.urlOverrides.whisperLabel', 'Whisper endpoint')}
            </label>
            <input
              type="text"
              value={sttURL}
              onChange={(e) => setSttURL(e.target.value)}
              placeholder="http://localhost:8000"
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
              <RippleButton variant="gold" onClick={probeSTT} size="small">
                {tNode('settings.aiModelKey.custom.testButton')}
              </RippleButton>
              <RippleButton variant="primary" onClick={handleSaveSTT} size="small">
                {tNode('settings.aiModelKey.custom.saveButton')}
              </RippleButton>
              <span style={{ marginLeft: 'auto' }}>{renderProbePill(sttProbe)}</span>
            </div>
          </>
        )}
      </div>

      {/* Honest framing */}
      <div style={{
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--gold-subtle) 8%, transparent)',
        borderRadius: '8px',
        borderLeft: '3px solid var(--gold-subtle)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginTop: '6px',
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
