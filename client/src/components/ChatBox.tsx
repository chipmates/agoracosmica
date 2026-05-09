// src/components/ChatBox.tsx
import React, { useEffect, useRef, useState, FC } from 'react';
import OptimizedImage from './OptimizedImage';
import OptimizedFigureImage from './OptimizedFigureImage';
import { sanitizeContent } from '../utils/sanitizeContent';
import { getDisplayShortName } from '../utils/figureDisplayName';
import { useTranslation } from '../hooks/useTranslation';
import VoiceInteractionHelper from './VoiceInteractionHelper';
import { Flag } from '@phosphor-icons/react';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';

interface UserProfile {
  name: string | null;
  avatar: string | null;
}
// SimpleBar removed - using native CSS scrollbar system from index.css
import './ChatBox.css';

interface Message {
  role: 'user' | 'assistant' | 'council';
  content: string;
  hidden?: boolean;
  speakerName?: string; // For council messages (display name with Echo prefix)
  speaker?: string; // For council messages (clean figure ID like 'jung')
}

interface ChatBoxProps {
  messages: Message[];
  selectedFigureName: string;
  isLoading?: boolean;
  firstTextArrived?: boolean;
  isReviewMode?: boolean;
  isAudioPlaying?: boolean;
}

const ChatBox: FC<ChatBoxProps> = ({
  messages,
  selectedFigureName,
  isLoading = false,
  firstTextArrived = false,
  isReviewMode = false,
  isAudioPlaying = false
}) => {
  const { t, tString, tNode } = useTranslation();
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [showVoiceHelper, setShowVoiceHelper] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Detect mobile for voice helper
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Helper function to get figure ID from figure name
  const getFigureId = (): string => {
    // Extract clean figure name and convert to lowercase
    const cleanName = selectedFigureName
      .replace(/^Echo of |^Echo von |^Echo de /i, '')
      .toLowerCase()
      .trim();
    
    // Map common names to IDs - comprehensive list
    const nameMap: { [key: string]: string } = {
      // Multi-part names
      'hildegard von bingen': 'bingen',
      'marcus aurelius': 'aurelius',
      'martin luther king jr.': 'king',
      'martin luther king': 'king',
      'leonardo da vinci': 'vinci',
      'harriet tubman': 'tubman',
      'simone de beauvoir': 'beauvoir',
      'william shakespeare': 'shakespeare',
      'virginia woolf': 'woolf',
      'emily dickinson': 'dickinson',
      'jane austen': 'austen',
      'arthur schopenhauer': 'schopenhauer',
      'william blake': 'blake',
      'joseph campbell': 'campbell',
      'maya angelou': 'angelou',
      'carl gustav jung': 'jung',
      'albert einstein': 'einstein',
      'meister eckhart': 'eckhart',
      'galileo galilei': 'galilei',
      'mahatma gandhi': 'gandhi',
      'johann wolfgang von goethe': 'goethe',
      'siddhartha gautama': 'gautama',
      'frida kahlo': 'kahlo',
      'ada lovelace': 'lovelace',
      'nelson mandela': 'mandela',
      'wolfgang amadeus mozart': 'mozart',
      'friedrich nietzsche': 'nietzsche',
      'dōgen zenji': 'zenji',
      'dogen zenji': 'zenji', // Without macron
      // Single names
      'hildegard': 'bingen',
      'plato': 'plato',
      'rumi': 'rumi',
      'laozi': 'laozi',
      'dōgen': 'zenji', // Correct: Dōgen is the name, Zenji is the title
      'dogen': 'zenji', // Without macron
      'zenji': 'zenji', // Keep for backward compatibility but Dōgen is preferred
      // German variations
      'platon': 'plato'
    };
    
    // Return mapped name or try to extract the last name
    if (nameMap[cleanName]) {
      return nameMap[cleanName];
    }
    
    // For unmapped names, return the last word as ID
    const words = cleanName.split(' ');
    return words[words.length - 1] || 'philosopher';
  };
  
  // Load user profile from IndexedDB on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await preferencesIndexedDbAdapter.getUserProfile();
        if (profile.name) {
          setUserProfile({ name: profile.name, avatar: profile.avatar });
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Show voice helper after first assistant message
  useEffect(() => {
    // Check if we have at least one assistant message
    const assistantMessages = messages.filter(m =>
      m.role === 'assistant' && !m.hidden
    );

    // Only set voice helper if not already shown to prevent infinite loop
    if (assistantMessages.length > 0 && !isReviewMode && !showVoiceHelper) {
      setShowVoiceHelper(true);
    }
  }, [messages, isReviewMode, showVoiceHelper]);

  // Enhanced message content rendering with XSS protection
  const renderMessageContent = (content: string): React.ReactNode => {
    if (!content) return null;
    
    // Check if content contains HTML that needs sanitization
    if (content.includes('<') && content.includes('>')) {
      // Use secure sanitization for HTML content
      const sanitizedHtml = sanitizeContent(content, 'PHILOSOPHICAL_CHAT');
      return <div className="message-content-inner" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
    }
    
    // Split text only on actual paragraph breaks (multiple newlines or proper punctuation + newline)
    // This ensures text split by commas stays in the same paragraph
    const paragraphs = content
      // Replace single newlines that follow commas with spaces to prevent unwanted breaks
      .replace(/,\n(?!\n)/g, ', ')
      // Split on double newlines or newlines after proper sentence ending punctuation
      .split(/\n\n|[.!?]\n/)
      .map(p => p.trim())
      .filter(Boolean);
    
    return paragraphs.map((para, idx) => (
      <p key={idx} className="message-paragraph">{para}</p>
    ));
  };
  
  // Filter out hidden messages from display and deduplicate
  const visibleMessages = messages.filter(message => !message.hidden);
  
  // Deduplicate only consecutive identical messages (e.g. streaming duplicates)
  // Non-consecutive repeats are legitimate (user may ask the same question twice)
  const deduplicatedMessages = visibleMessages.filter((current, index) => {
    if (index === 0) return true;
    const prev = visibleMessages[index - 1];
    return !(
      prev.role === current.role &&
      prev.content === current.content &&
      prev.speakerName === current.speakerName
    );
  });
  
  return (
    <div className="chatbox-container">
      {/* Top gradient fade for scrolled content */}
      <div className="chatbox-fade-top" />
      
      {/* Chat messages */}
      <div
        ref={chatBoxRef}
        className="chatbox"
        aria-label={tString('chat.conversationHistory', 'Conversation history')}
        role="log"
        aria-live="polite"
      >
        {/* Empty state - only show if no messages and not loading */}
        {deduplicatedMessages.length === 0 && !isLoading && (
          <div className="empty-chat-state">
            <p className="empty-chat-message">
              {tNode('chat.emptyState')}
            </p>
          </div>
        )}
        
        {/* Message list */}
        {deduplicatedMessages
          .filter(message => message.content && message.content.trim())
          .map((message, index) => (
            <div
              key={index}
              className={`message-wrapper ${message.role}`}
              role="article"
              aria-label={`${message.role === 'user' ? (userProfile?.name || tString('chat.seeker', 'Seeker')) : selectedFigureName}: ${message.content.substring(0, 100)}...`}
            >
              {message.role === 'assistant' && (
                <div className="avatar-container figure-avatar">
                  <OptimizedImage 
                    src={getFigureId()} 
                    type="ui"
                    purpose="thumbnail"
                    alt={selectedFigureName}
                    className="avatar-image"
                    loading="lazy"
                  />
                </div>
              )}
              {message.role === 'council' && (
                <div className="avatar-container council-avatar">
                  {(() => {
                    // Use the clean speaker ID directly (already clean like 'jung')
                    const speakerId = message.speaker || '';
                    
                    // Always show the figure image (like the header does)
                    return (
                      <OptimizedFigureImage
                        figure={speakerId}
                        type="thumbnail"
                        alt={message.speakerName || tString('chat.council', 'Council')}
                        className="avatar-image"
                        width={40}
                        height={40}
                      />
                    );
                  })()}
                </div>
              )}
              <div 
                className={`message ${message.role}`}
                style={message.role === 'assistant' && isReviewMode ? {
                  backgroundColor: 'var(--review-mode-bg)',
                  borderLeft: '3px solid var(--review-mode-accent)'
                } : message.role === 'council' ? {
                  backgroundColor: 'var(--primary-deep)',
                  borderLeft: '3px solid var(--primary-deep)'
                } : undefined}
              >
                <div className="message-header">
                  {(() => {
                    const headerText = message.role === 'user' ? (userProfile?.name || tString('chat.seeker', 'Seeker')) :
                                     message.role === 'council' ? getDisplayShortName(message.speakerName) :
                                     getDisplayShortName(selectedFigureName);

                    return headerText;
                  })()}
                </div>
                <div className="message-content">
                  {renderMessageContent(message.content)}
                </div>
                {(message.role === 'assistant' || message.role === 'council') && (
                  <button
                    className="report-content-btn"
                    onClick={() => {
                      const subject = encodeURIComponent('Inhalt melden / Report content');
                      const body = encodeURIComponent(
                        `Gemeldeter Inhalt / Reported content:\n\n"${message.content.slice(0, 500)}"\n\n---\nFigure: ${selectedFigureName || 'unknown'}\nDate: ${new Date().toISOString()}`
                      );
                      window.open(`mailto:agoracosmica@chipmates.ai?subject=${subject}&body=${body}`, '_self');
                    }}
                    aria-label={tString('report.label', 'Report content')}
                    title={tString('report.label', 'Report content')}
                  >
                    <Flag size={14} weight="regular" />
                  </button>
                )}
              </div>
              {message.role === 'user' && (
                <div className="avatar-container user-avatar">
                  {userProfile?.avatar?.startsWith('figure:') ? (
                    // Character avatar (Dante/Beatrice) — render via optimized figure pipeline
                    <OptimizedImage
                      name={userProfile.avatar.replace('figure:', '')}
                      purpose="thumbnail"
                      alt={userProfile.name || tString('chat.seeker', 'Seeker')}
                      className="avatar-image"
                      loading="lazy"
                    />
                  ) : userProfile?.avatar ? (
                    // Custom avatar uploaded by user (data URL from IndexedDB)
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.name || tString('chat.seeker', 'Seeker')}
                      className="avatar-image"
                      width={64}
                      height={64}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    // Default cosmic user avatar
                    <OptimizedImage
                      src="user"
                      type="ui"
                      purpose="thumbnail"
                      alt={userProfile?.name || tString('chat.seeker', 'Seeker')}
                      className="avatar-image"
                      loading="lazy"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
      
      {/* Voice Interaction Helper - shows after first message */}
      <VoiceInteractionHelper
        isVisible={showVoiceHelper}
        onDismiss={() => setShowVoiceHelper(false)}
        isMobile={isMobile}
        messageCount={messages.filter(m => m.role === 'assistant' && !m.hidden).length}
      />
    </div>
  );
};

export default ChatBox;