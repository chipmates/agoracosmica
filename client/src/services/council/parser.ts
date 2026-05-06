// src/services/council/parser.ts
//
// Enhanced parser with bulletproof speaker name handling:
// - Handles diacritical marks (DŌGEN → DOGEN) 
// - Robust speaker validation and ID mapping
// - Prevents "Unknown speaker" errors from character encoding issues

import { getSpeakerId, isValidSpeakerId } from './speakerRegistry';
import { councilLog, councilWarn } from './logger';
import { cleanCouncilTextForTts as sanitizeForTTS } from '../../utils/ttsTextCleaner';

// Speaker names that are NOT real figures — LLMs sometimes output these
// when prompt concepts leak into the dialogue (e.g. "landing line" instruction)
const FAKE_SPEAKERS = ['LANDING LINE', 'MID COUNCIL RESTATEMENT', 'STAGE DIRECTION', 'NARRATOR', 'NOTE', 'IMAGE'];

// Type definitions
export interface Participant {
  name?: string;
  displayName?: string;
  id?: string;
  [key: string]: any;
}

export interface ParserConfig {
  participants?: (Participant | string)[];
  mode?: 'debate' | 'advisory';
  onSegment?: ((segment: Segment) => void) | null;
  onMetrics?: ((metrics: any) => void) | null;
  [key: string]: any;
}

export interface Segment {
  id?: number;
  speaker: string;
  speakerId?: string;
  content: string;
  type: 'dialogue' | 'interruption' | 'emotion';
  timestamp?: number;
  metadata?: {
    emotionalCues?: string[];
    emphasis?: string[];
    [key: string]: any;
  };
}

interface ParserState {
  buffer: string;
  currentSegment: Segment | null;
  segments: Segment[];
  segmentCount: number;
  lastEmittedLength: number;
  metadata: {
    interruptions: number;
    speakerChanges: number;
    emotionalCues: number;
    wordCount: number;
    startTime: number;
  };
}

interface ParserPatterns {
  speaker: RegExp;
  interruption: RegExp;
  emotionalCue: RegExp;
  emphasis: RegExp;
}

interface QualityTracking {
  voiceDistinctiveness: Map<string, number>;
  philosophicalDepth: any[];
  modernReferences: any[];
  emotionalMoments: any[];
  interactionQuality: any[];
}

interface ProcessResults {
  newSegments: Segment[];
  metrics: any | null;
  partialUpdate: Partial<Segment> | null;
}

/**
 * Normalize speaker names by removing diacritical marks and converting to uppercase
 */
function normalizeSpeakerName(speakerName: string): string {
  if (!speakerName) return '';
  return speakerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toUpperCase()
    .trim();
}

/**
 * Enhanced parser for custom council streaming responses
 * Handles real-time segment extraction with quality tracking
 */
export { normalizeSpeakerName, sanitizeForTTS };

export class CustomCouncilParser {
  private config: ParserConfig & { speakers: string[] };
  private state: ParserState;
  private patterns: ParserPatterns;
  private quality: QualityTracking;

  constructor(config: ParserConfig = {}) {
    this.config = {
      speakers: config.participants?.map(p => 
        normalizeSpeakerName(
          typeof p === 'string' ? p : (p.name || p.displayName || '')
        )
      ) || [],
      mode: config.mode || 'debate',
      onSegment: config.onSegment || null,
      onMetrics: config.onMetrics || null,
      ...config
    };
    
    councilLog('📋 Parser initialized with speakers:', this.config.speakers);
    
    // Parser state
    this.state = {
      buffer: '',
      currentSegment: null,
      segments: [],
      segmentCount: 0,
      lastEmittedLength: 0,
      metadata: {
        interruptions: 0,
        speakerChanges: 0,
        emotionalCues: 0,
        wordCount: 0,
        startTime: Date.now()
      }
    };
    
    // Patterns for parsing
    this.patterns = {
      // Permissive speaker-line regex: any non-colon prefix up to 60 chars
      // followed by " :: ". This handles any Unicode uppercase character
      // (Ō, Ä, Ç, …) without enumerating character classes.
      //
      // 2026-04-14 fix: the previous regex `[A-Z][A-Z\s.]` did NOT match
      // DŌGEN ZENJI (Japanese long-O, U+014C), umlauts, apostrophes, or
      // hyphens. This was the same class of bug that merged Dōgen's
      // dialogue into the preceding speaker's segment across the entire
      // council-generator and prism-generator corpuses. Fix here is latent
      // protection: the custom-council path hasn't shipped yet, so no
      // production damage, but the bug would surface immediately on first
      // custom council containing a figure name with any non-ASCII cap.
      speaker: /^([^:\n]{1,60}?)\s*::\s*(.*)$/,
      interruption: /^—(.+)/,
      emotionalCue: /\[(pauses?|sighs?|laughs?|leans? forward|eyes? brighten(?:ing)?|voice softens?|smiles?|nods?)\]/gi,
      emphasis: /\*([^*]+)\*/g
    };
    
    // Quality tracking
    this.quality = {
      voiceDistinctiveness: new Map(),
      philosophicalDepth: [],
      modernReferences: [],
      emotionalMoments: [],
      interactionQuality: []
    };
  }
  
