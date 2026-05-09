// src/components/Accessibility/SkipLinks.tsx
import { FC, MouseEvent, useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import './SkipLinks.css';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

const DEFAULT_LINKS: SkipLink[] = [
  { href: '#main-content', label: 'skip_to_main_content' },
  { href: '#navigation', label: 'skip_to_navigation' }
];

/**
 * Skip Links Component - 2025 State-of-the-Art Accessibility
 *
 * Provides keyboard navigation shortcuts to main content areas.
 * Invisible by default, appears when focused via Tab key.
 *
 * @param props - Component props
 * @param props.links - Array of skip link objects
 * @param props.className - Additional CSS classes
 * @returns JSX.Element Skip links component
 */
const SkipLinks: FC<SkipLinksProps> = ({
  links,
  className = ''
}) => {
  const { tString, tNode } = useTranslation();
  const stableLinks = useMemo(() => links ?? DEFAULT_LINKS, [links]);

  // Filter links after DOM is ready (not at render time)
  const [availableLinks, setAvailableLinks] = useState<SkipLink[]>([]);
  useEffect(() => {
    const filtered = stableLinks.filter(({ href }) => document.querySelector(href) !== null);
    setAvailableLinks(filtered);
  }, [stableLinks]);

  /**
   * Handle skip link click with smooth scrolling and focus management
   * @param event - Click event
   * @param href - Target element selector
   */
  const handleSkipClick = (event: MouseEvent<HTMLAnchorElement>, href: string): void => {
    event.preventDefault();

    const target = document.querySelector(href) as HTMLElement;

    if (target) {
      // Make target focusable if it isn't already
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }

      // Focus the target element
      target.focus();

      // Smooth scroll to target
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // Remove tabindex after focus (cleanup)
      setTimeout(() => {
        if (target.getAttribute('tabindex') === '-1') {
          target.removeAttribute('tabindex');
        }
      }, 1000);
    }
  };

  // Don't render if no targets are available
  if (availableLinks.length === 0) {
    return null;
  }

  return (
    <div className={`skip-links ${className}`} aria-label={tString('accessibility.skipLinks.skip_navigation_label', 'Skip Navigation')}>
      {availableLinks.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="skip-link"
          onClick={(e) => handleSkipClick(e, href)}
        >
          {tNode(`accessibility.skipLinks.${label}`)}
        </a>
      ))}
    </div>
  );
};

export default SkipLinks;
