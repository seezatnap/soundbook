/*
 * DRONELAB No. 1 stage — one full pass of the 360-beat loop as a timeline:
 * one lane per layer at its plateau level, every mark with the harmonizer's
 * pull drawn as a tick, the live loop pass, and a seekable playhead.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import type { StageHit, StageRenderer } from '@/sdk/lab';
import { freqToMidi, keyLabel } from '@/labs/shared/harmonize';
import { makeLayerCache, makeThrottledMemo, type StagePalette } from '@/labs/shared/stage';
import { TOTAL_BEATS, TRACKS, droneLabConsensus, pieceEvents, sliceFor } from '@/labs/drone-lab';

const LANES = [
  { track: 'stars', label: 'LOOM', frac: 0.46, lo: 38, hi: 104 },
  /* lo reaches the bass voice's floor (~MIDI 21) so a bass-voiced Space
     layer still draws inside its lane instead of pinning to the bottom. */
  { track: 'sparks', label: 'SPARKS', frac: 0.32, lo: 21, hi: 74 },
  { track: 'drone', label: 'DRONE', frac: 0.22, lo: 14, hi: 34 },
] as const;

const PLOT = { left: 10, right: 10, top: 42, bottom: 24 };

interface LaneBox {
  track: string;
  label: string;
  y: number;
  h: number;
  lo: number;
  hi: number;
}

function laneBoxes(height: number): LaneBox[] {
  const plotH = height - PLOT.top - PLOT.bottom;
  const boxes: LaneBox[] = [];
  let y = PLOT.top;
  for (const lane of LANES) {
    const h = plotH * lane.frac;
    boxes.push({ track: lane.track, label: lane.label, y, h, lo: lane.lo, hi: lane.hi });
    y += h;
  }
  return boxes;
}

function eventXY(
  ev: NoteEvent,
  boxes: LaneBox[],
  width: number,
): { x: number; y: number; box: LaneBox } | null {
  const box = boxes.find((b) => b.track === (ev.data?.track as string));
  if (!box) return null;
  const plotW = width - PLOT.left - PLOT.right;
  const local = ((ev.beat % TOTAL_BEATS) + TOTAL_BEATS) % TOTAL_BEATS;
  const x = PLOT.left + (local / TOTAL_BEATS) * plotW;
  const midi = freqToMidi(ev.freq);
  const t = Math.min(1, Math.max(0, (box.hi - midi) / (box.hi - box.lo)));
  return { x, y: box.y + 4 + t * (box.h - 8), box };
}

function beatAtX(x: number, width: number): number {
  const plotW = width - PLOT.left - PLOT.right;
  const beat = ((x - PLOT.left) / plotW) * TOTAL_BEATS;
  return Math.min(TOTAL_BEATS, Math.max(0, beat));
}

const STAR_COLORS: Record<string, keyof StagePalette> = {
  warp: 'accent',
  weft: 'ok',
  silk: 'accent2',
  gold: 'warn',
};

