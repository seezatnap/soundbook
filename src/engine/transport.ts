/*
 * Beat-domain transport over the AudioContext clock. One per tab, owned by
 * the shell. Position is derived, never accumulated, so seeking and tempo
 * changes stay exact: beat(t) = anchorBeat + (t - anchorTime) * bps.
 */

export type TransportState = 'stopped' | 'playing';

export class Transport {
  private readonly now: () => number;
  private anchorBeat = 0;
  private anchorTime = 0;
  private bps = 2; // 120 BPM
  state: TransportState = 'stopped';

  constructor(now: () => number) {
    this.now = now;
  }

  get tempo(): number {
    return this.bps * 60;
  }

  /** Current position in beats. */
  beat(): number {
    if (this.state === 'stopped') return this.anchorBeat;
    return this.anchorBeat + (this.now() - this.anchorTime) * this.bps;
  }

  /** AudioContext time at which a given beat occurs (playing only). */
  timeAtBeat(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) / this.bps;
  }

  play(): void {
    if (this.state === 'playing') return;
    this.anchorTime = this.now();
    this.state = 'playing';
  }

  stop(): void {
    if (this.state === 'stopped') return;
    this.anchorBeat = this.beat();
    this.state = 'stopped';
  }

  seek(beat: number): void {
    this.anchorBeat = Math.max(0, beat);
    this.anchorTime = this.now();
  }

  setTempo(bpm: number): void {
    /* Re-anchor first so position is continuous through the change. */
    const here = this.beat();
    this.anchorBeat = here;
    this.anchorTime = this.now();
    this.bps = Math.min(300, Math.max(20, bpm)) / 60;
  }
}
