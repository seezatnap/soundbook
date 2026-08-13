/*
 * Lookahead scheduler. A coarse JS interval walks a beat frontier; events
 * are pulled just-in-time from the lab's pure pattern function for each
 * beat window and scheduled at exact AudioContext times. Because the pull
 * happens ~0.2s ahead, param changes take effect within the lookahead
 * without ever rebuilding a timeline.
 */

import type { BeatRange, NoteEvent } from '@/sdk/events';
import type { Transport } from '@/engine/transport';

const TICK_MS = 40;
const HORIZON_S = 0.22;
const CHUNK_BEATS = 0.5;

export interface ScheduledEvent {
  event: NoteEvent;
  /** AudioContext time the event fires. */
  when: number;
}

type EventSource = (range: BeatRange) => NoteEvent[];
type TriggerFn = (event: NoteEvent, when: number) => void;

export class Scheduler {
  private readonly transport: Transport;
  private readonly now: () => number;
  private source: EventSource = () => [];
  private trigger: TriggerFn = () => {};
  private frontier = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Ring of recently scheduled events for inspectors and stage flashes. */
  readonly performed: ScheduledEvent[] = [];
  private performedCap = 256;
  onScheduled: ((batch: ScheduledEvent[]) => void) | null = null;

  constructor(transport: Transport, now: () => number) {
    this.transport = transport;
    this.now = now;
  }

  setSource(source: EventSource): void {
    this.source = source;
  }

  setTrigger(trigger: TriggerFn): void {
    this.trigger = trigger;
  }

  start(): void {
    if (this.timer) return;
    this.frontier = this.transport.beat();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Call after any seek/tempo change so the frontier tracks the playhead. */
  resync(): void {
    this.frontier = this.transport.beat();
  }

  /** While stopped: perform one beat immediately, then advance the playhead. */
  step(): ScheduledEvent[] {
    const from = this.transport.beat();
    const events = this.source({ from, to: from + 1 });
    const at = this.now() + 0.03;
    const batch: ScheduledEvent[] = [];
    for (const event of events) {
      /* Preserve intra-beat spacing while compressing the wait to "now". */
      const when = at + (event.beat - from) / (this.transport.tempo / 60);
      this.trigger(event, when);
      batch.push({ event, when });
    }
    this.record(batch);
    this.transport.seek(from + 1);
    return batch;
  }

  private tick(): void {
    if (this.transport.state !== 'playing') return;
    const deadline = this.now() + HORIZON_S;
    /* Guard: if the tab slept, jump the frontier instead of burst-scheduling. */
    const here = this.transport.beat();
    if (this.frontier < here - CHUNK_BEATS) this.frontier = here;

    while (this.transport.timeAtBeat(this.frontier) < deadline) {
      const range: BeatRange = { from: this.frontier, to: this.frontier + CHUNK_BEATS };
      const events = this.source(range);
      const batch: ScheduledEvent[] = [];
      for (const event of events) {
        let when = this.transport.timeAtBeat(event.beat);
        /* Drop truly stale events, but nudge barely-late ones (the beat-0
           event always races the first tick after play) to "now". */
        if (when < this.now() - 0.06) continue;
        when = Math.max(when, this.now() + 0.003);
        this.trigger(event, when);
        batch.push({ event, when });
      }
      this.record(batch);
      this.frontier += CHUNK_BEATS;
    }
  }

  private record(batch: ScheduledEvent[]): void {
    if (batch.length === 0) return;
    this.performed.push(...batch);
    if (this.performed.length > this.performedCap) {
      this.performed.splice(0, this.performed.length - this.performedCap);
    }
    this.onScheduled?.(batch);
  }
}
