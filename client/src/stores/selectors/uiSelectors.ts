import { useUIStore } from '../uiStore';
import type { UIState } from '../uiStore';

export const selectModalState = (state: UIState) => state.modals;
export const selectLoadingState = (state: UIState) => state.loading;
export const selectErrorState = (state: UIState) => state.errors;

export const useModalState = () => useUIStore(selectModalState);
export const useUILoadingState = () => useUIStore(selectLoadingState);
export const useUIErrorState = () => useUIStore(selectErrorState);
