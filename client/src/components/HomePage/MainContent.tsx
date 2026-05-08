import React, { FC, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Sparkle } from "@phosphor-icons/react";
import FigureCarousel from '../FigureCarousel';
import CosmicCouncilHeader from '../CosmicCouncil/CosmicCouncilHeader';
import CosmicCouncilLoaderIntegration from '../CosmicCouncil/CosmicCouncilLoaderIntegration';
import ChatBox from '../ChatBox';
import UnifiedInputContainer from '../UnifiedInputContainer';
import ProcessingLoader from '../ProcessingLoader';
const StoryPlayer = lazy(() => import('../StoryPlayer'));
const PrismPlayer = lazy(() => import('../PrismPlayer').then(m => ({ default: m.PrismPlayer })));
const LiveCouncilPlayer = lazy(() => import('../LiveCouncilPlayer').then(m => ({ default: m.LiveCouncilPlayer })));
import ErrorBoundary from '../ErrorBoundary';
import { BookmarkQuickLinks } from '../Navigation';
import styles from './MainContent.module.css';
import { Figure, Seed, ConversationMode } from '../../types/global';
import { getDisplayShortName } from '../../utils/figureDisplayName';

// Type definitions
interface ServiceConfig {
  [key: string]: any;
}

interface CouncilConfig {
  moderator?: string;
  participants?: string[];
  currentSpeaker?: string;
  currentPhase?: string;
  councilTitle?: string;
  councilType?: string;
  isCompleted?: boolean;
  [key: string]: any;
}

interface StoryData {
  type?: 'prerecorded' | 'generated';
  needsTranslation?: boolean;
  text?: string;
  [key: string]: any;
}

interface Message {
  role: 'user' | 'assistant' | 'council';
  content: string;
  hidden?: boolean;
  speakerName?: string;
}

interface Mode {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

interface MainContentProps {
  // Component state
  showFigureCarousel: boolean;
  isCouncilMode: boolean;
  councilConfig: CouncilConfig | null;
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  selectedMode: string | null;
  conversationStartedFinal: boolean;
  messages: Message[];
  loading: boolean;
  translationInProgress: boolean;
  firstTextArrived: boolean;
  isReviewMode: boolean;
  isAudioPlaying: boolean;
  storyData: StoryData | null;
  config: ServiceConfig;
  cosmicCouncilService: any; // Type this properly if you have the service type
  
  // Translations
  t: (key: string) => string;
  MODES: Mode[];
  getTranslatedFigureName: () => string;
  getCurrentSeedName: () => string;
  
  // Handlers
  handleSelectFigure: (figure: Figure) => void;
  handleCouncilEnd: () => void;
  handleSeedComplete: (seedId: string | number | undefined) => void;
  setError: (error: string) => void;
  onSubmitMessage: (message: string) => Promise<void> | void;

  // Quick Link Bar props
  showQuickLinkBar: boolean;
  handleQuickAction: (action: string) => void;
  handleHistoryModalOpen: () => void;

  // Council player props
  councilPlayerId: string | null;
  councilPlayerLevel: 1 | 2;
  onCouncilPlayerClose: () => void;

