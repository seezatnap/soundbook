/*
 * Transport math under a fake clock: position is derived, never
 * accumulated, so tempo changes and seeks must be exact and continuous.
 */

import { describe, expect, it } from 'vitest';
import { Transport } from '@/engine/transport';

function fakeClock(): { now: () => number; advance: (s: number) => void } {
  let t = 0;
  return { now: () => t, advance: (s) => (t += s) };
}

describe('transport', () => {
  it('advances beats at the tempo rate while playing', () => {
    const clock = fakeClock();
    const transport = new Transport(clock.now);
    transport.setTempo(120); // 2 beats/sec
    transport.play();
    clock.advance(3);
    expect(transport.beat()).toBeCloseTo(6, 10);
  });

  it('holds position while stopped and resumes exactly', () => {
    const clock = fakeClock();
    const transport = new Transport(clock.now);
    transport.setTempo(120);
    transport.play();
    clock.advance(2);
    transport.stop();
    clock.advance(100);
    expect(transport.beat()).toBeCloseTo(4, 10);
    transport.play();
    clock.advance(1);
    expect(transport.beat()).toBeCloseTo(6, 10);
  });

  it('keeps position continuous through a tempo change', () => {
    const clock = fakeClock();
    const transport = new Transport(clock.now);
    transport.setTempo(120);
    transport.play();
    clock.advance(2); // beat 4
    transport.setTempo(60); // 1 beat/sec from here
    expect(transport.beat()).toBeCloseTo(4, 10);
    clock.advance(2);
    expect(transport.beat()).toBeCloseTo(6, 10);
  });

  it('maps beats to times consistently with seek', () => {
    const clock = fakeClock();
    const transport = new Transport(clock.now);
    transport.setTempo(90);
    transport.seek(10);
    transport.play();
    expect(transport.timeAtBeat(10)).toBeCloseTo(clock.now(), 10);
    expect(transport.timeAtBeat(13)).toBeCloseTo(clock.now() + 2, 10); // 90bpm: 1.5 b/s
  });
});
