// src/hooks/useFileSize.ts
import { useEffect, useState } from 'react';
import { probeContentLength } from '../services/mediaDownload';

/**
 * Byte size of a remote file, probed with HEAD and cached across the session.
 * Null while unknown, and null forever if the host refuses the probe, so
 * callers can fall back to a label without a size.
 */
export function useFileSize(url: string | null): number | null {
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!url) {
      setBytes(null);
      return;
    }
    let cancelled = false;
    setBytes(null);
    probeContentLength(url).then(result => {
      if (!cancelled) setBytes(result);
    });
    return () => { cancelled = true; };
  }, [url]);

  return bytes;
}

export default useFileSize;
