// src/components/DownloadControl/DownloadControl.tsx
import { FC, MouseEvent, CSSProperties } from 'react';
import { DownloadSimple, X, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';
import { useMediaDownload } from '../../hooks/useMediaDownload';
import './DownloadControl.css';

export interface DownloadControlProps {
  /** File to fetch. Always the mp3 for audio. */
  url: string;
  /** Name the browser saves the file under. */
  filename: string;
  /** Idle label. `link` shows it inline, `stacked` shows it under the icon. */
  label: string;
  /** Describes the file for screen readers. */
  ariaLabel: string;
  /** `link` sits in a row of text affordances, `stacked` in a list column. */
  variant?: 'link' | 'stacked';
  iconSize?: number;
  className?: string;
}

/**
 * Fetch-to-disk control with determinate progress. A second tap cancels.
 *
 * The blob route exists because the media host sends no Content-Disposition,
 * so a plain cross-origin <a download> would land the file under a random
 * name.
 */
const DownloadControl: FC<DownloadControlProps> = ({
  url,
  filename,
  label,
  ariaLabel,
  variant = 'link',
  iconSize = 14,
  className = '',
}) => {
  const { tString } = useTranslation();
  const { status, percent, start, cancel } = useMediaDownload();

  const isDownloading = status === 'downloading';
  const isError = status === 'error';

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (isDownloading) {
      cancel();
      return;
    }
    start(url, filename);
  };

  const buttonLabel = isDownloading
    ? tString('download.cancel', 'Cancel download')
    : isError
      ? tString('download.failed', 'Download failed, try again')
      : ariaLabel;

  const visibleText = isDownloading
    ? (percent === null ? '' : `${percent}%`)
    : isError
      ? tString('download.retry', 'Try again')
      : label;

  const classes = [
    'download-control',
    `download-control--${variant}`,
    isDownloading ? 'download-control--busy' : '',
    isError ? 'download-control--error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      aria-label={buttonLabel}
      title={buttonLabel}
      style={percent !== null ? ({ '--download-progress': `${percent}%` } as CSSProperties) : undefined}
    >
      <span className="download-control__icon" aria-hidden="true">
        {isDownloading ? (
          <X size={iconSize} weight="bold" />
        ) : isError ? (
          <WarningCircle size={iconSize} weight="duotone" />
        ) : (
          <DownloadSimple size={iconSize} weight="duotone" />
        )}
      </span>
      {visibleText && <span className="download-control__label">{visibleText}</span>}
    </button>
  );
};

export default DownloadControl;
