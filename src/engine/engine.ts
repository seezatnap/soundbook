/*
 * One shared Web Audio engine per tab. Direct AudioContext creation is
 * banned everywhere else; labs receive an EngineFacade and connect to its
 * `out` node, which runs through the safety chain (DC blocker → limiter)
 * before the speakers. A single analyser taps the master bus for every
 * stage view and diagnostic.
 */

import type { EngineFacade } from '@/sdk/lab';

export const MAX_VOICES = 32;

export class Engine implements EngineFacade {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  readonly analyser: AnalyserNode;
  private voices = 0;
  private readonly limiter: DynamicsCompressorNode;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;

    /* Safety chain: DC blocker, then a hard-knee compressor as limiter. */
    const dcBlock = this.ctx.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 8;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.08;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.out.connect(dcBlock);
    dcBlock.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  acquireVoice(): (() => void) | null {
    if (this.voices >= MAX_VOICES) return null;
    this.voices += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.voices = Math.max(0, this.voices - 1);
    };
  }

  get activeVoices(): number {
    return this.voices;
  }

  /** Browsers gate audio behind a user gesture; call from event handlers. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }
}

let shared: Engine | null = null;

/** The tab's single engine. Lazily built so import order never matters. */
export function getEngine(): Engine {
  if (!shared) shared = new Engine();
  return shared;
}

/*
 * Facade over an OfflineAudioContext for WAV export. Same instrument
 * factories, same voice discipline, no speakers.
 */
export class OfflineEngine implements EngineFacade {
  readonly ctx: OfflineAudioContext;
  readonly out: GainNode;
  private voices = 0;

  constructor(ctx: OfflineAudioContext) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    const dcBlock = ctx.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 8;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;
    this.out.connect(dcBlock);
    dcBlock.connect(limiter);
    limiter.connect(ctx.destination);
  }

  acquireVoice(): (() => void) | null {
    if (this.voices >= MAX_VOICES) return null;
    this.voices += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.voices = Math.max(0, this.voices - 1);
    };
  }
}
