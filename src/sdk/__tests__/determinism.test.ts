/*
 * The core promises, enforced: stable PRNG streams, deterministic events,
 * seek-equals-listen, URL round-trips, and honest euclidean math. These run
 * in Node — every lab's pattern function is UI- and audio-free by contract.
 */

import { describe, expect, it } from 'vitest';
import { deriveSeed, makeRng, rngFor } from '@/sdk/prng';
import { defaultsOf, diffFromDefaults, morphParams, randomizeParams, sanitizeAll } from '@/sdk/params';
import { encodeState, decodeState } from '@/sdk/codec';
import { sortEvents } from '@/sdk/events';
import { euclid, lcmAll, rotate } from '@/labs/shared/music';
import { LABS, findLab } from '@/labs/registry';

describe('prng', () => {
  it('is stable across runs for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('derives independent, order-free streams per key', () => {
    const first = rngFor(7, 'melody', 3).next();
    rngFor(7, 'other', 99).next(); // consuming another stream must not matter
    const second = rngFor(7, 'melody', 3).next();
    expect(first).toBe(second);
    expect(deriveSeed(7, 'a')).not.toBe(deriveSeed(7, 'b'));
  });

  it('produces uniform-ish values in [0,1)', () => {
    const rng = makeRng(42);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
});

describe('euclid', () => {
  it('matches the canonical patterns', () => {
    const asString = (p: boolean[]): string => p.map((x) => (x ? 'x' : '.')).join('');
    expect(asString(euclid(3, 8))).toBe('x..x..x.');
    expect(asString(euclid(5, 16))).toBe('x..x..x..x..x...');
    expect(asString(euclid(4, 4))).toBe('xxxx');
    expect(asString(euclid(0, 8))).toBe('........');
  });

  it('always places pulses = k and starts on step 0', () => {
    for (let n = 1; n <= 24; n++) {
      for (let k = 1; k <= n; k++) {
        const pattern = euclid(k, n);
        expect(pattern.filter(Boolean).length).toBe(k);
        expect(pattern[0]).toBe(true);
      }
    }
  });

  it('rotates without losing pulses', () => {
    const pattern = euclid(5, 13);
    for (let r = 0; r < 13; r++) {
      expect(rotate(pattern, r).filter(Boolean).length).toBe(5);
    }
  });
});

describe('every lab', () => {
  for (const lab of LABS) {
    describe(lab.id, () => {
      const params = defaultsOf(lab.params);
      const seed = 1234;

      it('produces identical events for identical inputs', () => {
        const a = lab.events({ params, seed, range: { from: 0, to: 16 } });
        const b = lab.events({ params, seed, range: { from: 0, to: 16 } });
        expect(a).toEqual(b);
        expect(a.length).toBeGreaterThan(0);
      });

      it('changes events when the seed changes', () => {
        const a = lab.events({ params, seed: 1, range: { from: 0, to: 32 } });
        const b = lab.events({ params, seed: 2, range: { from: 0, to: 32 } });
        /* Every lab routes some decision through the seed. */
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
      });

      it('seeking reproduces the listened-to sequence (chunk independence)', () => {
        const whole = sortEvents(lab.events({ params, seed, range: { from: 0, to: 24 } }));
        const chunks: typeof whole = [];
        for (let b = 0; b < 24; b += 0.5) {
          chunks.push(...lab.events({ params, seed, range: { from: b, to: b + 0.5 } }));
        }
        expect(sortEvents(chunks)).toEqual(whole);
        /* Jumping straight to a far window equals the same slice of a longer listen. */
        const far = sortEvents(lab.events({ params, seed, range: { from: 100, to: 108 } }));
        const viaLong = sortEvents(
          lab.events({ params, seed, range: { from: 0, to: 200 } }),
        ).filter((ev) => ev.beat >= 100 && ev.beat < 108);
        expect(far).toEqual(viaLong);
      });

      it('emits events inside the requested range with provenance', () => {
        const events = lab.events({ params, seed, range: { from: 8, to: 12 } });
        for (const ev of events) {
          expect(ev.beat).toBeGreaterThanOrEqual(8);
          expect(ev.beat).toBeLessThan(12);
          expect(ev.provenance.length).toBeGreaterThan(0);
          expect(ev.freq).toBeGreaterThan(10);
          expect(ev.freq).toBeLessThan(20000);
          expect(ev.gain).toBeGreaterThan(0);
          expect(ev.gain).toBeLessThanOrEqual(1);
        }
      });

      it('round-trips through the URL codec', async () => {
        const rng = makeRng(99);
        const randomized = randomizeParams(lab.params, params, new Set(), rng);
        const state = {
          labId: lab.id,
          version: lab.version,
          seed: 987654321,
          tempo: 133,
          params: randomized,
          b: params,
        };
        const payload = await encodeState(state, lab);
        expect(payload).toMatch(/^1\./);
        const decoded = await decodeState(payload, findLab);
        expect(decoded).not.toBeNull();
        expect(decoded!.labId).toBe(lab.id);
        expect(decoded!.seed).toBe(987654321);
        expect(decoded!.tempo).toBe(133);
        expect(decoded!.params).toEqual(randomized);
        expect(decoded!.b).toEqual(params);
        /* The promise behind the promise: decoded state → identical events. */
        const before = lab.events({ params: randomized, seed: state.seed, range: { from: 0, to: 8 } });
        const after = lab.events({
          params: decoded!.params,
          seed: decoded!.seed,
          range: { from: 0, to: 8 },
        });
        expect(after).toEqual(before);
      });

      it('has 5–10 params (per tab when grouped), stories, docs and a positive cycle', () => {
        if (lab.paramGroups) {
          /* A console lab partitions its params into tabs of 5–10 each:
             every key in exactly one group, no strays, no dumping ground. */
          const grouped = lab.paramGroups.flatMap((group) => group.keys);
          expect(new Set(grouped).size).toBe(grouped.length);
          expect([...grouped].sort()).toEqual(lab.params.map((p) => p.key).sort());
          for (const group of lab.paramGroups) {
            expect(group.keys.length).toBeGreaterThanOrEqual(5);
            expect(group.keys.length).toBeLessThanOrEqual(10);
          }
        } else {
          expect(lab.params.length).toBeGreaterThanOrEqual(5);
          expect(lab.params.length).toBeLessThanOrEqual(10);
        }
        expect(lab.stories.length).toBeGreaterThanOrEqual(2);
        expect(lab.docs.length).toBeGreaterThan(100);
        expect(lab.cycleBeats(params)).toBeGreaterThan(0);
        for (const story of lab.stories) {
          /* Story params must be legal under the schema. */
          const merged = sanitizeAll(lab.params, { ...params, ...story.params });
          for (const [key, value] of Object.entries(story.params)) {
            expect(merged[key]).toBe(value);
          }
        }
      });
    });
  }
});

describe('params machinery', () => {
  const lab = LABS[0];

  it('drops unknown keys and repairs bad values', () => {
    const dirty = { freq: 'nonsense', evil: 666, unison: 3.7 };
    const clean = sanitizeAll(lab.params, dirty);
    expect(clean.freq).toBe(220); // default restored
    expect('evil' in clean).toBe(false);
    expect(clean.unison).toBe(4); // rounded into range
  });

  it('omits defaults from the sparse diff', () => {
    const values = { ...defaultsOf(lab.params), freq: 440 };
    expect(diffFromDefaults(lab.params, values)).toEqual({ freq: 440 });
  });

  it('randomize respects locks and stays in range', () => {
    const defaults = defaultsOf(lab.params);
    const rng = makeRng(5);
    const out = randomizeParams(lab.params, defaults, new Set(['freq']), rng);
    expect(out.freq).toBe(defaults.freq);
    for (const spec of lab.params) {
      if (spec.kind === 'number' || spec.kind === 'int') {
        expect(out[spec.key] as number).toBeGreaterThanOrEqual(spec.min);
        expect(out[spec.key] as number).toBeLessThanOrEqual(spec.max);
      }
    }
  });

  it('morph blends continuous params and switches discrete at midpoint', () => {
    const a = defaultsOf(lab.params);
    const b = { ...a, freq: (a.freq as number) + 100, wave: 'square' };
    const mid = morphParams(lab.params, a, b, 0.5);
    expect(mid.freq).toBe((a.freq as number) + 50);
    expect(morphParams(lab.params, a, b, 0.49).wave).toBe(a.wave);
    expect(morphParams(lab.params, a, b, 0.51).wave).toBe('square');
  });

  it('oscillator morph hook averages differing waveforms instead of switching', () => {
    const osc = findLab('oscillator-microscope')!;
    const a = defaultsOf(osc.params); // wave: sine
    const b = { ...a, wave: 'sawtooth' };
    const mid = osc.morph!(a, b, 0.35);
    expect(mid.params.wave).toBe('sine');
    expect(mid.params.waveB).toBe('sawtooth');
    expect(mid.params.blend).toBe(0.35);
    expect(mid.blended).toContain('wave');
    /* Same wave on both slots: nothing to blend, default rules apply. */
    const plain = osc.morph!(a, { ...a }, 0.35);
    expect(plain.blended).toEqual([]);
    /* At the endpoints the slots' own values hold exactly. */
    expect(osc.morph!(a, b, 1).params.wave).toBe('sawtooth');
  });
});

describe('codec hardening', () => {
  it('rejects garbage payloads gracefully', async () => {
    expect(await decodeState('garbage', findLab)).toBeNull();
    expect(await decodeState('1.%%%%', findLab)).toBeNull();
    expect(await decodeState('9.AAAA', findLab)).toBeNull();
  });

  it('locks round-trip and unknown lock keys are dropped', async () => {
    const lab = LABS[0];
    const state = {
      labId: lab.id,
      version: lab.version,
      seed: 1,
      tempo: 120,
      params: defaultsOf(lab.params),
      locked: ['unison', 'evil', 'freq', 'freq'],
    };
    const payload = await encodeState(state, lab);
    const decoded = await decodeState(payload, findLab);
    expect(decoded!.locked).toEqual(['freq', 'unison']);
    /* No locks: the field stays out of the wire format entirely. */
    const bare = await encodeState({ ...state, locked: [] }, lab);
    expect((await decodeState(bare, findLab))!.locked).toBeUndefined();
    /* Transport controls can't be locked — stale entries are pruned. */
    const dl = findLab('drone-lab')!;
    const pruned = await encodeState(
      {
        labId: dl.id,
        version: dl.version,
        seed: 1,
        tempo: 120,
        params: defaultsOf(dl.params),
        locked: ['loop', 'fadeBeats', 'harmonize'],
      },
      dl,
    );
    expect((await decodeState(pruned, findLab))!.locked).toEqual(['harmonize']);
  });

  it('rejects unknown labs', async () => {
    const lab = LABS[0];
    const payload = await encodeState(
      { labId: lab.id, version: 1, seed: 1, tempo: 120, params: defaultsOf(lab.params) },
      lab,
    );
    expect(await decodeState(payload, () => undefined)).toBeNull();
  });
});

describe('polymeter arithmetic', () => {
  it('lcm of the default loom closes at 420 steps', () => {
    expect(lcmAll([3, 4, 5, 7])).toBe(420);
  });
});
