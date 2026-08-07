// src/components/RoomContainer.tsx
// One room, many states. The talking surfaces (the chat log, the story player)
// sit inside this wrapper so that anything within them can ask which room it is
// standing in, in JS through the context and in CSS through [data-room-state].
// The wrapper itself is layout-neutral and carries no appearance.
import { createContext, useContext, FC, ReactNode } from 'react';
import { useDomainStore } from '../stores';
import './RoomContainer.css';

/**
 * The eight states the room can hold.
 *
 * `voice` (the visitor is speaking) and `woven` (the answer folded back into
 * the reading) are declared but not derived yet: the recording flag lives in
 * the composer's local state and the woven layout is not built, so nothing
 * assigns them. They stay in the type so the rooms that arrive later name
 * themselves the same way.
 */
export type RoomState =
  | 'story'
  | 'asking'
  | 'voice'
  | 'woven'
  | 'chapterend'
  | 'wisdom'
  | 'prism'
  | 'quest';

const RoomStateContext = createContext<RoomState | null>(null);

/** The room the calling component renders in, or null outside a RoomContainer. */
export const useRoomState = (): RoomState | null => useContext(RoomStateContext);

/**
 * Mode to room. Wisdom is the seed conversation held inside a chapter; without
 * a chapter it is the same room as free talk, a question and an answer.
 */
export function roomStateForMode(mode: string | null | undefined, hasSeed: boolean): RoomState {
  switch (mode) {
    case 'introduction':
      return 'story';
    case 'prism':
      return 'prism';
    case 'challenge':
      return 'quest';
    case 'seed_conversation':
      return hasSeed ? 'wisdom' : 'asking';
    default:
      return 'asking';
  }
}

interface RoomContainerProps {
  /** Names the room directly, for a state the selected mode cannot tell apart. */
  state?: RoomState;
  children: ReactNode;
}

const RoomContainer: FC<RoomContainerProps> = ({ state, children }) => {
  const mode = useDomainStore((s) => s.mode.selected);
  const hasSeed = useDomainStore((s) => s.seeds.selectedId != null);
  const room = state ?? roomStateForMode(mode, hasSeed);

  return (
    <RoomStateContext.Provider value={room}>
      <div className="room-container" data-room-state={room}>
        {children}
      </div>
    </RoomStateContext.Provider>
  );
};

export default RoomContainer;
