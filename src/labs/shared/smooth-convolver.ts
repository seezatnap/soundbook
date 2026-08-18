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
/** …while the old tail breathes out (~1.2 s by default) instead of cutting.
 * Callers pass a ring-out scaled to the room's own decay for longer tails. */
const RING_OUT_TAU = 0.25;

export interface SmoothConvolver {
  /** Feed sources here. */
  readonly input: GainNode;
  /** Take the reverberated signal from here. */
  readonly output: GainNode;
  /**
   * Ask for the IR identified by `key`; `build` runs only if it is needed.
   * Same key as current: no-op (a pending swap back to it is cancelled).
   * First key ever: built synchronously at full gain. Anything after:
   * debounced until the key settles, then crossfaded in — the old room
   * ringing out over `ringOutTau` (seconds, setTargetAtTime constant).
   */
  set(key: string, build: () => AudioBuffer, ringOutTau?: number): void;
  /**
   * Stop feeding the convolvers entirely — for callers whose wet is exactly
   * 0, where the convolution would compute inaudible output forever. While
   * bypassed the room starts from silence when it returns; at wet 0 the
   * output is bit-identical either way.
   */
  bypass(on: boolean): void;
  dispose(): void;
}

export function makeSmoothConvolver(ctx: BaseAudioContext): SmoothConvolver {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const convs = [ctx.createConvolver(), ctx.createConvolver()];
  const fades = [ctx.createGain(), ctx.createGain()];
  for (let i = 0; i < 2; i++) {
    convs[i].connect(fades[i]);
    fades[i].connect(output);
    fades[i].gain.value = 0;
  }
  /*
   * Convolution is the engine's most expensive DSP, and a ConvolverNode
   * convolves whatever reaches its input even when a zero gain mutes the
   * result downstream. So only the audible convolver is ever fed: the
   * retiring half is unplugged once its ring-out has died, and a bypassed
   * instance is unplugged entirely. An unfed convolver goes dormant after
   * its tail and costs nothing.
   */
  const fed = [false, false];
  const dropTimers: Array<ReturnType<typeof setTimeout> | null> = [null, null];
  let bypassed = false;
  let active = 0;
  let currentKey = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const feed = (i: number): void => {
    if (dropTimers[i]) {
      clearTimeout(dropTimers[i]!);
      dropTimers[i] = null;
    }
    if (!fed[i] && !bypassed) {
      input.connect(convs[i]);
      fed[i] = true;
    }
  };

  const unfeed = (i: number): void => {
    if (dropTimers[i]) {
      clearTimeout(dropTimers[i]!);
      dropTimers[i] = null;
    }
    if (fed[i]) {
      input.disconnect(convs[i]);
      fed[i] = false;
    }
  };

  const dropAfter = (i: number, ms: number): void => {
    if (dropTimers[i]) clearTimeout(dropTimers[i]!);
    dropTimers[i] = setTimeout(() => {
      dropTimers[i] = null;
      if (fed[i]) {
        input.disconnect(convs[i]);
        fed[i] = false;
      }
    }, ms);
  };

  const cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    input,
    output,
    set(key, build, ringOutTau = RING_OUT_TAU) {
      if (key === currentKey) {
        cancel();
        return;
      }
      if (!currentKey) {
        convs[active].buffer = build();
        fades[active].gain.value = 1;
        feed(active);
        currentKey = key;
        return;
      }
      cancel();
      timer = setTimeout(() => {
        timer = null;
        const next = 1 - active;
        convs[next].buffer = build();
        feed(next);
        const now = ctx.currentTime;
        fades[active].gain.setTargetAtTime(0, now, ringOutTau);
        fades[next].gain.setTargetAtTime(1, now, FADE_IN_TAU);
        /* Unplug the retiring half once its ring-out is inaudible (~6τ). */
        dropAfter(active, ringOutTau * 6000 + 200);
        active = next;
        currentKey = key;
      }, SETTLE_MS);
    },
    bypass(on) {
      if (on === bypassed) return;
      bypassed = on;
      if (on) {
        unfeed(0);
        unfeed(1);
      } else if (currentKey) {
        feed(active);
      }
    },
    dispose() {
      cancel();
      dropTimers.forEach((t) => t && clearTimeout(t));
      input.disconnect();
      convs.forEach((conv) => conv.disconnect());
      fades.forEach((fade) => fade.disconnect());
      output.disconnect();
    },
  };
}
