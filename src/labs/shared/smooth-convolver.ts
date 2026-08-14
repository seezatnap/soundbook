/*
 * A convolver whose impulse response can change without killing the sound.
 * Assigning ConvolverNode.buffer resets the node's internal state — the
 * whole tail dies instantly, which turns any live IR edit (or an A/B morph
 * scrub interpolating room params every tick) into seconds of silence while
 * the reverb rebuilds. Two convolvers behind a crossfade fix both halves:
 * rebuilds are debounced until the key stops changing, and when the new
 * room lands it fades in while the old tail rings out.
 *
 * Engine-side only — nothing here touches events or determinism. Timers
 * never run during offline WAV rendering: the first set() builds
 * synchronously, and update() is never called mid-render.
 */

const SETTLE_MS = 120;
/** setTargetAtTime constants: ~5τ to land. New room in ~150 ms… */
const FADE_IN_TAU = 0.03;
/** …while the old tail breathes out over ~400 ms instead of being cut. */
const RING_OUT_TAU = 0.08;

export interface SmoothConvolver {
  /** Feed sources here. */
  readonly input: GainNode;
  /** Take the reverberated signal from here. */
  readonly output: GainNode;
  /**
   * Ask for the IR identified by `key`; `build` runs only if it is needed.
   * Same key as current: no-op (a pending swap back to it is cancelled).
   * First key ever: built synchronously at full gain. Anything after:
   * debounced until the key settles, then crossfaded in.
   */
  set(key: string, build: () => AudioBuffer): void;
  dispose(): void;
}

export function makeSmoothConvolver(ctx: BaseAudioContext): SmoothConvolver {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const convs = [ctx.createConvolver(), ctx.createConvolver()];
  const fades = [ctx.createGain(), ctx.createGain()];
  for (let i = 0; i < 2; i++) {
    input.connect(convs[i]);
    convs[i].connect(fades[i]);
    fades[i].connect(output);
    fades[i].gain.value = 0;
  }
  let active = 0;
  let currentKey = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    input,
    output,
    set(key, build) {
      if (key === currentKey) {
        cancel();
        return;
      }
      if (!currentKey) {
        convs[active].buffer = build();
        fades[active].gain.value = 1;
        currentKey = key;
        return;
      }
      cancel();
      timer = setTimeout(() => {
        timer = null;
        const next = 1 - active;
        convs[next].buffer = build();
        const now = ctx.currentTime;
        fades[active].gain.setTargetAtTime(0, now, RING_OUT_TAU);
        fades[next].gain.setTargetAtTime(1, now, FADE_IN_TAU);
        active = next;
        currentKey = key;
      }, SETTLE_MS);
    },
    dispose() {
      cancel();
      input.disconnect();
      convs.forEach((conv) => conv.disconnect());
      fades.forEach((fade) => fade.disconnect());
      output.disconnect();
    },
  };
}
