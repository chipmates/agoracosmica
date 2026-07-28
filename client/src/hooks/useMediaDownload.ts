// src/hooks/useMediaDownload.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchToBlob, saveBlob } from '../services/mediaDownload';

export type MediaDownloadStatus = 'idle' | 'downloading' | 'error';

export interface MediaDownloadState {
  status: MediaDownloadStatus;
  /** 0-100 while the size is known, null while it is not. */
  percent: number | null;
  /** Fetch the file and hand it to the browser under `filename`. */
  start: (url: string, filename: string) => void;
  /** Abort an in-flight download. */
  cancel: () => void;
}

/** How long a failed download keeps its error face before going quiet. */
const ERROR_RESET_MS = 5000;

/**
 * One file download with determinate progress and cancellation.
 *
 * Failure is non-blocking: the control shows an error for a few seconds and
 * returns to idle, so a flaky network never leaves a dead affordance.
 */
export function useMediaDownload(): MediaDownloadState {
  const [status, setStatus] = useState<MediaDownloadStatus>('idle');
  const [percent, setPercent] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setPercent(null);
  }, []);

  const start = useCallback((url: string, filename: string) => {
    if (abortRef.current) return;
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('downloading');
    setPercent(0);

    fetchToBlob(url, {
      signal: controller.signal,
      onProgress: value => {
        if (mountedRef.current && !controller.signal.aborted) setPercent(value);
      },
    })
      .then(blob => {
        if (controller.signal.aborted) return;
        saveBlob(blob, filename);
        if (!mountedRef.current) return;
        setStatus('idle');
        setPercent(null);
      })
      .catch(() => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setStatus('error');
        setPercent(null);
        errorTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setStatus('idle');
        }, ERROR_RESET_MS);
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
      });
  }, []);

  return { status, percent, start, cancel };
}

export default useMediaDownload;
