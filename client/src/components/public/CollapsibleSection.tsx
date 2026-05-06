// Collapsible section wrapper for public pages
// Remove this file when stripping marketing pages from a fork

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="pub-section pub-collapsible">
      <button
        className="pub-collapsible__header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h2 className="pub-section__title pub-collapsible__title">
          {title}
          {count !== undefined && (
            <span className="pub-collapsible__count"> ({count})</span>
          )}
        </h2>
        <span className={`pub-collapsible__arrow ${open ? 'pub-collapsible__arrow--open' : ''}`}>
          &#9660;
        </span>
      </button>
      {open && (
        <div className="pub-collapsible__body">
          {children}
        </div>
      )}
    </section>
  );
}
