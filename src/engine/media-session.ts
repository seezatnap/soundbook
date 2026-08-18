/*
 * Lock-screen transport. The mobile unlock's silent keep-alive claims the
 * platform audio session, which makes iOS show a Now Playing card — but
 * without Media Session handlers its buttons drive nothing. This module
 * gives the card real controls (play, pause, rewind), a title and artwork,
 * and an honest position readout for through-composed pieces. Feature-
 * detected throughout; a no-op where the API is missing.
 */

const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

export function mediaSessionMetadata(title: string): void {
  if (!supported) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Soundbook',
      artwork: [
        { src: '/icon-180.png', sizes: '180x180', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch {
    /* Older WebKit shapes of MediaMetadata. */
  }
}

export function mediaSessionHandlers(handlers: {
  play(): void;
  pause(): void;
  rewind(): void;
}): void {
  if (!supported) return;
  const ms = navigator.mediaSession;
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null): void => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      /* Not every action exists on every platform. */
    }
  };
  set('play', handlers.play);
  set('pause', handlers.pause);
  set('stop', handlers.pause);
  set('previoustrack', handlers.rewind);
  set('nexttrack', null);
  set('seekbackward', null);
  set('seekforward', null);
}

export function mediaSessionPlaybackState(playing: boolean): void {
  if (!supported) return;
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

/** Report position for a finite piece; endless labs skip the readout. */
export function mediaSessionPosition(durationSec: number | null, positionSec: number): void {
  if (!supported || !('setPositionState' in navigator.mediaSession)) return;
  try {
    if (durationSec === null || !(durationSec > 0)) return;
    navigator.mediaSession.setPositionState({
      duration: durationSec,
      position: Math.max(0, Math.min(durationSec, positionSec)),
      playbackRate: 1,
    });
  } catch {
    /* Invalid states are worth less than a working card. */
  }
}
