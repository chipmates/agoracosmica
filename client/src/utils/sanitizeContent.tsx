/**
 * @fileoverview Content sanitization utility for XSS protection
 * @author Claude & ChipMates Team
 * @since 2025-07-15
 * 
 * Simple JavaScript implementation for immediate security fix
 * Will be refactored to TypeScript in Week 2 as per roadmap
 */

import { FC, ReactNode } from 'react';
import DOMPurify from 'dompurify';

interface SanitizationWarning {
  original: string;
  sanitized: string;
  profile: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

interface SanitizationLog {
  seenHashes: Set<string>;
  groupedWarnings: Map<string, SanitizationWarning>;
  lastFlush: number;
  flushInterval: number;
}

interface SecurityProfile {
  allowedTags: string[];
  allowedAttributes: string[];
  allowDataUrls: boolean;
}

interface SecurityProfiles {
  PHILOSOPHICAL_CHAT: SecurityProfile;
  HISTORY_ENTRY: SecurityProfile;
  SVG_SYMBOL: SecurityProfile;
  STRICT: SecurityProfile;
}

interface SanitizedContentProps {
  content: string;
  profile?: keyof SecurityProfiles;
  className?: string;
  fallback?: ReactNode;
}

// Smart logging system to prevent console spam
const SANITIZATION_LOG: SanitizationLog = {
  seenHashes: new Set(),
  groupedWarnings: new Map(),
  lastFlush: Date.now(),
  flushInterval: 5000 // Flush grouped warnings every 5 seconds
};

/**
 * Create a simple hash for content to group similar sanitizations
 */
function createContentHash(content: string, profile: string): string {
  // Simple hash combining content length, first/last chars, and profile
  const firstChars = content.substring(0, 20);
  const lastChars = content.substring(Math.max(0, content.length - 20));
  return `${profile}:${content.length}:${firstChars}:${lastChars}`;
}

/**
 * Smart logging that groups similar warnings and prevents console spam
 */
function logSanitizationWarning(original: string, sanitized: string, profile: string): void {
  if (import.meta.env.MODE !== 'development') return;
  
  const hash = createContentHash(original, profile);
  
  // If we've seen this exact content before, increment counter
  if (SANITIZATION_LOG.groupedWarnings.has(hash)) {
    const warning = SANITIZATION_LOG.groupedWarnings.get(hash)!;
    warning.count++;
    warning.lastSeen = Date.now();
  } else {
    // New warning - add to group
    SANITIZATION_LOG.groupedWarnings.set(hash, {
      original: original.substring(0, 100),
      sanitized: sanitized.substring(0, 100),
      profile,
      count: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now()
    });
  }
  
  // Flush grouped warnings periodically
  const now = Date.now();
  if (now - SANITIZATION_LOG.lastFlush > SANITIZATION_LOG.flushInterval) {
    flushGroupedWarnings();
    SANITIZATION_LOG.lastFlush = now;
  }
}

/**
 * Flush accumulated warnings to console in a grouped format
 */
function flushGroupedWarnings(): void {
  if (SANITIZATION_LOG.groupedWarnings.size === 0) return;
  
  console.groupCollapsed(`🛡️ Content Sanitization Summary (${SANITIZATION_LOG.groupedWarnings.size} unique patterns)`);
  
  SANITIZATION_LOG.groupedWarnings.forEach((warning, _hash) => {
    if (warning.count === 1) {
      console.warn(`${warning.profile}: Content sanitized`, {
        original: warning.original,
        sanitized: warning.sanitized
      });
    } else {
      console.warn(`${warning.profile}: Content sanitized ${warning.count}x`, {
        original: warning.original,
        sanitized: warning.sanitized,
        occurrences: warning.count
      });
    }
  });
  
  console.groupEnd();
  
  // Clear the warnings after flushing
  SANITIZATION_LOG.groupedWarnings.clear();
}

/**
 * Security profiles for different content types
 */
const SECURITY_PROFILES: SecurityProfiles = {
  // Philosophical chat messages - basic formatting only
  PHILOSOPHICAL_CHAT: {
    allowedTags: ['em', 'strong', 'i', 'b', 'p', 'br', 'span'],
    allowedAttributes: ['class'],
    allowDataUrls: false
  },
  
  // History entries - even more restrictive
  HISTORY_ENTRY: {
    allowedTags: ['em', 'strong', 'i', 'b', 'br'],
    allowedAttributes: [],
    allowDataUrls: false
  },
  
  // SVG symbols - specific for visual elements
  SVG_SYMBOL: {
    allowedTags: ['svg', 'path', 'circle', 'rect', 'line', 'g', 'defs', 'use'],
    allowedAttributes: ['viewBox', 'width', 'height', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y'],
    allowDataUrls: false
  },
  
  // Strict mode - no HTML allowed
  STRICT: {
    allowedTags: [],
    allowedAttributes: [],
    allowDataUrls: false
  }
};

/**
 * Sanitize HTML content with DOMPurify
 * 
 * @param {string} content - Raw HTML content to sanitize
 * @param {string} profile - Security profile to use (default: 'PHILOSOPHICAL_CHAT')
 * @returns {string} - Sanitized HTML content
 */
export function sanitizeContent(content: string, profile: keyof SecurityProfiles = 'PHILOSOPHICAL_CHAT'): string {
  // Input validation
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Get security profile
  const config = SECURITY_PROFILES[profile] || SECURITY_PROFILES.PHILOSOPHICAL_CHAT;
  
  try {
    // Configure DOMPurify with profile settings
    const sanitizedContent = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: config.allowedTags,
      ALLOWED_ATTR: config.allowedAttributes,
      ALLOW_DATA_ATTR: config.allowDataUrls,
      FORBID_CONTENTS: ['script', 'style'],
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      KEEP_CONTENT: true
    });
    
    // Smart development warnings for unsafe content
    if (content !== sanitizedContent) {
      logSanitizationWarning(content, sanitizedContent, profile);
    }
    
    return sanitizedContent;
  } catch (error) {
    // Fallback: extract text via DOM to safely strip all HTML
    console.error('Content sanitization failed, using safe text extraction:', error);
    try {
      const doc = new DOMParser().parseFromString(content, 'text/html');
      return doc.body.textContent || '';
    } catch {
      // Last resort: entity-encode the entire string
      return content.replace(/[&<>"']/g, (c) => {
        const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[c] || c;
      });
    }
  }
}

/**
 * Check if content contains potentially dangerous elements
 * 
 * @param {string} content - Content to check
 * @returns {boolean} - True if content contains dangerous elements
 */
export function hasUnsafeContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Prevent ReDoS on extremely large inputs — anything over 100KB is suspicious
  if (content.length > 100_000) {
    return true;
  }

  const dangerousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Simple component for rendering sanitized content
 * 
 * @param {SanitizedContentProps} props - Component props
 * @returns {React.ReactElement | null} - Sanitized content element
 */
export const SanitizedContent: FC<SanitizedContentProps> = ({ 
  content, 
  profile = 'PHILOSOPHICAL_CHAT', 
  className, 
  fallback = null 
}) => {
  const sanitizedHtml = sanitizeContent(content, profile);
  
  if (!sanitizedHtml) {
    return <>{fallback}</>;
  }
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

// Auto-flush warnings on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushGroupedWarnings);
}

// Export security profiles and manual flush function for external use
export { SECURITY_PROFILES, flushGroupedWarnings as flushSanitizationWarnings };