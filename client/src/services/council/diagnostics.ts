/**
 * Diagnostic tool for tracking Cosmic Council streaming performance
 * Run this to measure time-to-first-content and identify bottlenecks
 */

import { councilLog, councilWarn } from './logger';

interface ChunkMetric {
  time: number;
  size: number;
}

interface GapMetric {
  time: number;
  gap: number;
}

interface Metrics {
  requestStart: number | null;
  firstChunk: number | null;
  firstPartial: number | null;
  firstSegment: number | null;
  firstAudio: number | null;
  chunks: ChunkMetric[];
  gaps: GapMetric[];
}

interface DiagnosticsReport {
  summary: {
    timeToFirstChunk: number | 'N/A';
    timeToFirstPartial: number | 'N/A';
    timeToFirstSegment: number | 'N/A';
    timeToFirstAudio: number | 'N/A';
    totalChunks: number;
    largestGap: number;
    gapCount: number;
  };
  timeline: Metrics;
  verdict: string;
}

export class CouncilDiagnostics {
  private metrics: Metrics;

  constructor() {
    this.metrics = {
      requestStart: null,
      firstChunk: null,
      firstPartial: null,
      firstSegment: null,
      firstAudio: null,
      chunks: [],
      gaps: []
    };
  }

  reset(): void {
    this.metrics = {
      requestStart: null,
      firstChunk: null,
      firstPartial: null,
      firstSegment: null,
      firstAudio: null,
      chunks: [],
      gaps: []
    };
  }

  start(): void {
    this.reset();
    this.metrics.requestStart = Date.now();
    councilLog('🏁 DIAGNOSTICS: Council request started');
  }

  recordChunk(chunkSize: number): void {
    const now = Date.now();
    const elapsed = now - this.metrics.requestStart!;
    
    if (!this.metrics.firstChunk) {
      this.metrics.firstChunk = elapsed;
      councilLog(`🎯 DIAGNOSTICS: First chunk at ${elapsed}ms`);
    }
    
    const lastChunk = this.metrics.chunks[this.metrics.chunks.length - 1];
    if (lastChunk) {
      const gap = elapsed - lastChunk.time;
      if (gap > 1000) {
        this.metrics.gaps.push({ time: elapsed, gap });
        councilWarn(`⚠️ DIAGNOSTICS: ${gap}ms gap detected at ${elapsed}ms`);
      }
    }
    
    this.metrics.chunks.push({ time: elapsed, size: chunkSize });
  }

  recordFirstPartial(): void {
    if (!this.metrics.firstPartial) {
      this.metrics.firstPartial = Date.now() - this.metrics.requestStart!;
      councilLog(`🚀 DIAGNOSTICS: First partial content at ${this.metrics.firstPartial}ms`);
    }
  }

  recordFirstSegment(): void {
    if (!this.metrics.firstSegment) {
      this.metrics.firstSegment = Date.now() - this.metrics.requestStart!;
      councilLog(`📝 DIAGNOSTICS: First complete segment at ${this.metrics.firstSegment}ms`);
    }
  }

  recordFirstAudio(): void {
    if (!this.metrics.firstAudio) {
      this.metrics.firstAudio = Date.now() - this.metrics.requestStart!;
      councilLog(`🔊 DIAGNOSTICS: First audio playback at ${this.metrics.firstAudio}ms`);
    }
  }

  generateReport(): DiagnosticsReport {
    const report: DiagnosticsReport = {
      summary: {
        timeToFirstChunk: this.metrics.firstChunk || 'N/A',
        timeToFirstPartial: this.metrics.firstPartial || 'N/A', 
        timeToFirstSegment: this.metrics.firstSegment || 'N/A',
        timeToFirstAudio: this.metrics.firstAudio || 'N/A',
        totalChunks: this.metrics.chunks.length,
        largestGap: Math.max(...this.metrics.gaps.map(g => g.gap), 0),
        gapCount: this.metrics.gaps.length
      },
      timeline: this.metrics,
      verdict: this._getVerdict()
    };
    
    councilLog('📊 DIAGNOSTICS REPORT:', report);
    return report;
  }

  private _getVerdict(): string {
    const firstContent = this.metrics.firstPartial || this.metrics.firstSegment;
    
    if (!firstContent) {
      return '❌ No content received';
    } else if (firstContent < 5000) {
      return '✅ EXCELLENT - Content within 5 seconds';
    } else if (firstContent < 10000) {
      return '⚠️ ACCEPTABLE - Content within 10 seconds';
    } else {
      return `❌ POOR - ${Math.round(firstContent / 1000)}s delay (target: <5s)`;
    }
  }
}

// Global diagnostics instance
export const councilDiagnostics = new CouncilDiagnostics();