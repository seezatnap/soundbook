/*
 * A Room That Does Not Exist: the voice contract. The instrument selector
 * must change register and timbre only — same seeded pattern, same timing,
 * same dynamics — and the default must be exactly the published sparks so
 * every pre-v2 URL and embedding composition is untouched.
 */

import { describe, expect, it } from 'vitest';
import { defaultsOf } from '@/sdk/params';
import { roomThatDoesNotExist } from '@/labs/room-that-does-not-exist';

const params = defaultsOf(roomThatDoesNotExist.params);
const seed = 14;

const grab = (overrides: Record<string, string | number> = {}) =>
  roomThatDoesNotExist.events({
    params: { ...params, ...overrides },
    seed,
    range: { from: 0, to: 16 },
  });

describe('the instrument voices', () => {
  it('defaults to the published sparks', () => {
    expect(params.voice).toBe('spark');
    const events = grab();
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(ev.voice).toBe('spark');
      expect(ev.provenance.some((c) => c.detail.includes('around MIDI 50'))).toBe(true);
    }
  });

  it('embers and bass are the same pattern at fixed lower registers', () => {
    const spark = grab();
    const mid = grab({ voice: 'mid' });
    const bass = grab({ voice: 'bass' });
    expect(mid.length).toBe(spark.length);
    expect(bass.length).toBe(spark.length);
    for (let i = 0; i < spark.length; i++) {
      /* Identical placement and dynamics… */
      expect(mid[i].id).toBe(spark[i].id);
      expect(mid[i].beat).toBe(spark[i].beat);
      expect(mid[i].gain).toBe(spark[i].gain);
      expect(bass[i].beat).toBe(spark[i].beat);
      expect(bass[i].gain).toBe(spark[i].gain);
      /* …an octave down, and an octave and a fifth down, exactly. */
      expect(mid[i].freq / spark[i].freq).toBeCloseTo(0.5, 9);
      expect(bass[i].freq / spark[i].freq).toBeCloseTo(Math.pow(2, -19 / 12), 9);
      expect(mid[i].voice).toBe('mid');
      expect(bass[i].voice).toBe('bass');
    }
  });

  it('deep bass stays where speakers can carry it', () => {
    for (const ev of grab({ voice: 'bass' })) {
      expect(ev.freq).toBeGreaterThan(30);
      expect(ev.freq).toBeLessThan(140);
    }
  });
});
