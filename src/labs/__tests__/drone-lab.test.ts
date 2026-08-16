/*
 * DroneLab No. 1: the console contract. The generic determinism suite
 * already covers it via the registry; these tests pin what makes DroneLab
 * DroneLab — the §III plateau is flat and full-length, the loop wraps as an
 * exact repeat, loop-off ends the piece, one master seed drives every
 * layer, and each tab's params reach exactly their own layer.
 */

import { describe, expect, it } from 'vitest';
import { defaultsOf, morphParams, randomizeParams } from '@/sdk/params';
import { makeRng } from '@/sdk/prng';
import { droneLab, droneLabSubseed } from '@/labs/drone-lab';

const params = defaultsOf(droneLab.params);
const seed = 1;
const TOTAL = droneLab.pieceBeats!;
const TRACKS = ['drone', 'sparks', 'stars'] as const;

const grab = (
  overrides: Record<string, number | string | boolean>,
  from: number,
  to: number,
  theSeed = seed,
) => droneLab.events({ params: { ...params, ...overrides }, seed: theSeed, range: { from, to } });

describe('the plateau', () => {
  it('is a three-minute track at the authored tempo', () => {
    expect(TOTAL / (120 / 60)).toBe(180);
  });

  it('holds every layer for the whole track — no entrances, no exits', () => {
    const all = grab({}, 0, TOTAL);
    for (const track of TRACKS) {
      const own = all.filter((ev) => ev.data?.track === track);
      expect(own.length).toBeGreaterThan(0);
      expect(own[0].beat).toBeLessThan(16);
      expect(own.at(-1)!.beat).toBeGreaterThan(TOTAL - 16);
    }
    for (const ev of all) {
      expect(ev.gain).toBeGreaterThan(0);
      expect(ev.gain).toBeLessThanOrEqual(1);
      expect(ev.provenance[0].rule).toBe('plateau(§III)');
    }
  });

  it('is flat: a layer’s gains stay inside the plateau’s wobble band', () => {
    /* Level 0.85 on the drone, source gain 0.5 ± 0.04, wobble ±5% — every
       onset lands in one narrow band; an arc would leave it. */
    const drones = grab({}, 0, TOTAL).filter((ev) => ev.data?.track === 'drone');
    for (const ev of drones) {
      expect(ev.gain).toBeGreaterThan(0.85 * 0.46 * 0.95 - 1e-9);
      expect(ev.gain).toBeLessThan(0.85 * 0.54 * 1.05 + 1e-9);
    }
  });
});

describe('the loop', () => {
  it('wraps as an exact repeat: pass 1 is pass 0 shifted by 360 beats', () => {
    const first = grab({}, 0, 24);
    const second = grab({}, TOTAL, TOTAL + 24);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i].beat).toBeCloseTo(first[i].beat + TOTAL, 9);
      expect(second[i].freq).toBe(first[i].freq);
      expect(second[i].gain).toBe(first[i].gain);
      expect(second[i].voice).toBe(first[i].voice);
      expect(second[i].data?.pass).toBe(1);
      expect(first[i].data?.pass).toBe(0);
    }
  });

  it('splits windows straddling the wrap exactly as chunked listening', () => {
    const straddle = grab({}, TOTAL - 4, TOTAL + 4);
    const before = grab({}, TOTAL - 4, TOTAL);
    const after = grab({}, TOTAL, TOTAL + 4);
    expect(straddle).toEqual([...before, ...after]);
  });

  it('off, the track ends: nothing at or past the final beat', () => {
    expect(grab({ loop: false }, TOTAL, TOTAL + 64)).toEqual([]);
    const tail = grab({ loop: false }, TOTAL - 16, TOTAL);
    expect(tail.length).toBeGreaterThan(0);
    for (const ev of tail) expect(ev.beat).toBeLessThan(TOTAL);
  });
});

describe('one seed, every layer', () => {
  it('derives distinct subseeds per layer and shows none of them as params', () => {
    const subs = TRACKS.map((track) => droneLabSubseed(seed, track));
    expect(new Set(subs).size).toBe(TRACKS.length);
    /* No param stores a seed value (AutoRandomSeed's controls mention seeds
       but only steer the Reseed button — they hold a toggle and a count). */
    for (const spec of droneLab.params) {
      expect(spec.key === 'seed' || spec.key.endsWith('Seed')).toBe(false);
    }
  });

  it('changing the master seed changes every layer', () => {
    /* The drone layer's pitch grid is written by params; its seed reaches
       the gain wobble — so the comparison must include gains. */
    const a = grab({}, 0, 32, 1);
    const b = grab({}, 0, 32, 2);
    for (const track of TRACKS) {
      const of = (events: typeof a) =>
        JSON.stringify(
          events.filter((ev) => ev.data?.track === track).map((ev) => [ev.beat, ev.freq, ev.gain]),
        );
      expect(of(a)).not.toBe(of(b));
    }
  });
});

describe('the tabs', () => {
  it('loom params reach only the loom layer', () => {
    const base = grab({ harmonize: 0 }, 0, 32);
    const rewoven = grab({ harmonize: 0, lenA: 5, density: 0.5 }, 0, 32);
    const others = (events: typeof base) =>
      JSON.stringify(events.filter((ev) => ev.data?.track !== 'stars').map((ev) => [ev.beat, ev.freq]));
    const stars = (events: typeof base) =>
      JSON.stringify(events.filter((ev) => ev.data?.track === 'stars').map((ev) => [ev.beat, ev.freq]));
    expect(stars(rewoven)).not.toBe(stars(base));
    expect(others(rewoven)).toBe(others(base));
  });

  it('the wets are engine-side: events do not depend on them', () => {
    expect(grab({ wet: 0, loomWet: 1 }, 0, 32)).toEqual(grab({}, 0, 32));
  });

  it('randomize never touches the transport controls', () => {
    /* AutoRandomize presses randomize on a beat grid — if randomize could
       flip loop or AutoRandomize itself, the feature would scramble its
       own switch. noRandom pins all three. */
    const out = randomizeParams(droneLab.params, params, new Set(), makeRng(7));
    expect(out.loop).toBe(params.loop);
    expect(out.autoRandom).toBe(params.autoRandom);
    expect(out.autoRandomBeats).toBe(params.autoRandomBeats);
    expect(out.autoReseed).toBe(params.autoReseed);
    expect(out.autoReseedBeats).toBe(params.autoReseedBeats);
    expect(out.fadeBeats).toBe(params.fadeBeats);
  });

  it('morph pins the transport controls to A while musical params blend', () => {
    const b = { ...params, loop: false, autoRandomBeats: 128, fadeBeats: 16, harmonize: 0 };
    const mid = morphParams(droneLab.params, params, b, 0.6);
    expect(mid.loop).toBe(params.loop);
    expect(mid.autoRandomBeats).toBe(params.autoRandomBeats);
    expect(mid.fadeBeats).toBe(params.fadeBeats);
    expect(mid.harmonize).not.toBe(params.harmonize);
  });

  it('stars-shift moves the loom and only the loom', () => {
    const base = grab({ harmonize: 0 }, 0, 32);
    const up = grab({ harmonize: 0, starsShift: 12 }, 0, 32);
    expect(up.length).toBe(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(up[i].id).toBe(base[i].id);
      const ratio = up[i].freq / base[i].freq;
      if (up[i].data?.track === 'stars') expect(ratio).toBeCloseTo(2, 9);
      else expect(ratio).toBe(1);
    }
  });
});