export function makeStage(): StageRenderer {
  /* One full pass of the loop for display. Keyed on a fingerprint of the
     params the score actually reads, so dragging a level, wet or transport
     control recomputes nothing; keyed changes are additionally throttled so
     a fast pattern-knob drag redraws a few times a second, not sixty. */
  const scoreMemo = makeThrottledMemo<NoteEvent[]>(180);
  const scoreFor = (params: ParamValues, seed: number, nowMs: number): NoteEvent[] =>
    scoreMemo(
      JSON.stringify([
        params.harmonize,
        params.transpose,
        params.starsShift,
        params.loop,
        TRACKS.map((track) => sliceFor(track, params)),
        seed,
      ]),
      () => pieceEvents(params, seed, 0, TOTAL_BEATS),
      nowMs,
    );
  const staticLayer = makeLayerCache();
  return {
    draw(g, { params, seed, beat, recent, width: w, height: h, nowMs }, pal) {
      const score = scoreFor(params, seed, nowMs);
      const looping = params.loop as boolean;
      const liveBeat = beat;
      const pass = Math.max(0, Math.floor(liveBeat / TOTAL_BEATS));
      const boxes = laneBoxes(h);
      const plotW = w - PLOT.left - PLOT.right;
      const xAt = (b: number): number => PLOT.left + (b / TOTAL_BEATS) * plotW;
      const amount = params.harmonize as number;
      const transpose = params.transpose as number;
      const userShift = params.starsShift as number;
      const key = droneLabConsensus(params, seed);
      const label = keyLabel({
        rootPc: (((key.rootPc + transpose) % 12) + 12) % 12,
        scaleName: key.scaleName,
      });
      const dpr = g.canvas.width / Math.max(1, w);

      /* Everything the document writes — lanes, marks, ticks — is drawn once
         per document/size/palette and blitted; `score` changes identity on
         any param or seed change, so it keys the cache. Per frame only the
         header, flashes and playhead are live. */
      const stat = staticLayer(w, h, dpr, [score, pal], (og) => {
        og.fillStyle = pal.faceSunken;
        og.fillRect(0, 0, w, h);
        og.font = '11px monospace';

        /* Lanes, with the flat plateau level along each floor. */
        for (const box of boxes) {
          og.strokeStyle = pal.edgeDark;
          og.lineWidth = 1;
          og.beginPath();
          og.moveTo(PLOT.left, Math.round(box.y) + 0.5);
          og.lineTo(w - PLOT.right, Math.round(box.y) + 0.5);
          og.stroke();
          og.fillStyle = pal.inkDim;
          og.fillText(box.label, PLOT.left + 2, box.y + 11);
          const track = TRACKS.find((t) => t.id === box.track);
          if (track) {
            const y = box.y + box.h - 2 - track.level * (box.h * 0.25);
            og.strokeStyle = pal.edgeLight;
            og.beginPath();
            og.moveTo(PLOT.left, y);
            og.lineTo(w - PLOT.right, y);
            og.stroke();
          }
        }

        /* Minute marks (at the authored 120 BPM). */
        og.fillStyle = pal.inkDim;
        for (let b = 0; b <= TOTAL_BEATS; b += 120) {
          const x = xAt(b);
          og.fillText(`${Math.floor(b / 120)}:00`, Math.min(x, w - PLOT.right - 24), PLOT.top - 4);
        }
        og.fillText(
          looping ? '↻ WRAPS TO 0:00' : 'ENDS — LOOP IS OFF',
          w - PLOT.right - 110,
          h - PLOT.bottom + 12,
        );

        /* Events: one full pass, with the harmonizer's pull drawn as a tick. */
        for (const ev of score) {
          const pos = eventXY(ev, boxes, w);
          if (!pos) continue;
          const track = ev.data?.track as string;
          const innerVoice = ev.voice.slice(ev.voice.indexOf(':') + 1);
          const color =
            track === 'drone'
              ? pal.accent
              : track === 'sparks'
                ? pal.accent2
                : pal[STAR_COLORS[innerVoice] ?? 'accent2'];
          const cents = (ev.data?.cents as number) ?? 0;
          if (amount > 0 && Math.abs(cents) >= 1) {
            const semisOff = (cents * amount) / 100;
            const pxPerSemi = (pos.box.h - 8) / (pos.box.hi - pos.box.lo);
            og.strokeStyle = pal.inkDim;
            og.beginPath();
            og.moveTo(pos.x, pos.y + semisOff * pxPerSemi);
            og.lineTo(pos.x, pos.y);
            og.stroke();
          }
          og.globalAlpha = 0.4 + ev.gain * 0.6;
          og.fillStyle = color;
          if (track === 'drone') {
            const wDur = (ev.dur / TOTAL_BEATS) * plotW;
            og.fillRect(pos.x, pos.y - 1, Math.max(2, wDur - 1), 3);
          } else {
            og.fillRect(pos.x - 1, pos.y - 1, 3, 3);
          }
          og.globalAlpha = 1;
        }
      });
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(stat, 0, 0);
      g.restore();

      /* Header (carries the live loop pass). */
      g.font = '11px monospace';
      g.fillStyle = pal.ink;
      g.fillText('DRONELAB No. 1 — the §III plateau, on the bench', 8, 15);
      g.fillStyle = amount > 0 ? pal.ok : pal.warn;
      const shiftNote = userShift !== 0 ? ` · LOOM ${userShift > 0 ? '+' : ''}${userShift} ST` : '';
      const loopNote = looping ? ` · LOOP PASS ${pass + 1}` : ' · ONE PASS';
      g.fillText(
        amount > 0
          ? `CONSENSUS ${label.toUpperCase()} · FIT ${(key.fit * 100).toFixed(0)}% · HARMONIZE ${Math.round(amount * 100)}%${shiftNote}${loopNote}`
          : `HARMONIZER BYPASSED — EVERY LAYER KEEPS ITS OWN TUNING${shiftNote}${loopNote}`,
        8,
        30,
      );

      /* Flashes on recently performed events (wrapped onto the loop). */
      for (const { event, at } of recent) {
        const age = nowMs - at;
        if (age < 0 || age > 400) continue;
        const pos = eventXY(event, boxes, w);
        if (!pos) continue;
        const t = age / 400;
        g.globalAlpha = 1 - t;
        g.strokeStyle = pal.ink;
        g.beginPath();
        g.arc(pos.x, pos.y, 2 + t * 8, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }

      /* Playhead, wrapped onto the single visible pass. */
      const local = looping
        ? ((liveBeat % TOTAL_BEATS) + TOTAL_BEATS) % TOTAL_BEATS
        : Math.min(TOTAL_BEATS, Math.max(0, liveBeat));
      const x = Math.round(xAt(local)) + 0.5;
      g.strokeStyle = pal.warn;
      g.beginPath();
      g.moveTo(x, PLOT.top);
      g.lineTo(x, h - PLOT.bottom);
      g.stroke();
    },
    click(cx, cy, frame) {
      const { params, seed, beat, width, height, nowMs } = frame;
      const looping = params.loop as boolean;
      /* Seek within the current pass so the transport never jumps back. */
      const base = looping ? Math.max(0, Math.floor(beat / TOTAL_BEATS)) * TOTAL_BEATS : 0;
      const hit: StageHit = { seek: base + beatAtX(cx, width) };
      const boxes = laneBoxes(height);
      let best = 8;
      for (const ev of scoreFor(params, seed, nowMs)) {
        const pos = eventXY(ev, boxes, width);
        if (!pos) continue;
        const d = Math.hypot(pos.x - cx, pos.y - cy);
        if (d < best) {
          best = d;
          hit.inspect = ev;
        }
      }
      return hit;
    },
  };
}
