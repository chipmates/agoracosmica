import React, { useRef } from 'react';

declare global {
  interface Window {
    __renderCounter?: Record<string, number>;
  }
}

interface RenderCounterProps {
  label: string;
}

const RenderCounter: React.FC<RenderCounterProps> = ({ label }) => {
  const countRef = useRef(0);
  countRef.current += 1;

  if (typeof window !== 'undefined') {
    window.__renderCounter = window.__renderCounter || {};
    window.__renderCounter[label] = countRef.current;
  }

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <span
      data-render-counter
      data-label={label}
      data-count={countRef.current}
      style={{ display: 'none' }}
    />
  );
};

export default RenderCounter;
