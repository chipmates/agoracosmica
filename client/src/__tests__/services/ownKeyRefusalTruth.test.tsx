// What a 403 line may promise. A lifetime limit never resets, so its line names
// no reset. A budget set over the key (an organisation's guardrail, a
// workspace) is not the key's own and may not be the visitor's to raise. A
// content filter or a model's refusal is about the content or the model, not
// the key's rights. The story question says what the chat says, reset day
// included.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';
import { ownKeyRefusalFrom, OwnKeyRefusedError } from '../../services/llm/ownKeyConsent';
import { mapErrorToUserMessage } from '../../services/llm/errorMessages';
import { noteShownLanguage } from '../../utils/shownLanguage';

vi.mock('../../hooks/useTranslation', async () => {
  const bundle = (await import('../../assets/translations/ui-de.json')).default;
  const tString = (key: string, fallback?: string) => {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
    return typeof value === 'string' ? value : fallback ?? key;
  };
  const api = { t: tString, tString, tNode: tString, tArray: () => [] };
  return { default: () => api, useTranslation: () => api };
});

import AskAnswer from '../../components/AskWhileListening/AskAnswer';

const lookup = (bundle: unknown) => (key: string, fallback?: string): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  return typeof value === 'string' ? value : fallback ?? key;
};

const RESETS = '2026-11-01T00:00:00.000Z';
// The bodies as OpenRouter's error page shows them.
const BODY = {
  keyLifetime: { message: 'Budget limit exceeded (lifetime limit). $10.20 of $10.00 used.', metadata: { limit_source: 'openrouter_key_limit', scope: 'key_limit', resets_at: null } },
  keyMonthly: { message: `Budget limit exceeded (monthly limit). $10.20 of $10.00 used; resets ${RESETS}.`, metadata: { limit_source: 'openrouter_key_limit', scope: 'key_limit', resets_at: RESETS } },
  orgWeekly: {
    message: `Budget limit exceeded (weekly limit). Contact your org admin. $52.00 of $50.00 used; resets ${RESETS}.`,
    metadata: { limit_source: 'openrouter_guardrail_budget', remedy_hint: 'Wait for the budget window to reset (see metadata.resets_at), or ask your org admin to raise the guardrail budget.', scope: 'workspace_default_member', resets_at: RESETS },
  },
  workspaceLifetime: { message: 'Budget limit exceeded (lifetime limit). $50.00 of $50.00 used.', metadata: { limit_source: 'openrouter_workspace_budget', scope: 'workspace', resets_at: null } },
  orgNoMetadata: { message: `Budget limit exceeded (weekly limit). Contact your org admin. $52.00 of $50.00 used; resets ${RESETS}.` },
  contentPolicy: { message: 'Provider returned error', metadata: { error_type: 'content_policy_violation', provider_name: 'Google', raw: '{"finishReason":"SAFETY"}' } },
  modelRefusal: { message: 'The model refused to respond to this request.', metadata: { error_type: 'refusal', provider_name: 'Anthropic' } },
};

const line = (body: { message?: unknown; metadata?: Record<string, unknown> }, lang: 'de' | 'en') => {
  noteShownLanguage(lang);
  const text = mapErrorToUserMessage(ownKeyRefusalFrom(body), lookup(lang === 'de' ? de : en));
  noteShownLanguage('de');
  return text;
};

afterEach(cleanup);

describe('a lifetime limit promises no reset', () => {
  it('German', () => {
    const text = line(BODY.keyLifetime, 'de');
    expect(text).toMatch(/^OpenRouter hat diese Anfrage gestoppt, weil ein Ausgabenlimit für deinen Key erreicht ist\./);
    expect(text).not.toMatch(/zurückgesetzt|warte/i);
  });
  it('English', () => {
    const text = line(BODY.keyLifetime, 'en');
    expect(text).toMatch(/^OpenRouter stopped this request because a spending limit for your key has been reached\./);
    expect(text).not.toMatch(/reset|wait/i);
  });
  it('a dated limit keeps its reset day', () => {
    expect(line(BODY.keyMonthly, 'de')).toContain('Es wird am 1. November 2026 zurückgesetzt');
    expect(line(BODY.keyMonthly, 'en')).toContain('It resets on November 1, 2026');
  });
});

