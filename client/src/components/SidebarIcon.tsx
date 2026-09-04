import type { FC } from 'react';
import pathsIcon from '../assets/icons/paths.svg';
import libraryIcon from '../assets/icons/library.svg';
import councilIcon from '../assets/icons/council.svg';
import settingsIcon from '../assets/icons/settings.svg';

export type SidebarIconName = 'paths' | 'library' | 'council' | 'settings';

const ICONS: Record<SidebarIconName, string> = {
  paths: pathsIcon,
  library: libraryIcon,
  council: councilIcon,
  settings: settingsIcon,
};

interface SidebarIconProps {
  name: SidebarIconName;
  className?: string;
  alt?: string;
}

/**
 * The four navigation icons as standalone SVG files. Colors are baked into
 * the files because an image cannot read the page's CSS variables.
 */
const SidebarIcon: FC<SidebarIconProps> = ({ name, className = '', alt = '' }) => (
  <img
    src={ICONS[name]}
    className={className}
    alt={alt}
    decoding="async"
    draggable={false}
  />
);

export default SidebarIcon;
