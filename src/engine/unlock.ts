/*
 * Mobile audio unlock, following the hexforge recipe. iOS routes a bare Web
 * Audio context through the RINGER channel: with the phone's silent switch
 * on, the context reports 'running' while every sample goes to a muted
 * channel. Playing a real HTML media element flips the app's audio session
 * to the PLAYBACK category, which ignores the silent switch; keeping a
 * silent looping element alive holds that routing through interruptions.
 * The element must start synchronously inside the unlock gesture (before
 * any await), or iOS discards the user activation.
 *
 * Call `unlockAudio(ctx)` directly from the play/step gesture. Once audio
 * has been enabled, interruptions (calls, Siri, backgrounding, route
 * changes) are quietly recovered on the next return to the page.
 */

const SILENT_WAV =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

let mediaKeepAlive: HTMLAudioElement | null = null;

/*
 * iOS 17+ Audio Session API: declare media-playback semantics so CarPlay
 * and the lock screen treat this session as music rather than UI sounds —
 * the playback category gets the media route's buffering instead of the
 * chatty low-latency one. Feature-detected; a no-op everywhere else.
 */
function claimPlaybackSession(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* Older WebKit shapes of the experiment; the media element still
         carries the category claim. */
    }
  }
}

function claimMediaChannel(): void {
  if (typeof Audio === 'undefined') return;
  try {
    if (!mediaKeepAlive) {
      mediaKeepAlive = new Audio(SILENT_WAV);
      mediaKeepAlive.loop = true;
      mediaKeepAlive.preload = 'auto';
      mediaKeepAlive.setAttribute('playsinline', '');
      (mediaKeepAlive as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      /* In the DOM, not detached: WebKit's Now Playing card needs a real
         activation target for its tap-through to focus the app. */
      mediaKeepAlive.setAttribute('aria-hidden', 'true');
      document.body.appendChild(mediaKeepAlive);
    }
    void mediaKeepAlive.play().catch(() => {
      /* Autoplay refused outside a gesture; the next unlock retries. */
    });
  } catch {
    /* No media element support: the ringer channel will have to do. */
  }
}

function primeAudio(ctx: AudioContext): void {
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start();
  } catch {
    /* Reaching 'running' is the authoritative signal; the silent
       one-sample source is an extra compatibility nudge for older WebKit. */
  }
}

let everEnabled = false;
let recoveryHooked = false;
let recoverCtx: AudioContext | null = null;

function recoverAudio(): void {
  if (!everEnabled) return;
  const ctx = recoverCtx;
  if (ctx && (ctx.state as string) !== 'running' && ctx.state !== 'closed') {
    void ctx.resume().catch(() => {});
  }
  if (mediaKeepAlive && mediaKeepAlive.paused) {
    void mediaKeepAlive.play().catch(() => {});
  }
}

function hookRecovery(): void {
  if (recoveryHooked || typeof document === 'undefined') return;
  recoveryHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recoverAudio();
  });
  window.addEventListener('focus', recoverAudio);
  window.addEventListener('pageshow', recoverAudio);
  /* Route changes (CarPlay connecting, headphones in or out) can leave the
     context suspended or the keep-alive paused without any new gesture. */
  navigator.mediaDevices?.addEventListener?.('devicechange', recoverAudio);
}

/** Call directly from a user gesture, before any await. */
export function unlockAudio(ctx: AudioContext): void {
  /* Synchronously, while the gesture's user activation still stands. */
  claimPlaybackSession();
  claimMediaChannel();
  recoverCtx = ctx;
  void ctx
    .resume()
    .then(() => {
      if (ctx.state === 'running') {
        primeAudio(ctx);
        everEnabled = true;
        hookRecovery();
      }
    })
    .catch(() => {});
}
