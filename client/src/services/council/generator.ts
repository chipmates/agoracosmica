/**
 * CustomCouncilGenerator - Bulletproof implementation for custom philosophical councils
 * 
 * This service handles the complete generation of custom councils with:
 * - Clear separation of concerns
 * - Extensive validation
 * - Comprehensive debugging
 * - Format enforcement
 */

import { generateResponse } from '../audio/llm';
import { generateFreeTierCouncilResponse } from '../proxy/freeTierAdapter';
import { isSelfHost } from '../../config/deployment';
import { loadServiceConfig, LLM_SERVICES } from '../audio/config/serviceConfig';
import { preferencesAdapter } from '../../storage/preferencesAdapter';
import { keyStorage } from '../storage/keyStorageService';
import { getVoicesForCouncil } from '../audio/voices';
import { getFullName } from './speakerRegistry';
import { councilDiagnostics } from './diagnostics';
import { useDomainStore } from '../../stores';
import type { Segment } from './parser';
import { councilLog, councilWarn, councilError } from './logger';
import { cleanCouncilTextForTts } from '../../utils/ttsTextCleaner';
import { screenContent } from '../../utils/contentSafety';

// ─── Voice profile fetch — module-level cache + language-aware ─────────────
//
// Audit Change #14: parallel voice-profile fetches via Promise.all + module-
// level cache so the second council in a session is instant for any figure
// that was already loaded.
//
// DE profile wiring: when the council language is 'de', try
// `voice-profiles/de/{id}.json` first (Opus-translated DE prose). Fall back
// to the English profile per-figure on any 404, parse failure, or network
// error — that way new figures or partial deploys never break custom council
// generation. Cache key includes the language so EN and DE variants don't
// collide.

const _profileCache = new Map<string, VoiceProfile>();

function _resolveMediaBase(): string {
  return import.meta.env.DEV ? '' : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');
}

async function _fetchProfileFromPath(path: string): Promise<VoiceProfile | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    if (!response.headers.get('content-type')?.includes('application/json')) return null;
    return (await response.json()) as VoiceProfile;
  } catch {
    return null;
  }
}

async function fetchVoiceProfileCached(
  participantId: string,
  language: string,
): Promise<VoiceProfile | null> {
  const isDE = language === 'de' || language === 'german' || language === 'deutsch';
  const cacheKey = `${isDE ? 'de' : 'en'}:${participantId}`;

  const cached = _profileCache.get(cacheKey);
  if (cached) return cached;

  const mediaBase = _resolveMediaBase();
  // For DE councils try the translated dir first, fall through to EN on miss.
  if (isDE) {
    const dePath = `${mediaBase}/voice-profiles/de/${participantId}.json`;
    const deProfile = await _fetchProfileFromPath(dePath);
    if (deProfile) {
      _profileCache.set(cacheKey, deProfile);
      return deProfile;
    }
  }
  const enPath = `${mediaBase}/voice-profiles/en/${participantId}.json`;
  const enProfile = await _fetchProfileFromPath(enPath);
  if (enProfile) {
    _profileCache.set(cacheKey, enProfile);
    return enProfile;
  }
  return null;
}

// ============================================
// Type Definitions
// ============================================

interface CouncilConfig {
  moderator: string;
  participants: string[];
  question: string;
  type: 'debate' | 'advisory';
  language?: string;
  ttsSettings?: {
    model?: string;
    provider?: string;
    speed?: number;
  };
  onSegment?: (segment: Segment | PartialSegment) => void;
  signal?: AbortSignal;
}

interface BiographicalScene {
  period?: string;
  setting?: string;
  scene?: string;
  sensory?: string;
  teaches?: string;
  source?: string;
  basis?: string;
}

interface VoiceProfile {
  id?: string;
  name?: string;
  displayName?: string;
  essence?: string;
  philosophy?: {
    core?: string;
    tradition?: string;
  };
  voice?: {
    tone?: string;
    sensoryWorld?: string[];
    biographicalScenes?: BiographicalScene[];
    characteristics?: string[];
    avoidances?: string[];
  };
  signaturePhrases?: string[];
  interaction?: {
    debateStyle?: string;
  };
  metadata?: {
    keyLifeEvents?: string[];
    keyRelationships?: string[];
  };
}

