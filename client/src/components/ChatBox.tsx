// src/components/ChatBox.tsx
import React, { useEffect, useRef, useState, FC } from 'react';
import OptimizedImage from './OptimizedImage';
import OptimizedFigureImage from './OptimizedFigureImage';
import { sanitizeContent } from '../utils/sanitizeContent';
import { getDisplayShortName } from '../utils/figureDisplayName';
import { useTranslation } from '../hooks/useTranslation';
import { CrisisNote } from './CrisisNote';
import { clearCrisisNote, dismissCrisisNote, readCrisisNote, resetConversationCrisisNote, subscribeCrisisNote } from '../services/safety/crisisNote';
import VoiceInteractionHelper from './VoiceInteractionHelper';

// Helper doctrine (2026-07-23): first-time popups must not cover content. The
// voice helper duplicated the composer bar's own wording and re-fired over the
// Echo's replies, so it is removed from the flow but kept in the tree.
const VOICE_HELPER_REMOVED = true;
import { Flag, SpeakerSlash } from '@phosphor-icons/react';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';
import { ttsScheduler } from '../controllers/conversationStreamDriver';
import { cleanupAudioResources } from '../services/audioService';
import { useDomainStore } from '../stores';
import { readCarriedThread, hasCarriedQuestionPending, CARRIED_THREAD_EVENT } from '../utils/public/entryIntent';
import { ANSWER_FIRST_REPLY, ANSWER_PROVENANCE, QUIET_PLATE_PRESENCE } from '../config/features';
import { ProvenanceChip, ChapterDoor } from './ProvenanceChip';
import QuietPlatePresence from './QuietPlatePresence';
import RoomContainer from './RoomContainer';

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