  /**
   * Process a chunk of streaming text
   */
  processChunk(chunk: string): ProcessResults {
    this.state.buffer += chunk;
    const results: ProcessResults = {
      newSegments: [],
      metrics: null,
      partialUpdate: null
    };
    
    // Process complete lines
    const lines = this.state.buffer.split('\n');
    
    // Keep incomplete line in buffer
    if (!chunk.endsWith('\n')) {
      this.state.buffer = lines.pop() || '';
    } else {
      this.state.buffer = '';
    }
    
    // Process each complete line
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const segment = this._parseLine(line);
      if (segment) {
        // Handle segment completion
        if (this.state.currentSegment && 
            this.state.currentSegment.speaker !== segment.speaker) {
          // Complete current segment
          this._finalizeSegment(this.state.currentSegment);
          results.newSegments.push(this.state.currentSegment);
          this.state.metadata.speakerChanges++;
        }
        
        this.state.currentSegment = segment;
        
        // Check for partial update opportunity
        if (segment.content.length > 50 && 
            segment.content.length > this.state.lastEmittedLength + 100) {
          results.partialUpdate = {
            speaker: segment.speaker,
            content: segment.content.substring(0, segment.content.length - 20),
            type: segment.type
          };
          this.state.lastEmittedLength = segment.content.length;
        }
      } else if (this.state.currentSegment) {
        // Continue current segment — sanitize appended text
        this.state.currentSegment.content += ' ' + sanitizeForTTS(line.trim());
      }
    }
    
    // Update metrics
    results.metrics = this._generateMetrics();
    
