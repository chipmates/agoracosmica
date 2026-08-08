// src/components/QuietPlatePresence.tsx
// The dim presence on a quiet plate. While a carried question waits in the
// composer the stage stays empty by design, so the figure is here the way a
// portrait hangs in an unlit room: barely there, never addressed.
//
// Decorative on purpose. It sits in its own absolute layer under the log, takes
// no pointer events, takes no layout, and leaves the moment the conversation
// speaks, so nothing it does can move the composer or the arriving reply.
import { FC, useEffect, useState } from 'react';
import OptimizedFigureImage from './OptimizedFigureImage';
import './QuietPlatePresence.css';

interface QuietPlatePresenceProps {
  /** Whose presence fills the wait. Null while no figure is selected. */
  figureId: string | null;
  /** The stage is still quiet: greeting held, nothing sent, nothing in flight. */
  active: boolean;
}

/** How long the presence takes to leave. Matches the CSS fade. */
const FADE_OUT_MS = 600;

const QuietPlatePresence: FC<QuietPlatePresenceProps> = ({ figureId, active }) => {
  const [mounted, setMounted] = useState<boolean>(active);
  // The layer only lights once the portrait itself is decoded, so the image
  // component's loading placeholder never flashes across the plate.
  const [painted, setPainted] = useState<boolean>(false);

  useEffect(() => setPainted(false), [figureId]);

  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [active, mounted]);

  if (!mounted || !figureId) return null;

  return (
    <div
      className={`quiet-plate-presence${active && painted ? ' quiet-plate-presence--lit' : ''}`}
      aria-hidden="true"
    >
      <OptimizedFigureImage
        key={figureId}
        figure={figureId}
        type="main"
        className="quiet-plate-presence-figure"
        onLoad={() => setPainted(true)}
      />
    </div>
  );
};

export default QuietPlatePresence;
