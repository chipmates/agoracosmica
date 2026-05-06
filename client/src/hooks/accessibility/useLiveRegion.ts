// src/hooks/accessibility/useLiveRegion.ts
import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================
// Type Definitions
// ============================================

type Priority = 'polite' | 'assertive';
type StatusType = 'error' | 'warning' | 'success' | 'info';
type AudioAction = 'started' | 'paused' | 'stopped' | 'ended';

interface AnnounceOptions {
  debounce?: number;
  dedupe?: boolean;
  clearAfter?: number;
  prefix?: string;
  suffix?: string;
}

interface UseLiveRegionResult {
  // Basic announcement
  announce: (message: string, priority?: Priority, options?: AnnounceOptions) => void;
  clearAnnouncement: () => void;
  
  // Current state
  currentAnnouncement: string;
  priority: Priority;
  
  // Specific announcement methods
  announceFigureChange: (figureName: string) => void;
  announceNewMessage: (figureName: string, messagePreview?: string) => void;
  announceStatus: (status: string, type?: StatusType) => void;
  announceLoading: (isLoading: boolean, context?: string) => void;
  announceModeChange: (newMode: string) => void;
  announceAudio: (action: AudioAction, title?: string) => void;
  announceNavigation: (destination: string) => void;
  
  // Statistics
  announcementCount: number;
}

/**
 * Live Region Hook - 2025 State-of-the-Art Accessibility
 * 
 * Provides screen reader announcements for dynamic content changes.
 * Follows ARIA live region best practices with debouncing and cleanup.
 * 
 * @returns {UseLiveRegionResult} Live region state and methods
 */
const useLiveRegion = (): UseLiveRegionResult => {
  const [announcement, setAnnouncement] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('polite');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncementRef = useRef<string>('');
  const announcementCountRef = useRef<number>(0);

  /**
   * Announce a message to screen readers
   * @param {string} message - The message to announce
   * @param {Priority} announcementPriority - 'polite' or 'assertive'
   * @param {AnnounceOptions} options - Additional options
   */
  const announce = useCallback((
    message: string, 
    announcementPriority: Priority = 'polite',
    options: AnnounceOptions = {}
  ): void => {
    const {
      debounce = 100,
      dedupe = true,
      clearAfter = 1000,
      prefix = '',
      suffix = ''
    } = options;

    // Skip empty messages
    if (!message || typeof message !== 'string') return;

    // Skip duplicate messages if dedupe is enabled
    if (dedupe && message === lastAnnouncementRef.current) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce announcements
    timeoutRef.current = setTimeout(() => {
      const fullMessage = `${prefix}${message}${suffix}`.trim();
      
      // Update priority
      setPriority(announcementPriority);
      
      // Set announcement
      setAnnouncement(fullMessage);
      
      // Track for deduplication
      lastAnnouncementRef.current = message;
      announcementCountRef.current += 1;
      
      // Clear announcement after delay
      if (clearAfter > 0) {
        setTimeout(() => {
          setAnnouncement('');
        }, clearAfter);
      }
    }, debounce);
  }, []);

  /**
   * Clear current announcement
   */
  const clearAnnouncement = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnnouncement('');
    lastAnnouncementRef.current = '';
  }, []);

  /**
   * Announce figure change
   * @param {string} figureName - Name of the new figure
   */
  const announceFigureChange = useCallback((figureName: string): void => {
    announce(`Now speaking with ${figureName}`, 'polite', {
      debounce: 200,
      prefix: 'Figure changed: '
    });
  }, [announce]);

  /**
   * Announce new message
   * @param {string} figureName - Name of the figure
   * @param {string} messagePreview - Preview of the message (optional)
   */
  const announceNewMessage = useCallback((figureName: string, messagePreview: string = ''): void => {
    const message = messagePreview 
      ? `New message from ${figureName}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}`
      : `New message from ${figureName}`;
    
    announce(message, 'polite', {
      debounce: 300,
      clearAfter: 2000
    });
  }, [announce]);

  /**
   * Announce system status
   * @param {string} status - Status message
   * @param {StatusType} type - Type of status (success, error, warning, info)
   */
  const announceStatus = useCallback((status: string, type: StatusType = 'info'): void => {
    const priorityMap: Record<StatusType, Priority> = {
      error: 'assertive',
      warning: 'assertive',
      success: 'polite',
      info: 'polite'
    };

    const prefixMap: Record<StatusType, string> = {
      error: 'Error: ',
      warning: 'Warning: ',
      success: 'Success: ',
      info: ''
    };

    announce(status, priorityMap[type], {
      prefix: prefixMap[type],
      debounce: 150,
      clearAfter: type === 'error' ? 3000 : 1500
    });
  }, [announce]);

  /**
   * Announce loading state
   * @param {boolean} isLoading - Whether content is loading
   * @param {string} context - Context of what's loading
   */
  const announceLoading = useCallback((isLoading: boolean, context: string = ''): void => {
    if (isLoading) {
      announce(`Loading${context ? ` ${context}` : ''}`, 'polite', {
        debounce: 500,
        clearAfter: 0 // Don't clear until loading finishes
      });
    } else {
      announce(`${context || 'Content'} loaded`, 'polite', {
        debounce: 100,
        clearAfter: 1000
      });
    }
  }, [announce]);

  /**
   * Announce mode change
   * @param {string} newMode - New mode name
   */
  const announceModeChange = useCallback((newMode: string): void => {
    announce(`Mode changed to ${newMode}`, 'polite', {
      debounce: 200,
      prefix: 'Navigation: '
    });
  }, [announce]);

  /**
   * Announce audio playback
   * @param {AudioAction} action - 'started', 'paused', 'stopped'
   * @param {string} title - Optional title of what's playing
   */
  const announceAudio = useCallback((action: AudioAction, title: string = ''): void => {
    const actionMap: Record<AudioAction, string> = {
      started: 'Playing',
      paused: 'Paused',
      stopped: 'Stopped',
      ended: 'Finished playing'
    };

    const message = title 
      ? `${actionMap[action]} ${title}`
      : `Audio ${action}`;

    announce(message, 'polite', {
      debounce: 100,
      clearAfter: 1500
    });
  }, [announce]);

  /**
   * Announce navigation change
   * @param {string} destination - Where the user navigated
   */
  const announceNavigation = useCallback((destination: string): void => {
    announce(`Navigated to ${destination}`, 'polite', {
      debounce: 200,
      prefix: 'Page: '
    });
  }, [announce]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // Basic announcement
    announce,
    clearAnnouncement,
    
    // Current state
    currentAnnouncement: announcement,
    priority,
    
    // Specific announcement methods
    announceFigureChange,
    announceNewMessage,
    announceStatus,
    announceLoading,
    announceModeChange,
    announceAudio,
    announceNavigation,
    
    // Statistics
    announcementCount: announcementCountRef.current
  };
};

export default useLiveRegion;