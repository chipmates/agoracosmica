/**
 * audioFormat.ts - Shared audio format detection utility
 *
 * Detects WebM/Opus support (cached). Both dev and prod use WebM
 * (local assets are WebM-only, MP3 backups stay in council-generator).
 * Used by CouncilPlayerService and CuratedCouncilService for consistent
 * audio format selection across all council playback paths.
 */

let _canPlayWebm: boolean | null = null;

export function canPlayWebm(): boolean {
  if (_canPlayWebm === null) {
    try {
      const audio = document.createElement('audio');
      _canPlayWebm = audio.canPlayType('audio/webm; codecs=opus') !== '';
    } catch {
      _canPlayWebm = false;
    }
  }
  return _canPlayWebm;
}
