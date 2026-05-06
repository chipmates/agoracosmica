/**
 * Structured compliance event logging.
 *
 * Replaces console.warn for safety events with KV-backed structured logs.
 * Events are stored in the COMPLIANCE_LOG KV namespace with 90-day TTL.
 * IP addresses are always hashed (DSGVO Datenminimierung).
 */

import type { Env } from './types';

export interface ComplianceEvent {
  timestamp: string;
  type: 'input_blocked' | 'output_blocked' | 'jailbreak_attempt' | 'report_submitted';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  category: string;
  figureId?: string;
  mode?: string;
  language?: string;
  ipHash: string;
}

const SEVERITY_MAP: Record<string, 'P1' | 'P2' | 'P3' | 'P4'> = {
  'volksverhetzung': 'P2',
  'holocaust-denial': 'P2',
  'csam': 'P2',
  'csam-de': 'P2',
  'hate-speech': 'P2',
  'terrorism': 'P2',
  'self-harm': 'P3',
  'self-harm-de': 'P3',
  'self-harm-es': 'P3',
  'self-harm-fr': 'P3',
  'methods': 'P3',
  'methods-de': 'P3',
  'jailbreak': 'P3',
  'violence-instruction': 'P3',
  'harm-others': 'P3',
  'harm-others-de': 'P3',
  'illegal-synthesis': 'P4',
};

export function getSeverity(type: string, category: string): 'P1' | 'P2' | 'P3' | 'P4' {
  if (type === 'output_blocked') return 'P1';
  return SEVERITY_MAP[category] || 'P4';
}

async function hashIP(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`compliance:${ip}:${salt}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Log a compliance event to KV. Never throws — logging must not break requests.
 */
export async function logComplianceEvent(
  request: Request,
  env: Env,
  event: Omit<ComplianceEvent, 'timestamp' | 'ipHash'>
): Promise<void> {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hashIP(ip, env.JWT_SIGNING_KEY);
    const timestamp = new Date().toISOString();

    const fullEvent: ComplianceEvent = {
      ...event,
      timestamp,
      ipHash,
    };

    // Also log to console for real-time monitoring
    console.warn(`[Compliance] ${fullEvent.severity} ${fullEvent.type}: ${fullEvent.category}`);

    // Store in KV
    const key = `${timestamp}:${fullEvent.type}:${crypto.randomUUID().slice(0, 8)}`;
    await env.COMPLIANCE_LOG.put(key, JSON.stringify(fullEvent), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days
    });
  } catch (err) {
    // Logging must never break the request flow
    console.error('[Compliance] Failed to log event:', err);
  }
}
