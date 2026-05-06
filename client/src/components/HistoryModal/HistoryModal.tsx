import React, { FC } from 'react';
import ReactDOM from 'react-dom';
import { ModalContainer, ModalHeader } from '../Modal';
import SummaryLoader from '../SummaryLoader';
import ModeFilterBar from './ModeFilterBar';
import HistoryToolbar from './HistoryToolbar';
import SeedHistoryList from './SeedHistoryList';
import HistoryHelperContent from './HistoryHelperContent';
import { useHistoryModalData } from './useHistoryModalData';
import { getLastName } from './historyModalConstants';
import type { HistoryModalProps } from './historyModalTypes';
import './HistoryModal.css';

const HistoryModal: FC<HistoryModalProps> = (props) => {
  const {
    isOpen,
    selectedFigure,
  } = props;

  const {
    t, tString, tNode, tArray,
    histories,
    selectedSeedId,
    setSelectedSeedId,
    isLoading,
    showSpinner,
    expandedSeeds,
    currentActiveSeed,
    expandedSections,
    selectedModes,
    isInitialLoad,
    showHistoryHelp,
    setShowHistoryHelp,
    sortedActiveSeeds,
    handleClose,
    handleSummary,
    handleBackup,
    handleRestore,
    handleClearSeedHistory,
    handleClearAllHistory,
    toggleMode,
    toggleSection,
    toggleSeedExpansion,
    filterMessagesByMode,
    getSeedTitleDisplay,
    handleDontShowHistoryHelp,
    withHaptic,
  } = useHistoryModalData(props);

  if (!isOpen) return null;

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={handleClose}
      contentClassName="history-modal-content"
      animationType="fade-scale"
      alignTop={true}
      backgroundVariant="fullscreen"
      className="fullscreen-modal"
    >
      <ModalHeader
        layout="three-column"
        title={String(t('history.title', { figure: getLastName(selectedFigure.name) }))}
        onClose={handleClose}
        closeAriaLabel="Close history modal"
        cosmicStars={true}
      />

      <ModeFilterBar
        selectedModes={selectedModes}
        toggleMode={toggleMode}
        tString={tString}
      />

      <HistoryToolbar
        hasSeeds={sortedActiveSeeds.length > 0}
        selectedSeedId={selectedSeedId}
        onBackup={handleBackup}
        onRestore={handleRestore}
        onClearAll={handleClearAllHistory}
        onSummary={handleSummary}
        withHaptic={withHaptic}
        tString={tString}
        tNode={tNode}
      />

      {/* Render loading overlay outside the modal */}
      {showSpinner && ReactDOM.createPortal(
        <div className="summary-modal-overlay" style={{ zIndex: 10001 }}>
          <SummaryLoader figureName={selectedFigure.name} />
        </div>,
        document.body
      )}

      <SeedHistoryList
        sortedActiveSeeds={sortedActiveSeeds}
        histories={histories}
        selectedSeedId={selectedSeedId}
        expandedSeeds={expandedSeeds}
        expandedSections={expandedSections}
        currentActiveSeed={currentActiveSeed}
        isInitialLoad={isInitialLoad}
        isLoading={isLoading}
        selectedFigureName={selectedFigure.name}
        seekerLabel={tString('chat.seeker', 'Seeker')}
        summaryTitleLabel={tNode('history.summary.title')}
        filterMessagesByMode={filterMessagesByMode}
        getSeedTitleDisplay={getSeedTitleDisplay}
        toggleSeedExpansion={toggleSeedExpansion}
        setSelectedSeedId={setSelectedSeedId}
        handleClearSeedHistory={handleClearSeedHistory}
        toggleSection={toggleSection}
        withHaptic={withHaptic}
        tString={tString}
        tNode={tNode}
      />

      <HistoryHelperContent
        showHistoryHelp={showHistoryHelp}
        onDismiss={() => setShowHistoryHelp(false)}
        onDontShowAgain={handleDontShowHistoryHelp}
        tString={tString}
        tNode={tNode}
        tArray={tArray}
      />
    </ModalContainer>
  );
};

export default HistoryModal;