    return results;
  }
  
  /**
   * Parse a single line of text
   */
  private _parseLine(line: string): Segment | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Check for speaker pattern
    const speakerMatch = trimmed.match(this.patterns.speaker);
    if (speakerMatch) {
      const speakerName = normalizeSpeakerName(speakerMatch[1]);
      const content = speakerMatch[2];

      // Skip fake speakers (prompt concepts that leaked into output)
      if (FAKE_SPEAKERS.includes(speakerName)) {
        councilWarn(`Skipping fake speaker: ${speakerName}`);
        return null;
      }

      // Validate speaker — use registry fuzzy matching
      const speakerId = this._validateSpeaker(speakerName);
      if (!speakerId) {
        councilWarn(`Unknown speaker: ${speakerName} — skipping line`);
        return null;
      }

      return {
        id: this.state.segmentCount++,
        speaker: speakerName,
        speakerId: speakerId,
        content: sanitizeForTTS(content),
        type: 'dialogue',
        timestamp: Date.now(),
        metadata: this._extractMetadata(content)
      };
    }

    // Check for interruption
    const interruptionMatch = trimmed.match(this.patterns.interruption);
    if (interruptionMatch) {
      this.state.metadata.interruptions++;
      return {
        id: this.state.segmentCount++,
        speaker: this.state.currentSegment?.speaker || 'UNKNOWN',
        content: sanitizeForTTS(interruptionMatch[1]),
        type: 'interruption',
        timestamp: Date.now()
      };
    }

    return null;
  }
  
  /**
   * Validate and get speaker ID
   */
  private _validateSpeaker(speakerName: string): string | null {
    const normalized = normalizeSpeakerName(speakerName);

    // Check if speaker is in expected list (exact match)
    const isExactMatch = this.config.speakers.some(s =>
      normalizeSpeakerName(s) === normalized
    );

    if (isExactMatch) {
      return getSpeakerId(speakerName);
    }

    // Use the registry's fuzzy matching (handles typos, name variations, surname matching)
    const resolvedId = getSpeakerId(speakerName);
    if (resolvedId && isValidSpeakerId(resolvedId)) {
      councilLog(`🔄 Fuzzy matched "${speakerName}" → "${resolvedId}"`);
      return resolvedId;
    }

    return null;
  }
  
  /**
   * Extract metadata from content
   */
  private _extractMetadata(content: string): { emotionalCues: string[]; emphasis: string[] } {
    const metadata: { emotionalCues: string[]; emphasis: string[] } = {
      emotionalCues: [],
      emphasis: []
    };
    
    // Extract emotional cues
    let match;
    while ((match = this.patterns.emotionalCue.exec(content)) !== null) {
      metadata.emotionalCues.push(match[1]);
      this.state.metadata.emotionalCues++;
    }
    
    // Extract emphasis
    while ((match = this.patterns.emphasis.exec(content)) !== null) {
      metadata.emphasis.push(match[1]);
    }
    
    return metadata;
  }
  
  /**
   * Finalize a segment before storing
   */
  private _finalizeSegment(segment: Segment): void {
    // Clean up content
    segment.content = segment.content.trim();
    
    // Update word count
    const words = segment.content.split(/\s+/).length;
    this.state.metadata.wordCount += words;
    
    // Track quality metrics
    this._trackQuality(segment);
    
    // Store segment (count already incremented during ID assignment)
    this.state.segments.push(segment);
    
    // Trigger callback if configured
    if (this.config.onSegment) {
      this.config.onSegment(segment);
    }
  }
  
  /**
   * Track quality metrics for analysis
   */
  private _trackQuality(segment: Segment): void {
    // Track voice distinctiveness
    const currentCount = this.quality.voiceDistinctiveness.get(segment.speaker) || 0;
    this.quality.voiceDistinctiveness.set(segment.speaker, currentCount + 1);
    
    // Check for philosophical depth
    const philosophicalTerms = [
      'consciousness', 'existence', 'being', 'truth', 'reality',
      'wisdom', 'virtue', 'meaning', 'purpose', 'essence'
    ];
    
    const hasPhilosophical = philosophicalTerms.some(term => 
      segment.content.toLowerCase().includes(term)
    );
    
    if (hasPhilosophical) {
      this.quality.philosophicalDepth.push({
        speaker: segment.speaker,
        content: segment.content.substring(0, 100)
      });
    }
    
    // Track emotional moments
    if (segment.metadata?.emotionalCues && segment.metadata.emotionalCues.length > 0) {
      this.quality.emotionalMoments.push({
        speaker: segment.speaker,
        cues: segment.metadata.emotionalCues,
        timestamp: segment.timestamp
      });
    }
  }
  
  /**
   * Generate metrics for current parsing state
   */
  private _generateMetrics(): any {
    const duration = Date.now() - this.state.metadata.startTime;
    const avgWordsPerSegment = this.state.segmentCount > 0 
      ? Math.round(this.state.metadata.wordCount / this.state.segmentCount)
      : 0;
    
    return {
      duration,
      segments: this.state.segmentCount,
      words: this.state.metadata.wordCount,
      avgWordsPerSegment,
      speakerChanges: this.state.metadata.speakerChanges,
      interruptions: this.state.metadata.interruptions,
      emotionalCues: this.state.metadata.emotionalCues,
      speakers: Array.from(this.quality.voiceDistinctiveness.keys()),
      quality: {
        voiceDistribution: Object.fromEntries(this.quality.voiceDistinctiveness),
        philosophicalDepth: this.quality.philosophicalDepth.length,
        emotionalMoments: this.quality.emotionalMoments.length
      }
    };
  }
  
  /**
   * Complete parsing and return final results
   */
  complete(): { segments: Segment[]; metrics: any } {
    // Finalize any remaining segment
    if (this.state.currentSegment) {
      this._finalizeSegment(this.state.currentSegment);
    }
    
    // Generate final metrics
    const metrics = this._generateMetrics();
    
    // Trigger metrics callback
    if (this.config.onMetrics) {
      this.config.onMetrics(metrics);
    }
    
    return {
      segments: this.state.segments,
      metrics
    };
  }
  
  /**
   * Reset parser state for new session
   */
  reset(): void {
    this.state = {
      buffer: '',
      currentSegment: null,
      segments: [],
      segmentCount: 0,
      lastEmittedLength: 0,
      metadata: {
        interruptions: 0,
        speakerChanges: 0,
        emotionalCues: 0,
        wordCount: 0,
        startTime: Date.now()
      }
    };
    
    this.quality = {
      voiceDistinctiveness: new Map(),
      philosophicalDepth: [],
      modernReferences: [],
      emotionalMoments: [],
      interactionQuality: []
    };
  }
  
  /**
   * Get current parsing state
   */
  getState(): { segments: Segment[]; metrics: any; buffer: string } {
    return {
      segments: this.state.segments,
      metrics: this._generateMetrics(),
      buffer: this.state.buffer
    };
  }
}

export default CustomCouncilParser;