interface CouncilData {
  config: ValidatedConfig;
  instruction: string | null;
  voiceProfiles: Record<string, VoiceProfile>;
  expectedSpeakers: string[];
  voiceMappings?: Record<string, string>;
}

interface ValidatedConfig {
  moderator: string;
  participants: string[];
  question: string;
  type: 'debate' | 'advisory';
  language: string;
}

interface ApiRequest {
  systemMessage: string;
  userMessage: string;
  expectedSpeakers: string[];
  config: {
    provider: string;
    model: string;
    maxTokens: number;
    temperature: number;
    language?: string;
  };
}

interface LLMResult {
  fullResponse: string;
  progressiveSegments: Segment[];
  allSegments: Segment[];
  metrics?: any;
  qualityReport?: any;
}

interface GenerationResult {
  success: boolean;
  segments?: Segment[];
  metadata?: {
    participantCount: number;
    expectedSpeakers: string[];
    actualSpeakers: string[];
    totalSegments: number;
    voiceMappings: Record<string, string>;
    progressiveStreaming: {
      enabled: boolean;
      streamedSegments: number;
      metrics: any | null;
      qualityReport: any | null;
    };
    debugLog: LogEntry[];
  };
  error?: string;
  validationErrors?: string[];
  debugLog?: LogEntry[];
}

interface LogEntry {
  timestamp: string;
  message: string;
  data: any;
}


export interface PartialSegment {
  type?: 'partial' | 'standard' | 'interruption';
  partialText?: string;
  segmentId?: number;
  isFirstChunk?: boolean;
  speaker?: string;
  speakerId?: string;
  content?: string;
  id?: number;
}

class CustomCouncilGenerator {
  private debugMode: boolean;
  private validationErrors: string[];
  private generationLog: LogEntry[];
  private onProgressiveSegment: ((segment: Segment | PartialSegment) => void) | null;
  private streamStartTime?: number;
  private signal?: AbortSignal;

  constructor() {
    this.debugMode = true; // Always on for development
    this.validationErrors = [];
    this.generationLog = [];
    this.onProgressiveSegment = null; // Callback for progressive segments
  }

  /**
   * Set callback for progressive segment processing
   */
  setProgressiveSegmentCallback(callback: (segment: Segment | PartialSegment) => void): void {
    this.onProgressiveSegment = callback;
  }