  // Prism player close handler
  onPrismClose: () => void;
}

/**
 * Main content area component extracted from HomePage
 * Contains the chat interface, story player, and council mode UI
 */
const MainContent: FC<MainContentProps> = ({
  // Component state
  showFigureCarousel,
  isCouncilMode,
  councilConfig,
  selectedFigure,
  selectedSeed,
  selectedMode,
  conversationStartedFinal,
  messages,
  loading,
  translationInProgress,
  firstTextArrived,
  isReviewMode,
  isAudioPlaying,
  storyData,
  config,
  cosmicCouncilService,
  
  // Translations
  t,
  MODES,
  getTranslatedFigureName,
  getCurrentSeedName,
  
  // Handlers
  handleSelectFigure,
  handleCouncilEnd,
  handleSeedComplete,
  setError,
  onSubmitMessage,

  // Quick Link Bar props
  showQuickLinkBar,
  handleQuickAction,
  handleHistoryModalOpen,

  // Council player props
  councilPlayerId,
  councilPlayerLevel,
  onCouncilPlayerClose,

  // Prism player close handler
  onPrismClose
}) => {
  return (
    <main
      id="main-content"
      className={`main-content ${showFigureCarousel ? 'carousel-open' : ''}`}
    >
      {/* Council player — full-screen portal overlay (curated councils) */}
      {councilPlayerId && createPortal(
        <div className="council-player-overlay">
          <ErrorBoundary>
            <Suspense fallback={null}>
              <PrismPlayer
                councilId={councilPlayerId}
                councilLevel={councilPlayerLevel}
                onClose={onCouncilPlayerClose}
              />
            </Suspense>
          </ErrorBoundary>
        </div>,
        document.body
      )}

      {/* Live council player — cinematic overlay for custom (live) councils */}
      {isCouncilMode && councilConfig && !councilPlayerId && (
        <Suspense fallback={null}>
          <LiveCouncilPlayer onClose={handleCouncilEnd} />
        </Suspense>
      )}

      {showFigureCarousel ? (
        <FigureCarousel
          isOpen={true}
          onClose={() => {}}
          onSelectFigure={handleSelectFigure}
          selectedFigure={selectedFigure}
        />
      ) : (
        <>
          <div className={styles.container}>
            {/* Header section */}
            {isCouncilMode ? (
              <CosmicCouncilHeader
                moderator={councilConfig?.moderator}
                participants={councilConfig?.participants || []}
                currentSpeaker={councilConfig?.currentSpeaker}
                currentPhase={(councilConfig?.currentPhase || 'foundations') as any}
                councilTitle={councilConfig?.councilTitle || 'Cosmic Council'}
                councilType={(councilConfig?.councilType || 'debate') as any}
                isActive={isCouncilMode}
                isCompleted={councilConfig?.isCompleted || false}
                onEndCouncil={handleCouncilEnd}
              />
            ) : (
              <div className="chat-header" key={`header-${selectedFigure?.id || 'none'}-${selectedSeed?.id || 'none'}-${selectedMode || 'none'}`}>
                <h1 className="figure-name">{getDisplayShortName(getTranslatedFigureName())}</h1>
                {selectedSeed && selectedMode !== 'free_conversation' && (
                  <div className="seed-name" key={`seed-${selectedMode || 'default'}-${selectedSeed.id}`}>
                    <span className="seed-name-text">{getCurrentSeedName()}</span>
                  </div>
                )}
                {conversationStartedFinal && selectedMode && (
                  <div className="mode-indicator" key={`mode-${selectedMode}`}>
                    {MODES.find(mode => mode.id === selectedMode) && (() => {
                      const currentMode = MODES.find(mode => mode.id === selectedMode)!;
                      return (
                        <>
                          {React.createElement(currentMode.icon, {
                            size: 28,
                            weight: "duotone",
                            style: {
                              marginRight: '10px',
                              color: `var(--${currentMode.color}-base)`
                            }
                          })}
                          <span style={{
                            background: `linear-gradient(120deg, var(--${currentMode.color}-base), var(--${currentMode.color}-light))`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            textShadow: `0 0 20px rgba(var(--${currentMode.color}-rgb), 0.5)`,
                            padding: '0px 5px',
                            position: 'relative',
                            zIndex: 2
                          }}>
                            {currentMode.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Bookmark Quick Links */}
            {showQuickLinkBar && (
              <BookmarkQuickLinks
                currentMode={(selectedMode as ConversationMode) ?? undefined}
                onActionClick={handleQuickAction}
                onHistoryClick={handleHistoryModalOpen}
                isVisible={true}
              />
            )}

            {/* Content section */}
            {selectedMode === 'prism' && selectedFigure && selectedSeed && conversationStartedFinal && !showFigureCarousel ? (
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <PrismPlayer
                    figure={selectedFigure.id}
                    seed={typeof selectedSeed.id === 'string' ? parseInt(selectedSeed.id, 10) || 1 : selectedSeed.id as number}
                    onClose={onPrismClose}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : isCouncilMode && councilConfig ? (
              // Council Mode - Always show ChatBox with council integration
              <>
                {/* Processing Loader for translations and initial loading */}
                {loading && !firstTextArrived && (
                  <ProcessingLoader figureName={selectedFigure?.name || 'Unknown'} />
                )}
                
                {/* Cosmic Council Loader for council generation */}
                <CosmicCouncilLoaderIntegration councilService={cosmicCouncilService} />
                
                <ChatBox
                  messages={messages}
                  selectedFigureName={selectedFigure?.name || 'Unknown'}
                  isLoading={loading || translationInProgress}
                  firstTextArrived={firstTextArrived}
                  isReviewMode={isReviewMode}
                  isAudioPlaying={isAudioPlaying}
                />

                {/* Hide input field during council mode - autonomous conversation doesn't need user input */}
                {!isCouncilMode && (
                  <UnifiedInputContainer
                    selectedFigure={selectedFigure?.name || 'Unknown'}
                    onSubmitMessage={onSubmitMessage}
                  />
                )}
              </>
            ) : !conversationStartedFinal ? (
              // Show empty state while mode selector or language wheel should appear
              <div style={{ position: "relative", height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ color: 'var(--gold-base)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <Sparkle size={48} weight="duotone" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    <p style={{ fontSize: '18px', fontWeight: '500' }}>
                      {t('conversation.preparingJourney') || 'Preparing your journey...'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedMode === 'introduction' && storyData && storyData.type === 'prerecorded' && !storyData.needsTranslation ? (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      {/* StoryPlayer handles both audio controls AND text display */}
                      <StoryPlayer
                        figure={selectedFigure?.id || 'unknown'}
                        figureName={selectedFigure?.name || 'Unknown'}
                        storyData={storyData as any}
                        onComplete={() => handleSeedComplete(selectedSeed?.id)}
                        onError={(err: Error) => setError(err.message)}
                        selectedSeed={selectedSeed ?? undefined}
                      />
                    </Suspense>
                  </ErrorBoundary>
                ) : (
                  <>
                    {/* Processing Loader for translations and initial loading */}
                    {loading && !firstTextArrived && (
                      <ProcessingLoader figureName={selectedFigure?.name || 'Unknown'} />
                    )}
                    
                    <ChatBox
                      messages={messages}
                      selectedFigureName={selectedFigure?.name || 'Unknown'}
                      isLoading={loading || translationInProgress}
                      firstTextArrived={firstTextArrived}
                      isReviewMode={isReviewMode}
                      isAudioPlaying={isAudioPlaying}
                    />

                    {/* Include StoryPlayer for generated stories in introduction mode */}
                    {selectedMode === 'introduction' && storyData && storyData.type === 'generated' && selectedFigure && (
                      <Suspense fallback={null}>
                        <StoryPlayer
                          figure={selectedFigure.id}
                          figureName={selectedFigure.name}
                          storyData={storyData as any}
                          onComplete={() => handleSeedComplete(selectedSeed?.id)}
                          onError={(err: Error) => setError(err.message)}
                          selectedSeed={selectedSeed ?? undefined}
                          style={{ display: 'none' }} // Hide but keep for audio
                        />
                      </Suspense>
                    )}

                    {/* Hide input field during council mode - autonomous conversation doesn't need user input */}
                    {!isCouncilMode && (
                      <UnifiedInputContainer
                        selectedFigure={selectedFigure?.name || 'Unknown'}
                        onSubmitMessage={onSubmitMessage}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
};

MainContent.displayName = 'MainContent';

export default React.memo(MainContent);
