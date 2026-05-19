// src/services/SummaryService.ts
import { getSeedById } from './seedCacheInitializer';
import { loadServiceConfig } from './audio/config/serviceConfig';
import { generateResponse } from './audio/llm';
import { generateFreeTierSummary } from './proxy/freeTierAdapter';
import { keyStorage } from './storage/keyStorageService';
import { Seed, Language } from '../types/global';

import { useDomainStore } from '../stores/domainStore';
import { isSelfHost } from '../config/deployment';

interface ServiceConfig {
  llm: {
    provider: string;
    model: string;
  };
  [key: string]: any;
}

interface LLMResponse {
  response: string;
  [key: string]: any;
}

interface SummaryMetadata {
  figureId: string;
  seedId: string | number;
  timestamp: string;
  llmProvider: string;
  llmModel: string;
}

interface Summary {
  content: string;
  metadata: SummaryMetadata;
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  timestamp?: string | number;
}

class SummaryService {
  static async generateSummary(
    history: HistoryEntry[],
    figureName: string,
    seedId: string | number
  ): Promise<Summary> {
    try {
      const config: ServiceConfig = loadServiceConfig();
      const seedInfo = await this.getSeedInfo(figureName, seedId);
      const formattedHistory = this.formatConversationHistory(history);
      const language = useDomainStore.getState().language.current || 'en';

      // Route: BYOK (OpenRouter) or free-tier (CF Worker → Nebius)
      const keyMeta = await keyStorage.getKeyMetadata('openrouter');
      const hasValidKey = keyMeta !== null && keyMeta.valid !== false;

      let responseText: string;
      let provider: string;
      let model: string;

      if (hasValidKey) {
        // BYOK path: user's own OpenRouter key
        const systemPrompt = this.generateSystemPrompt(figureName, seedInfo);
        const response: LLMResponse = await generateResponse({
          messages: [{ role: 'user', content: formattedHistory }],
          instructions: systemPrompt,
          model: config.llm.model,
          maxTokens: 4000,
          temperature: 0.7,
          streamingCallback: undefined,
        });

        if (!response || typeof response.response !== 'string') {
          throw new Error('Invalid LLM response format: missing or invalid response content');
        }
        responseText = response.response;
        provider = config.llm.provider;
        model = config.llm.model;
      } else {
        if (isSelfHost) {
          // No free-tier proxy in a self-host build. The key gate makes a
          // keyless summary unreachable; this is the defensive backstop.
          throw new Error('A valid OpenRouter key is required.');
        }
        // Free-tier path: CF Worker → Nebius (2/day rate limit)
        const response = await generateFreeTierSummary({
          figureId: figureName,
          seedTitle: seedInfo?.title || 'General Discussion',
          language,
          history: formattedHistory,
        });

        if (!response || typeof response.response !== 'string') {
          throw new Error('Invalid LLM response format: missing or invalid response content');
        }
        responseText = response.response;
        provider = 'free-tier';
        model = 'Qwen3-235B';
      }

      // Post-process: strip em/en dashes (LLMs ignore the instruction), clean markdown artifacts
      responseText = responseText
        .replace(/ ?— ?/g, ', ')  // em dash → comma (trim surrounding spaces)
        .replace(/ – /g, ', ')    // en dash → comma
        .replace(/ ,/g, ',')      // fix double space before comma
        .replace(/  +/g, ' ')     // collapse multiple spaces
        .replace(/^##\s*/gm, '')  // strip markdown headings
        .replace(/\*\*/g, '')     // strip bold markers
        .replace(/^```\s*$/gm, '') // strip code block markers
        .replace(/^>\s*/gm, '"'); // convert blockquotes to quote format

      const summary: Summary = {
        content: responseText,
        metadata: {
          figureId: figureName,
          seedId: seedId,
          timestamp: new Date().toISOString(),
          llmProvider: provider,
          llmModel: model,
        }
      };

      await this.storeSummary(figureName, seedId, summary);
      return summary;

    } catch (error) {
      console.error('Summary generation error:', error);
      throw error;
    }
  }

  static generateSystemPrompt(figureName: string, seedInfo: Seed | null): string {
    const seedTitle = seedInfo?.title || 'General Discussion';
    return `Summarize the interaction between a user and ${figureName} (a historical figure in an educational app). The seed topic is "${seedTitle}".

This summary replaces the full conversation history as context for future interactions. ${figureName} must be able to continue teaching seamlessly.

Write in the SAME LANGUAGE as the conversation. If German, summarize in German. Never translate.

## Priority order (most to least important)

1. **Key teachings and insights** from ${figureName}: central ideas, memorable quotes (preserve exact wording in quote blocks), stories, and metaphors
2. **User's contributions** (only if the user actually spoke): what they asked, what they understood, personal connections they shared. If the user only listened to a story, note that briefly and focus on the story content instead.
3. **Open threads**: unanswered questions, topics not yet explored, natural next directions
4. **Modes used**: only mention modes that were actually active. Do NOT mention modes the user has not entered. Do NOT speculate about "emerging" or "not yet entered" modes.

## Formatting rules (strict)

- Section headers must be ALL CAPS followed by a colon on their own line (e.g. KEY TEACHINGS AND INSIGHTS:)
- Use bullet points with - for lists
- Wrap direct quotes on their own line starting with " (e.g. "To be or not to be.")
- Sub-sections end with a colon on their own line (e.g. Central metaphor:)
- Never use markdown syntax (no ##, no **, no \`\`\`, no >)
- Never use em dashes or en dashes. Use commas, periods, or restructure sentences instead.
- Be concise. If the interaction was short, the summary should be short. Do not pad or speculate.
- Do NOT start with a title like "Summary of..." since the UI already provides one. Start directly with the first section header.`;
  }

  static async storeSummary(figureName: string, seedId: string | number, summary: Summary): Promise<void> {
    try {
      // Use sessionStorage (not localStorage) — summaries contain user conversation content
      // which is PII under GDPR. sessionStorage clears on tab close, avoiding persistent PII.
      // For cross-session persistence, migrate to encrypted IndexedDB in architecture sprint.
      const storageKey = `summary_${figureName}_${seedId}`;
      sessionStorage.setItem(storageKey, JSON.stringify(summary));
    } catch (error) {
      console.error('Summary storage error:', error);
      throw error;
    }
  }

  static async getSeedInfo(figureName: string, seedId: string | number): Promise<Seed | null> {
    // Get the current language from Zustand store
    const language = useDomainStore.getState().language.current || 'en';
    // Note: figureName is actually figure.id as per the calling context
    return getSeedById(figureName, seedId, language as Language);
  }

  static formatConversationHistory(history: HistoryEntry[]): string {
    const formattedHistory = history.map(entry => {
      const role = entry.role === 'user' ? 'Human' : 'Assistant';
      const mode = entry.mode ? ` [${entry.mode}]` : '';
      const timestamp = entry.timestamp ? ` (${new Date(entry.timestamp as string).toISOString()})` : '';
      return `${role}${mode}${timestamp}: ${entry.content}`;
    });

    return formattedHistory.join('\n\n');
  }

  static async loadSummary(figureName: string, seedId: string | number): Promise<Summary | null> {
    try {
      const storageKey = `summary_${figureName}_${seedId}`;
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) as Summary : null;
    } catch (error) {
      console.error('Error loading summary:', error);
      return null;
    }
  }

  static async deleteSummary(figureName: string, seedId: string | number): Promise<void> {
    try {
      const storageKey = `summary_${figureName}_${seedId}`;
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error deleting summary:', error);
      throw error;
    }
  }
}

export default SummaryService;
