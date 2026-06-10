import React from 'react';
import MainContent from './MainContent';
import { Figure, Seed } from '../../types/global';
import { ConversationVM } from '../../vm/useConversationVM';
import { useAppStateVM } from '../../vm/useAppStateVM';
import RenderCounter from '../../dev/RenderCounter';

type AppStateSnapshot = ReturnType<typeof useAppStateVM>;
type AppConfig = AppStateSnapshot['state']['config'];
type StoryData = AppStateSnapshot['state']['storyData'];

type Mode = {
  id: string;
  label: string;
  icon: React.ComponentType;
  color: string;
};

interface SessionSlice {
  showFigureCarousel: boolean;
  isCouncilMode: boolean;
  councilConfig: any;
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  selectedMode: string | null;
  isReviewMode: boolean;
  cosmicCouncilService: any;
  handleSelectFigure: (figure: Figure) => Promise<void> | void;
  handleCouncilEnd: () => Promise<void> | void;
  handleSeedComplete: (seedId: string | number | undefined) => void;
  councilPlayerId: string | null;
  councilPlayerLevel: 1 | 2;
  handleCouncilPlayerClose: () => void;
  handlePrismClose: () => void;
  handleModeSelectorOpen: () => void;
  handleFigureCarouselOpen: () => void;
}

interface AppSlice {
  config: AppConfig;
  loading: boolean;
  translationInProgress: boolean;
  firstTextArrived: boolean;
  isAudioPlaying: boolean;
  storyData: StoryData;
  setError: AppStateSnapshot['actions']['setError'];
}

interface TranslationSlice {
  t: (key: string) => string;
  MODES: Mode[];
  getTranslatedFigureName: () => string;
  getCurrentSeedName: () => string;
}

interface QuickActionsSlice {
  showQuickLinkBar: boolean;
  handleQuickAction: (action: string) => void;
  handleHistoryModalOpen: () => void;
}

interface MainContentContainerProps {
  session: SessionSlice;
  app: AppSlice;
  conversation: ConversationVM;
  translations: TranslationSlice;
  quickActions: QuickActionsSlice;
  onSubmitMessage: (message: string) => Promise<void> | void;
}

const MainContentContainer: React.FC<MainContentContainerProps> = ({
  session,
  app,
  conversation,
  translations,
  quickActions,
  onSubmitMessage
}) => {
  const { state: conversationState } = conversation;

  return (
    <>
      {import.meta.env.DEV && <RenderCounter label="MainContent" />}
      <MainContent
        showFigureCarousel={session.showFigureCarousel}
        isCouncilMode={session.isCouncilMode}
        councilConfig={session.councilConfig}
        selectedFigure={session.selectedFigure}
        selectedSeed={session.selectedSeed}
        selectedMode={session.selectedMode}
        conversationStartedFinal={conversationState.conversationStarted || conversationState.derivedConversationStarted}
        messages={conversationState.messages}
        loading={app.loading}
        translationInProgress={app.translationInProgress}
        firstTextArrived={app.firstTextArrived}
        isReviewMode={session.isReviewMode}
        isAudioPlaying={app.isAudioPlaying}
        storyData={app.storyData}
        config={app.config}
        cosmicCouncilService={session.cosmicCouncilService}
        t={translations.t}
        MODES={translations.MODES}
        getTranslatedFigureName={translations.getTranslatedFigureName}
        getCurrentSeedName={translations.getCurrentSeedName}
        handleSelectFigure={session.handleSelectFigure}
        handleCouncilEnd={session.handleCouncilEnd}
        handleSeedComplete={session.handleSeedComplete}
        setError={app.setError}
        onSubmitMessage={onSubmitMessage}
        showQuickLinkBar={quickActions.showQuickLinkBar}
        handleQuickAction={quickActions.handleQuickAction}
        handleHistoryModalOpen={quickActions.handleHistoryModalOpen}
        councilPlayerId={session.councilPlayerId}
        councilPlayerLevel={session.councilPlayerLevel}
        onCouncilPlayerClose={session.handleCouncilPlayerClose}
        onPrismClose={session.handlePrismClose}
        onChooseMode={session.handleModeSelectorOpen}
        onChooseFigure={session.handleFigureCarouselOpen}
      />
    </>
  );
};

export default MainContentContainer;
