/*
 * Concordance No. 1: the composition contract. The generic determinism
 * suite already covers it via the registry; these tests pin the promises
 * specific to a composition — the piece ends, the sources pass through
 * bit-identical when the harmonizer is bypassed, the consensus is a stable
 * property of the documents, and the register shifts (score curve and
 * stars-shift knob) behave exactly as the docs claim.
 */

import { describe, expect, it } from 'vitest';
import { defaultsOf } from '@/sdk/params';
import { consensusKey, freqToMidi, keyLabel, retuneFreq } from '@/labs/shared/harmonize';
import { concordance, concordanceConsensus } from '@/labs/concordance';

const params = defaultsOf(concordance.params);
const seed = 1;
const TOTAL = concordance.pieceBeats!;

describe('autoharmonizer', () => {
  it('elects the obvious key for an unambiguous corpus', () => {
    /* Pure C major triad, heavily weighted: any mode containing C-E-G with
       C as the strongest root should win the tie-break on root weight. */
    const key = consensusKey([
      { freq: 261.63, weight: 10 },
      { freq: 329.63, weight: 5 },
      { freq: 392.0, weight: 5 },
    ]);
    expect(key.rootPc).toBe(0);
    expect(key.fit).toBeGreaterThan(0.99);
  });

  it('retunes by the minimum distance and respects the amount knob', () => {
    /* 38 Hz sits between D1 (36.71) and D#1 (38.89). Against C major the
       nearest scale tone is D1, 63-odd cents down. */
    const full = retuneFreq(38, 0, [0, 2, 4, 5, 7, 9, 11], 1);
    expect(full.targetMidi).toBe(26);
    expect(full.cents).toBeLessThan(0);
    expect(full.freq).toBeCloseTo(36.71, 1);
    const half = retuneFreq(38, 0, [0, 2, 4, 5, 7, 9, 11], 0.5);
    expect(freqToMidi(half.freq)).toBeCloseTo((freqToMidi(38) + 26) / 2, 5);
    /* Amount 0 and in-scale tones pass through bit-identical. */
    expect(retuneFreq(38, 0, [0, 2, 4, 5, 7, 9, 11], 0).freq).toBe(38);
    expect(retuneFreq(440, 0, [0, 2, 4, 5, 7, 9, 11], 1).freq).toBe(440);
  });

  it('elects a stable, near-unanimous consensus for the documents', () => {
    const key = concordanceConsensus();
    /* The loom's A pentatonic, the D-rooted sparks and the A0 drone share
       one seven-note set — the election should be all but unanimous. */
    expect(key.fit).toBeGreaterThan(0.98);
    expect(key.intervals.length).toBeGreaterThanOrEqual(6);
    /* Pin the election so a score change that shifts the key is loud. */
    expect(keyLabel(key)).toMatchInlineSnapshot(`"A major"`);
  });
});