  /**
   * Main entry point - generates a complete custom council
   */
  async generateCouncil(config: CouncilConfig): Promise<GenerationResult> {
    // Reset state from any previous generation
    this.generationLog = [];
    this.validationErrors = [];
    this.signal = config.signal;

    this.log('🚀 Starting custom council generation', config);

    // Set up progressive segment callback if provided
    if (config.onSegment) {
      this.onProgressiveSegment = config.onSegment;
      this.log('🔄 Progressive segment callback registered');
    }
    
    try {
      // Step 1: Validate configuration
      const validatedConfig = await this.validateConfig(config);
      
      // Step 2: Load all required data
      const councilData = await this.loadCouncilData(validatedConfig);
      
      // Step 2.5: Generate explicit voice mappings for council
      const allParticipants = [validatedConfig.moderator, ...validatedConfig.participants];
      // Account for language routing: German forces OpenAI (Kokoro/DeepInfra is English-only)
      const configProvider = config.ttsSettings?.provider;
      const configLanguage = config.language || 'en';
      const effectiveProvider = (configLanguage === 'de' && configProvider === 'deepinfra') ? 'openai' : configProvider;
      const ttsEngine = (effectiveProvider === 'kokoro' || effectiveProvider === 'deepinfra') ? 'kokoro' : 'openai';
      const voiceMappings = getVoicesForCouncil(allParticipants, ttsEngine);
      councilData.voiceMappings = voiceMappings;

      councilLog('🎙️ [Council] Voice mappings generated:', voiceMappings);
      
      // Step 3: Build the API request
      const apiRequest = await this.buildApiRequest(councilData);
      
      // Step 4: Make the LLM call with progressive streaming
      const llmResult = await this.callLLM(apiRequest);
      
      // Step 5: Use progressive segments or fallback to parsing
      let segments: Segment[];
      if (llmResult.progressiveSegments && llmResult.progressiveSegments.length > 0) {
        this.log('🚀 Using progressive segments:', llmResult.progressiveSegments.length);
        segments = llmResult.allSegments; // Use final segments which include any missed in streaming
      } else {
        this.log('⚠️ Falling back to traditional parsing');
        segments = await this.parseResponse(llmResult.fullResponse, councilData);
      }
      
      // Step 6: Return formatted result
      return {
        success: true,
        segments,
        metadata: {
          participantCount: validatedConfig.participants.length,
          expectedSpeakers: councilData.expectedSpeakers,
          actualSpeakers: [...new Set(segments.map(s => s.speaker))],
          totalSegments: segments.length,
          voiceMappings: councilData.voiceMappings,
          progressiveStreaming: {
            enabled: llmResult.progressiveSegments && llmResult.progressiveSegments.length > 0,
            streamedSegments: llmResult.progressiveSegments ? llmResult.progressiveSegments.length : 0,
            metrics: llmResult.metrics || null,
            qualityReport: llmResult.qualityReport || null
          },
          debugLog: this.generationLog
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('❌ Generation failed', error);
      return {
        success: false,
        error: errorMessage,
        validationErrors: this.validationErrors,
        debugLog: this.generationLog
      };
    }
  }

  /**
   * Step 1: Validate configuration
   */
  private async validateConfig(config: CouncilConfig): Promise<ValidatedConfig> {
    this.log('🔍 Validating configuration');
    this.validationErrors = [];
    
    // Required fields
    if (!config.moderator) {
      this.validationErrors.push('Missing moderator');
    }
    
    if (!config.participants || config.participants.length < 2) {
      this.validationErrors.push('Need at least 2 participants');
    }
    
    if (!config.question || config.question.trim().length < 10) {
      this.validationErrors.push('Question too short (min 10 chars)');
    }

    if (!config.type || !['debate', 'advisory'].includes(config.type)) {
      this.validationErrors.push('Invalid type (must be debate or advisory)');
    }

    // Layer 1: Content safety screen — detect distress signals and harmful topics
    if (config.question) {
      const safetyResult = screenContent(config.question);
      if (!safetyResult.safe) {
        councilWarn(`[Safety] Topic flagged: ${safetyResult.category}`);
        throw new Error(`SAFETY_FLAGGED:${JSON.stringify(safetyResult.crisisResources)}`);
      }
    }

    if (this.validationErrors.length > 0) {
      throw new Error(`Validation failed: ${this.validationErrors.join(', ')}`);
    }
    
    // Return validated and normalized config
    return {
      moderator: config.moderator.toLowerCase(),
      participants: config.participants.map(p => p.toLowerCase()),
      question: config.question.trim(),
      type: config.type,
      language: config.language || 'en'
    };
  }

  /**
   * Step 2: Load all required data (voice profiles, instructions)
   */
  private async loadCouncilData(config: ValidatedConfig): Promise<CouncilData> {
    this.log('📚 Loading council data');
    
    const data: CouncilData = {
      config,
      instruction: null,
      voiceProfiles: {},
      expectedSpeakers: []
    };
    
    // Load instruction template
    try {
      const instructionPath = `/assets/instructions/council_${config.type}_master.json`;
      const response = await fetch(instructionPath);
      if (!response.ok) throw new Error(`Failed to load instruction: ${response.status}`);
      const instructionData = await response.json();
      data.instruction = instructionData.system;
      if (data.instruction) {
        this.log('✅ Loaded instruction template', { type: config.type, length: data.instruction.length });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load instruction template: ${errorMessage}`);
    }
    
    // Load voice profiles for all participants in parallel (audit Change #14)
    // with module-level cache hits and language-aware DE fetch.
    const allParticipants = [config.moderator, ...config.participants];
    const fetchedProfiles = await Promise.all(
      allParticipants.map((id) => fetchVoiceProfileCached(id, config.language)),
    );

    // Preserve participant order in expectedSpeakers (LLM prompt depends on it).
    allParticipants.forEach((participantId, idx) => {
      const profile = fetchedProfiles[idx];
      if (profile) {
        data.voiceProfiles[participantId] = profile;
        const speakerLabel =
          profile.displayName ||
          (profile.name ? profile.name.toUpperCase() : this.getParticipantName(participantId).toUpperCase());
        data.expectedSpeakers.push(speakerLabel);
        this.log(`✅ Loaded voice profile: ${participantId} (${config.language})`);
      } else {
        // Build minimal fallback so generation can still proceed.
        const name = this.getParticipantName(participantId);
        data.voiceProfiles[participantId] = {
          id: participantId,
          name,
          displayName: name.toUpperCase(),
        };
        data.expectedSpeakers.push(name.toUpperCase());
        this.log(`⚠️ Using fallback for: ${participantId}`);
      }
    });
    
    this.log('📊 Council data loaded', {
      instruction: data.instruction ? 'loaded' : 'missing',
      profilesLoaded: Object.keys(data.voiceProfiles).length,
      expectedSpeakers: data.expectedSpeakers,
      expectedSpeakersDetail: data.expectedSpeakers.map(s => `"${s}"`)
    });
    
    return data;
  }

  /**
   * Step 3: Build the API request with clear separation
   */
  private async buildApiRequest(councilData: CouncilData): Promise<ApiRequest> {
    this.log('🔧 Building API request');
    
    const { config, instruction, voiceProfiles, expectedSpeakers } = councilData;
    
    // Format voice profiles
    const profileTexts: string[] = [];
    for (const [, profile] of Object.entries(voiceProfiles)) {
      if (profile.essence) {
        // Full profile available
        profileTexts.push(this.formatVoiceProfile(profile));
      } else {
        // Minimal profile
        profileTexts.push(`### ${profile.displayName}\n**Role**: Philosophical thinker`);
      }
    }
    
    // Process instruction with substitutions
    const participantNames = config.participants.map(p =>
      voiceProfiles[p]?.name || this.getParticipantName(p)
    ).join(', ');

    const moderatorName = voiceProfiles[config.moderator]?.name || this.getParticipantName(config.moderator);
    const userLanguage = config.language || 'en';

    const processedInstruction = instruction!
      .replace('{{COUNCIL_TYPE}}', config.type)
      .replace('{{TOPIC}}', config.question)
      .replace('{{MODERATOR}}', moderatorName)
      .replace('{{PARTICIPANTS}}', participantNames)
      .replace('{{PARTICIPANT_PROFILES}}', profileTexts.join('\n\n'))
      .replace('{{LANGUAGE}}', userLanguage === 'de' ? 'German' : 'English');
    
    let processedQuestion = config.question;

    if (userLanguage === 'de' || userLanguage === 'german') {
      this.log('🇩🇪 German language detected - appending German instruction');
      processedQuestion = `${config.question} Bitte sprechen Sie auf deutsch.`;
    }

    // Create user message - just the task
    const userMessage = `Please create a ${config.type} council on the following question:

"${processedQuestion}"

The participants are: ${participantNames}
Moderator: ${moderatorName}

Begin the council now. Remember to use the EXACT format specified in your instructions for EVERY line of dialogue.`;

    // Load service configuration
    const serviceConfig = loadServiceConfig();
    
    const apiRequest: ApiRequest = {
      systemMessage: processedInstruction,
      userMessage: userMessage,
      expectedSpeakers: expectedSpeakers,
      config: {
        provider: serviceConfig.llm.provider || LLM_SERVICES.OPENROUTER.name,
        model: serviceConfig.llm.model || LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
        maxTokens: 16000,
        temperature: 0.8,
        language: config.language
      }
    };
    
    // 🔍 DIAGNOSTIC: Measure prompt size impact
    const promptSize = apiRequest.systemMessage.length + apiRequest.userMessage.length;
    const estimatedTokens = Math.ceil(promptSize / 4); // Rough estimate
    
    this.log('📋 API request built', {
      systemMessageLength: apiRequest.systemMessage.length,
      userMessageLength: apiRequest.userMessage.length,
      totalPromptSize: promptSize,
      estimatedTokens: estimatedTokens,
      expectedSpeakers: apiRequest.expectedSpeakers
    });
    
    if (estimatedTokens > 5000) {
      councilWarn(`⚠️ LARGE PROMPT DETECTED: ~${estimatedTokens} tokens may cause delays`);
    }
    
    return apiRequest;
  }

  /**
   * Step 4: Make the LLM call with progressive streaming
   */
  private async callLLM(apiRequest: ApiRequest): Promise<LLMResult> {
    this.log('📡 Calling LLM API with progressive streaming');
    this.log('🚀 Using model:', apiRequest.config.model);
    councilLog('🔍 DEBUG: Model being used:', apiRequest.config.model);
    
    let fullResponse = '';
    const chunks: string[] = [];
    const streamedSegments: Segment[] = []; // Track segments for progressive processing

    // Qwen3 outputs <think>...</think> blocks before the actual response.
    // We must strip these to prevent thinking text from being parsed as council segments.
    let thinkStrippingDone = false;
    let thinkBuffer = '';
    
    // Initialize streaming parser with progressive callback
    const { CustomCouncilParser } = await import('./parser');
    const streamingParser = new CustomCouncilParser({
      participants: apiRequest.expectedSpeakers,
      mode: 'debate',
      onSegment: (segment: Segment) => {
        // 🚀 PROGRESSIVE STREAMING: Process segments immediately
        streamedSegments.push(segment);
        this.log('⚡ Progressive segment parsed:', {
          id: segment.id,
          speaker: segment.speaker,
          wordCount: (segment as any).wordCount,
          timeFromStart: Date.now() - (this.streamStartTime || 0)
        });
        
        // Notify the calling service about new segment
        if (this.onProgressiveSegment) {
          this.onProgressiveSegment(segment);
        }
      }
    });
    
    // Track streaming start time
    this.streamStartTime = Date.now();
    const originalSelectedFigure = useDomainStore.getState().figures.selectedId;
    const originalSelectedSeedId = useDomainStore.getState().seeds.selectedId;
    const originalSeedData = originalSelectedFigure && originalSelectedSeedId
      ? useDomainStore.getState().seeds.byFigure[originalSelectedFigure]?.find(
          s => s.id.toString() === originalSelectedSeedId
        )
      : null;

    // Determine routing: BYOK key → generateResponse(), otherwise → free-tier council proxy
    const keyMeta = await keyStorage.getKeyMetadata('openrouter');
    const hasBYOKKey = keyMeta !== null && keyMeta.valid !== false;
    councilLog(`🔑 Council routing: ${hasBYOKKey ? 'BYOK (OpenRouter)' : 'Free-tier (Nebius proxy)'}`);

    try {
      // 🚀 PERFORMANCE FIX: Clear seed data before council generation
      // Councils don't need seed data and it adds 5KB+ to the prompt causing 70s delays
      // Temporarily clear seed data for councils
      preferencesAdapter.setSelectedFigureId(null);
      if (originalSelectedFigure) {
        preferencesAdapter.setSelectedSeed(originalSelectedFigure, null);
      }

      councilLog('🚀 PERFORMANCE: Temporarily cleared seed data for council generation');

      // Shared streaming callback for both BYOK and free-tier paths
      const councilStreamingCallback = async (chunk: string) => {
          chunks.push(chunk);
          fullResponse += chunk;

          // Strip Qwen3 <think>...</think> blocks before parsing.
          // Buffer all content until thinking block is resolved, then pass clean text to parser.
          let cleanChunk: string;
          if (!thinkStrippingDone) {
            thinkBuffer += chunk;
            if (thinkBuffer.includes('</think>')) {
              // Found end of thinking block — extract content after </think>
              const endIdx = thinkBuffer.indexOf('</think>');
              cleanChunk = thinkBuffer.substring(endIdx + '</think>'.length);
              thinkStrippingDone = true;
              thinkBuffer = '';
              councilLog('🧠 Stripped Qwen3 thinking block from stream');
            } else if (!thinkBuffer.includes('<think') && thinkBuffer.length > 50) {
              // No <think> tag found and buffer is long enough — not a thinking model
              cleanChunk = thinkBuffer;
              thinkStrippingDone = true;
              thinkBuffer = '';
            } else {
              // Still accumulating thinking block or waiting to detect <think>
              return;
            }
          } else {
            cleanChunk = chunk;
          }

          // Skip empty chunks after stripping
          if (!cleanChunk.trim()) return;

          // 🔍 STREAMING DEBUG: Log every chunk to verify streaming is working
          const timeFromStart = Date.now() - (this.streamStartTime || 0);
          councilLog(`🔥 CHUNK ${chunks.length} RECEIVED at T+${timeFromStart}ms:`, {
            chunkLength: cleanChunk.length,
            chunkContent: cleanChunk.substring(0, 200),
            totalChunks: chunks.length,
            totalLength: fullResponse.length
          });

          // 🚀 PROGRESSIVE STREAMING: Process chunk immediately
          try {
            const parseResult = streamingParser.processChunk(cleanChunk);

            // 🚀 NEW: Handle partial updates for immediate display
            if (parseResult.partialUpdate) {
              const partial = parseResult.partialUpdate;
              councilLog(`⚡ PARTIAL UPDATE: ${partial.speaker} - ${(partial.content || '').length} chars at T+${timeFromStart}ms`);

              // Emit partial update immediately
              if (this.onProgressiveSegment && (partial as any).isFirstChunk) {
                councilLog(`🎯 FIRST CONTENT STREAMING at T+${timeFromStart}ms!`);
                councilDiagnostics.recordFirstPartial();
                this.onProgressiveSegment({
                  ...partial,
                  type: 'partial',
                  partialText: partial.content
                } as PartialSegment);
              }
            }

            if (parseResult.newSegments.length > 0) {
              councilLog(`⚡ SEGMENTS PARSED: ${parseResult.newSegments.length} from chunk ${chunks.length} at T+${timeFromStart}ms`);

              // Log first segment timing
              if (streamedSegments.length === 0 && parseResult.newSegments.length > 0) {
                councilLog(`🎯 FIRST COMPLETE SEGMENT: ${parseResult.newSegments[0].speaker} at T+${timeFromStart}ms`);
              }
            }
          } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            councilError('❌ Parse error:', errorMessage);
          }
      };

      // Route through BYOK or free-tier based on key availability
      if (hasBYOKKey) {
        await generateResponse({
          messages: [{ role: 'user', content: apiRequest.userMessage }],
          instructions: apiRequest.systemMessage,
          model: apiRequest.config.model,
          maxTokens: apiRequest.config.maxTokens,
          temperature: apiRequest.config.temperature,
          language: apiRequest.config.language,
          signal: this.signal,
          streamingCallback: councilStreamingCallback,
        });
      } else {
        if (isSelfHost) {
          // No free-tier proxy in a self-host build. The key gate makes a
          // keyless council unreachable; this is the defensive backstop.
          throw new Error('A valid OpenRouter key is required.');
        }
        await generateFreeTierCouncilResponse({
          systemPrompt: apiRequest.systemMessage,
          messages: [{ role: 'user' as const, content: apiRequest.userMessage }],
          language: apiRequest.config.language || 'en',
          signal: this.signal,
          streamingCallback: councilStreamingCallback,
        });
      }
      
      // Strip <think>...</think> from fullResponse for fallback parser
      fullResponse = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // Flush any remaining content in parser
      const finalParseResult = streamingParser.complete();
      if (finalParseResult.segments.length > streamedSegments.length) {
        this.log('📝 Final parser flush found additional segments:', finalParseResult.segments.length - streamedSegments.length);
      }
      
      this.log('✅ LLM call complete', {
        totalChunks: chunks.length,
        responseLength: fullResponse.length,
        progressiveSegments: streamedSegments.length,
        finalSegments: finalParseResult.segments.length
      });
      
      // Generate diagnostics report
      const diagnosticReport = councilDiagnostics.generateReport();
      councilLog('📊 PERFORMANCE DIAGNOSTICS:', diagnosticReport.verdict);
      
      // Return both full response and progressive segments for backward compatibility
      return {
        fullResponse,
        progressiveSegments: streamedSegments,
        allSegments: finalParseResult.segments,
        metrics: finalParseResult.metrics,
        qualityReport: (finalParseResult as any).qualityReport
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM call failed: ${errorMessage}`);
    } finally {
      // Only restore if the user hasn't changed selection during generation
      const currentFigure = useDomainStore.getState().figures.selectedId;
      const userChangedSelection = currentFigure !== null && currentFigure !== originalSelectedFigure;
      if (!userChangedSelection) {
        if (originalSelectedFigure) {
          preferencesAdapter.setSelectedFigureId(originalSelectedFigure);
          if (originalSeedData) {
            preferencesAdapter.setSelectedSeed(originalSelectedFigure, originalSeedData);
          }
          councilLog('🚀 PERFORMANCE: Restored seed data after council run');
        } else {
          preferencesAdapter.setSelectedFigureId(null);
        }
      } else {
        councilLog('🚀 PERFORMANCE: User changed selection during council — skipping restore');
      }
    }
  }

  /**
   * Step 5: Parse and validate the response
   */
  private async parseResponse(rawResponse: string, councilData: CouncilData): Promise<Segment[]> {
    this.log('🔍 Parsing response');

    // Fake speaker names that LLMs output when prompt concepts leak
    const FAKE_SPEAKERS = ['LANDING LINE', 'MID COUNCIL RESTATEMENT', 'STAGE DIRECTION', 'NARRATOR', 'NOTE', 'IMAGE'];

    const segments: Segment[] = [];
    const lines = rawResponse.split('\n');
    const speakerPattern = /^([A-Z][A-Z\s.]+?) :: (.*)$/;

    let currentSegment: Segment | null = null;
    let parseErrors = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and headers
      if (!line || line.startsWith('#')) continue;

      // Try to match speaker pattern
      const match = line.match(speakerPattern);

      if (match) {
        const [, speaker, text] = match;
        const speakerNorm = speaker.trim().toUpperCase();

        // Skip fake speakers
        if (FAKE_SPEAKERS.includes(speakerNorm)) {
          this.log(`⚠️ Skipping fake speaker: "${speakerNorm}"`);
          continue;
        }

        // Validate speaker — try exact match first, then registry fuzzy match
        const speakerFound = councilData.expectedSpeakers.includes(speakerNorm);
        const resolvedId = speakerFound
          ? this.getSpeakerId(speakerNorm, councilData)
          : this.getSpeakerId(speakerNorm, councilData);
        const { isValidSpeakerId } = await import('./speakerRegistry');
        const isValid = speakerFound || (resolvedId && isValidSpeakerId(resolvedId));

        if (isValid) {
          // Save previous segment
          if (currentSegment && currentSegment.content.trim()) {
            segments.push(currentSegment);
          }

          const segmentId = segments.length;
          currentSegment = {
            id: segmentId,
            speaker: speakerNorm,
            speakerId: resolvedId || undefined,
            content: this.sanitizeForTTS(text.trim()),
            type: text.trim().startsWith(',') ? 'interruption' : 'dialogue'
          };
          if (!speakerFound) {
            this.log(`🔄 Fuzzy matched "${speakerNorm}" → "${resolvedId}" (segment ID: ${segmentId})`);
          } else {
            this.log(`✅ Found speaker: ${speakerNorm} (segment ID: ${segmentId})`);
          }
        } else {
          this.log(`⚠️ Unknown speaker: "${speakerNorm}". Expected: ${councilData.expectedSpeakers.join(', ')}`);
          parseErrors++;
        }
      } else if (currentSegment) {
        // Continue current segment — sanitize appended text
        currentSegment.content += '\n' + this.sanitizeForTTS(line);
      } else {
        // Line without speaker
        this.log(`❌ Line without speaker format: "${line.substring(0, 100)}..."`);
        parseErrors++;
      }
    }

    // Add final segment
    if (currentSegment && currentSegment.content.trim()) {
      segments.push(currentSegment);
    }

    this.log('📊 Parsing complete', {
      totalSegments: segments.length,
      parseErrors,
      speakers: [...new Set(segments.map(s => s.speaker))]
    });

    // Validate we have enough content
    if (segments.length < 10) {
      throw new Error(`Too few segments generated: ${segments.length}`);
    }

    return segments;
  }

  /**
   * Sanitize dialogue text for TTS playback
   */
  private sanitizeForTTS(text: string): string {
    return cleanCouncilTextForTts(text);
  }

  /**
   * Utility: Format voice profile for prompt
   *
   * Mirrors the batch generator's shape so custom councils and curated
   * councils draw from the same biographical diversity source. See
   * scripts/council-prompt-optimizer/COUNCIL-REPETITION-HANDOVER.md.
   */
  private formatVoiceProfile(profile: VoiceProfile): string {
    const truncate = (str: string | undefined, maxChars: number): string => {
      if (!str) return '';
      const s = String(str).replace(/\s+/g, ' ').trim();
      if (s.length <= maxChars) return s;
      const cut = s.slice(0, maxChars).replace(/\s+\S*$/, '');
      return `${cut}...`;
    };

    const lines: string[] = [];
    lines.push(`### ${profile.displayName || profile.name}`);
    lines.push(`**Essence**: ${profile.essence ?? ''}`);
    lines.push(`**Philosophy**: ${profile.philosophy?.core || 'Philosophical thinker'}`);
    lines.push(`**Voice**: ${profile.voice?.tone || 'Thoughtful and engaged'}`);

    if (profile.voice?.sensoryWorld && profile.voice.sensoryWorld.length > 0) {
      lines.push(`**Sensory world**: ${profile.voice.sensoryWorld.slice(0, 3).join(' | ')}`);
    }

    const scenes = profile.voice?.biographicalScenes;
    if (scenes && scenes.length > 0) {
      lines.push(
        `**Biographical scenes** (CHOOSE A DIFFERENT ONE for each council; do NOT default to any single period):`,
      );
      scenes.forEach((s, i) => {
        const header = s.period || s.setting || `scene ${i + 1}`;
        const body = truncate(s.scene || s.sensory || '', 220);
        const teaches = s.teaches ? ` (teaches: ${s.teaches})` : '';
        lines.push(`  ${i + 1}. [${header}]${teaches} ${body}`);
      });
    }

    if (profile.metadata?.keyLifeEvents?.length) {
      lines.push(
        `**Key life events**: ${profile.metadata.keyLifeEvents
          .slice(0, 8)
          .map((e) => truncate(e, 160))
          .join(' | ')}`,
      );
    }
    if (profile.metadata?.keyRelationships?.length) {
      lines.push(
        `**Key relationships**: ${profile.metadata.keyRelationships
          .slice(0, 6)
          .map((r) => truncate(r, 140))
          .join(' | ')}`,
      );
    }

    if (profile.voice?.avoidances?.length) {
      lines.push(`**Avoidances**: ${profile.voice.avoidances.slice(0, 3).join(' | ')}`);
    }
    lines.push(
      `**Signature phrases**: ${(profile.signaturePhrases || []).slice(0, 3).join('; ')}`,
    );
    lines.push(
      `**Interaction style**: ${profile.interaction?.debateStyle || 'Engages thoughtfully with others'}`,
    );

    return lines.join('\n');
  }

  /**
   * Utility: Get participant name from ID
   * Uses unified speaker registry for consistent mapping
   */
  private getParticipantName(id: string): string {
    return getFullName(id);
  }

  /**
   * Utility: Get speaker ID from name
   */
  private getSpeakerId(speakerName: string, councilData: CouncilData): string | undefined {
    // Search through voice profiles
    for (const [id, profile] of Object.entries(councilData.voiceProfiles)) {
      if (profile.displayName === speakerName || 
          profile.name?.toUpperCase() === speakerName) {
        return id;
      }
    }
    
    // Fallback
    return speakerName.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Utility: Logging with debug mode
   */
  private log(message: string, data: any = null): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };

    this.generationLog.push(logEntry);

    if (this.debugMode) {
      councilLog(`[CustomCouncil] ${message}`, data || '');
    }
  }
}

export default new CustomCouncilGenerator();
