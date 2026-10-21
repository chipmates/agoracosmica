// A story question OpenRouter refused (403) shows the refusal's own line, in
// the page language, under the question.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import de from '../../assets/translations/ui-de.json';

vi.mock('../../hooks/useTranslation', () => {
  const tString = (key: string, fallback?: string) => {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], de);
    return typeof value === 'string' ? value : fallback ?? key;
  };
  const api = { t: tString, tString, tNode: tString, tArray: () => [] };
  return { default: () => api, useTranslation: () => api };
});

import AskAnswer from '../../components/AskWhileListening/AskAnswer';

afterEach(cleanup);

describe('the story question after a refusal', () => {
  it.each(['budget', 'moderation', 'guardrail', 'forbidden'] as const)('%s: the line says why', (reason) => {
    render(
      <AskAnswer
        state="failed"
        figureName="Mark Aurel"
        exchanges={[{ question: 'Warum der Garten?', answer: '' } as never]}
        speaking={false}
        notice={`keyRefused:${reason}`}
        onStopVoice={() => {}}
        onResume={() => {}}
        onAskAnother={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe(de.errors.conversation.byokRefused[reason]);
  });
});