describe('concordance score', () => {
  it('is a three-minute piece at the authored tempo', () => {
    expect(TOTAL / (120 / 60)).toBe(180);
  });

  it('ends: no events at or past the final beat', () => {
    expect(concordance.events({ params, seed, range: { from: TOTAL, to: TOTAL + 64 } })).toEqual([]);
    const tail = concordance.events({ params, seed, range: { from: TOTAL - 16, to: TOTAL } });
    expect(tail.length).toBeGreaterThan(0);
    for (const ev of tail) expect(ev.beat).toBeLessThan(TOTAL);
  });

  it('tags every event with its track, section and correction', () => {
    const events = concordance.events({ params, seed, range: { from: 100, to: 108 } });
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      const track = ev.data?.track as string;
      expect(['drone', 'sparks', 'stars']).toContain(track);
      expect(ev.voice.startsWith(`${track}:`)).toBe(true);
      expect(typeof ev.data?.cents).toBe('number');
      expect(ev.provenance[0].rule.startsWith('score(')).toBe(true);
      expect(ev.provenance.some((c) => c.rule.startsWith('harmonize('))).toBe(true);
      expect(ev.provenance.some((c) => c.rule.startsWith('source('))).toBe(true);
    }
  });

  it('bypassed, every source keeps its exact published tuning', () => {
    /* Outside §IV's shift window the loom, room and drone carry their
       written frequencies bit-identical when the harmonizer is off. */
    const off = concordance.events({
      params: { ...params, harmonize: 0 },
      seed,
      range: { from: 0, to: 144 },
    });
    const drone = off.filter((ev) => ev.data?.track === 'drone');
    expect(drone.length).toBeGreaterThan(0);
    for (const ev of drone) expect(ev.freq).toBe(27.5);
    /* The trio already agrees: even at full harmonize the drone's A0 is a
       consensus tone and passes through untouched. */
    const on = concordance
      .events({ params, seed, range: { from: 0, to: 16 } })
      .filter((ev) => ev.data?.track === 'drone');
    for (const ev of on) expect(ev.freq).toBe(27.5);
    /* And everything before the argument needs no correction at all. */
    const early = concordance.events({ params, seed, range: { from: 96, to: 144 } });
    for (const ev of early) expect(Math.abs(ev.data?.cents as number)).toBeLessThan(0.5);
  });

  it('§IV drags the loom up the score curve', () => {
    /* The loom's figures repeat every 24 beats, so cells 24k beats apart
       share a written pitch; with the harmonizer off, the only difference
       is the score's shift curve. Beat 120 sits before the argument (curve
       0), beat 168 on the tritone hold (curve 6). */
    const grab = (from: number, to: number) =>
      concordance
        .events({ params: { ...params, harmonize: 0 }, seed, range: { from, to } })
        .filter((ev) => ev.data?.track === 'stars');
    const before = grab(120, 122);
    const during = grab(168, 170);
    expect(before.length).toBeGreaterThan(0);
    expect(during.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(during[i].data?.shift).toBe(6);
      expect(during[i].freq / before[i].freq).toBeCloseTo(Math.pow(2, 6 / 12), 6);
    }
    /* At full harmonize the tritone hold is pulled back into the key. */
    const negotiated = concordance
      .events({ params, seed, range: { from: 168, to: 170 } })
      .filter((ev) => ev.data?.track === 'stars');
    const key = concordanceConsensus();
    for (const ev of negotiated) {
      expect(Math.abs(retuneFreq(ev.freq, key.rootPc, key.intervals, 1).cents)).toBeLessThan(0.5);
    }
  });

  it('the stars-shift knob widely shifts the loom and only the loom', () => {
    const base = concordance.events({
      params: { ...params, harmonize: 0 },
      seed,
      range: { from: 96, to: 112 },
    });
    const up = concordance.events({
      params: { ...params, harmonize: 0, starsShift: 12 },
      seed,
      range: { from: 96, to: 112 },
    });
    expect(up.length).toBe(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(up[i].id).toBe(base[i].id);
      const ratio = up[i].freq / base[i].freq;
      if (up[i].data?.track === 'stars') expect(ratio).toBeCloseTo(2, 9);
      else expect(ratio).toBe(1);
    }
  });

  it('transpose shifts sources and consensus together', () => {
    const base = concordance.events({ params, seed, range: { from: 96, to: 104 } });
    const up = concordance.events({
      params: { ...params, transpose: 3 },
      seed,
      range: { from: 96, to: 104 },
    });
    expect(up.length).toBe(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(up[i].id).toBe(base[i].id);
      expect(freqToMidi(up[i].freq) - freqToMidi(base[i].freq)).toBeCloseTo(3, 3);
    }
  });

  it('follows the arrangement: entrances and exits at the section marks', () => {
    const all = concordance.events({ params, seed, range: { from: 0, to: TOTAL } });
    const firstBeat = (track: string): number =>
      all.find((ev) => ev.data?.track === track)!.beat;
    const lastBeat = (track: string): number =>
      all.filter((ev) => ev.data?.track === track).at(-1)!.beat;
    expect(firstBeat('drone')).toBe(0);
    expect(firstBeat('sparks')).toBeGreaterThanOrEqual(32);
    expect(firstBeat('stars')).toBeGreaterThanOrEqual(96);
    expect(lastBeat('stars')).toBeLessThan(320);
    expect(lastBeat('sparks')).toBeLessThan(352);
    for (const ev of all) {
      expect(ev.gain).toBeGreaterThan(0);
      expect(ev.gain).toBeLessThanOrEqual(1);
    }
  });
});