describe('a budget set over the key is not called the key\'s own', () => {
  it.each([
    ['an organisation\'s guardrail, dated', BODY.orgWeekly],
    ['a workspace budget, lifetime', BODY.workspaceLifetime],
    ['an organisation\'s guardrail, read from the message alone', BODY.orgNoMetadata],
  ])('%s', (_name, body) => {
    expect(ownKeyRefusalFrom(body).reason).toBe('budgetShared');
    const deText = line(body, 'de');
    const enText = line(body, 'en');
    expect(deText).not.toMatch(/Ausgabenlimit für deinen Key|du hebst es|Heb es/);
    expect(enText).not.toMatch(/limit for your key|you can raise it|Raise it/);
    expect(deText).toContain('Wer es bei OpenRouter verwaltet');
    expect(enText).toContain('Whoever manages it at OpenRouter');
  });
  it('names its reset day when there is one, and none for a lifetime budget', () => {
    expect(line(BODY.orgWeekly, 'de')).toContain('Es wird am 1. November 2026 zurückgesetzt.');
    expect(line(BODY.orgWeekly, 'en')).toContain('It resets on November 1, 2026.');
    expect(line(BODY.workspaceLifetime, 'de')).not.toMatch(/zurückgesetzt/);
    expect(line(BODY.workspaceLifetime, 'en')).not.toMatch(/reset/i);
  });
});

describe('a content filter or a model\'s refusal is about the content or the model', () => {
  it.each([
    ['content_policy_violation', BODY.contentPolicy, 'contentPolicy', /Inhaltsfilter/, /content filter/],
    ['refusal', BODY.modelRefusal, 'modelRefusal', /Das Modell hat eine Antwort/, /The model declined/],
  ])('%s', (_type, body, reason, deWords, enWords) => {
    expect(ownKeyRefusalFrom(body).reason).toBe(reason);
    const deText = line(body, 'de');
    const enText = line(body, 'en');
    expect(deText).toMatch(deWords);
    expect(enText).toMatch(enWords);
    expect(deText).not.toMatch(/Rechte|Limits für deinen Key/);
    expect(enText).not.toMatch(/permissions|limits apply to your key/);
  });
});

describe('the story question says what the chat says', () => {
  const renderNotice = (refusal: OwnKeyRefusedError) => render(
    <AskAnswer
      state="failed"
      figureName="Mark Aurel"
      exchanges={[{ question: 'Warum der Garten?', answer: '' } as never]}
      speaking={false}
      notice={`keyRefused:${refusal.reason}`}
      refusal={refusal}
      onStopVoice={() => {}}
      onResume={() => {}}
      onAskAnother={() => {}}
      onRetry={() => {}}
    />,
  );

  it('a dated limit shows its reset day there too', () => {
    const refusal = ownKeyRefusalFrom(BODY.keyMonthly);
    renderNotice(refusal);
    const text = screen.getByRole('status').textContent;
    expect(text).toBe(mapErrorToUserMessage(refusal, lookup(de)));
    expect(text).toContain('1. November 2026');
  });

  it('an organisation\'s dated budget shows its own line and day', () => {
    const refusal = ownKeyRefusalFrom(BODY.orgWeekly);
    renderNotice(refusal);
    expect(screen.getByRole('status').textContent).toBe(mapErrorToUserMessage(refusal, lookup(de)));
  });

  it('a content filter shows its line', () => {
    const refusal = ownKeyRefusalFrom(BODY.contentPolicy);
    renderNotice(refusal);
    expect(screen.getByRole('status').textContent).toBe(de.errors.conversation.byokRefused.contentPolicy);
  });
});

describe('the new lines keep the house rules', () => {
  it('no dash, no semicolon, no "free" or "kostenlos", no "privat"', () => {
    for (const bundle of [de, en]) {
      for (const text of Object.values(bundle.errors.conversation.byokRefused as Record<string, string>)) {
        expect(text).not.toMatch(/[—–;]|\s-\s/);
        expect(text).not.toMatch(/\bfree\b|kostenlos|privat/i);
      }
    }
  });
});