const ChatBoxSurface: FC<ChatBoxProps> = ({
  messages,
  selectedFigureName,
  isLoading = false,
  isReviewMode = false,
  isAudioPlaying = false,
}) => {
  const { tString, tNode, language } = useTranslation();
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [showVoiceHelper, setShowVoiceHelper] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Carried-question provenance. The record lives outside React (a send writes
  // it), so this listens for the one moment it changes.
  const historyKey = useDomainStore((state) => state.conversation.historyKey);
  const selectedMode = useDomainStore((state) => state.mode.selected);
  const selectedFigureId = useDomainStore((state) => state.figures.selectedId);
  const pendingRequestId = useDomainStore((state) => state.conversation.pendingRequestId);
  const [carriedThread, setCarriedThread] = useState(readCarriedThread);
  const [crisisNote, setCrisisNote] = useState(readCrisisNote);
  useEffect(() => subscribeCrisisNote(() => setCrisisNote(readCrisisNote())), []);
  // A new conversation drops the topical line; a new figure drops everything.
  // The distress banner belongs to the visit, so a mode switch keeps it.
  useEffect(() => { resetConversationCrisisNote(); }, [historyKey]);
  useEffect(() => { clearCrisisNote(); }, [selectedFigureId]);

  useEffect(() => {
    const sync = () => setCarriedThread(readCarriedThread());
    window.addEventListener(CARRIED_THREAD_EVENT, sync);
    return () => window.removeEventListener(CARRIED_THREAD_EVENT, sync);
  }, []);

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
      'mohandas gandhi': 'gandhi',
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
      'platon': 'plato',
      'marc aurel': 'aurelius',
      'mark aurel': 'aurelius'
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

  const renderedMessages = deduplicatedMessages.filter(
    message => message.content && message.content.trim()
  );

  // The greeting is being held back for a question the visitor is reading.
  const carriedQuestionWaiting = ANSWER_FIRST_REPLY
    && selectedMode === 'free_conversation'
    && hasCarriedQuestionPending();

  // The quiet stage keeps the figure's presence for exactly as long as the
  // wait lasts. A send, the sitter greeting, or anything else in flight ends
  // it, and the presence is gone before the first word lands.
  const quietPresenceLit = QUIET_PLATE_PRESENCE
    && carriedQuestionWaiting
    && deduplicatedMessages.length === 0
    && !isLoading
    && !pendingRequestId;

  // The chapter behind a carried question. Only a question with a real anchor
  // has one, and only in the conversation it opened.
  const chapter = (() => {
    if (!ANSWER_PROVENANCE || !carriedThread || selectedMode !== 'free_conversation') return null;
    if (carriedThread.threadKey !== (historyKey ?? '')) return null;
    const n = Number(carriedThread.anchorSeedId);
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
  })();

  // The chip belongs to the reply that answered the carried question: the
  // first thing the figure said after that send.
  const chipIndex = (() => {
    if (chapter === null || !carriedThread) return -1;
    let userTurns = 0;
    for (let i = 0; i < renderedMessages.length; i++) {
      const role = renderedMessages[i].role;
      if (role === 'user') userTurns += 1;
      else if (role === 'assistant' && userTurns >= carriedThread.startTurn) return i;
    }
    return -1;
  })();

  return (
    <div className="chatbox-container">
      {/* Dim presence for the stage a carried question waits on. Its own layer
          under the log, so it cannot touch the composer or the reply. */}
      {QUIET_PLATE_PRESENCE && (
        <QuietPlatePresence figureId={selectedFigureId} active={quietPresenceLit} />
      )}

      {/* Crisis note above the log, where nothing floats across it: the quiet
          footer once when the subject came up, the banner for the session when
          the visitor sounded like they cannot go on. */}
      {crisisNote && (
        <CrisisNote note={crisisNote} language={language} onDismiss={dismissCrisisNote} />
      )}

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
        {/* Empty state - only show if no messages and not loading. A carried
            question waiting in the composer is not an empty conversation, so
            the prompt to choose a topic would only contradict it. */}
        {deduplicatedMessages.length === 0 && !isLoading && !carriedQuestionWaiting && (
          <div className="empty-chat-state">
            <p className="empty-chat-message">
              {tNode('chat.emptyState')}
            </p>
          </div>
        )}

        {/* Message list */}
        {renderedMessages
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
                {chapter !== null && index === chipIndex && (
                  <ProvenanceChip chapter={chapter} />
                )}
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
              {/* User messages carry no avatar (removed 2026-07-24): the
                  header names the speaker, and the freed column goes to the
                  bubble, which matters most on mobile. */}
            </div>
          ))}

        {/* Standing door into the chapter behind the carried question. It sits
            at the end of the log, which the chat scrolls to after every reply,
            so it stays reachable without covering a word of the conversation
            or borrowing height from the composer. */}
        {chapter !== null && (
          <div className="chapter-door-row">
            <ChapterDoor chapter={chapter} />
          </div>
        )}

      </div>


      {/* Stop voice: visible while the Echo speaks. Cancels upstream TTS
          generation BEFORE stopping playback, so a straggler chunk finishing
          after the stop cannot re-take audio focus. */}
      {isAudioPlaying && !isReviewMode && (
        <button
          type="button"
          className="stop-voice-pill"
          onClick={() => {
            ttsScheduler.cancelAll();
            cleanupAudioResources();
          }}
        >
          <SpeakerSlash size={18} weight="bold" aria-hidden="true" />
          <span>{tString('chat.stopVoice', 'Stop voice')}</span>
        </button>
      )}

      {/* Voice Interaction Helper — REMOVED from the flow 2026-07-23 (helper
          doctrine: the composer bar already carries the same guidance, and the
          popup re-fired over every first reply). Component kept for a possible
          return. Revert = set VOICE_HELPER_REMOVED to false. */}
      {!VOICE_HELPER_REMOVED && (
        <VoiceInteractionHelper
          isVisible={showVoiceHelper}
          onDismiss={() => setShowVoiceHelper(false)}
          isMobile={isMobile}
          messageCount={messages.filter(m => m.role === 'assistant' && !m.hidden).length}
        />
      )}
    </div>
  );
};

// The chat log is one of the two talking surfaces, so it names the room it
// renders in. The wrapper is layout-neutral (display: contents), so nothing
// inside moves.
const ChatBox: FC<ChatBoxProps> = (props) => (
  <RoomContainer>
    <ChatBoxSurface {...props} />
  </RoomContainer>
);

export default ChatBox;