/*
 * CONCORDANCE No. 1 stage — the whole 360-beat score as a timeline: one
 * lane per document, every mark with the harmonizer's pull drawn as a tick,
 * section boundaries, the arrangement envelopes, and a seekable playhead.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import type { StageHit, StageRenderer } from '@/sdk/lab';
import { freqToMidi, keyLabel } from '@/labs/shared/harmonize';
import { makeLayerCache, makeThrottledMemo, type StagePalette } from '@/labs/shared/stage';
import {
  SECTIONS,
  TOTAL_BEATS,
  TRACKS,
  concordanceConsensus,
  envAt,
  pieceEvents,
} from '@/labs/concordance';

const LANES = [
  { track: 'stars', label: 'LOOM', frac: 0.46, lo: 38, hi: 104 },
  { track: 'sparks', label: 'SPARKS', frac: 0.32, lo: 40, hi: 74 },
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
  const x = PLOT.left + (ev.beat / TOTAL_BEATS) * plotW;
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
  /* The whole 3-minute score for display. The documents are frozen, so
     only the harmonizer console reaches the events — level and wet drags
     recompute nothing, and keyed changes are throttled below drag rate. */
  const scoreMemo = makeThrottledMemo<NoteEvent[]>(180);
  const scoreFor = (params: ParamValues, seed: number, nowMs: number): NoteEvent[] =>
    scoreMemo(
      JSON.stringify([params.harmonize, params.starsShift, params.transpose, seed]),
      () => pieceEvents(params, seed, 0, TOTAL_BEATS),
      nowMs,
    );
  const staticLayer = makeLayerCache();
  return {
    draw(g, { params, seed, beat, recent, width: w, height: h, nowMs }, pal) {
      const score = scoreFor(params, seed, nowMs);
      const boxes = laneBoxes(h);
      const plotW = w - PLOT.left - PLOT.right;
      const xAt = (b: number): number => PLOT.left + (b / TOTAL_BEATS) * plotW;
      const amount = params.harmonize as number;
      const transpose = params.transpose as number;
      const userShift = params.starsShift as number;
      const key = concordanceConsensus();
      const label = keyLabel({
        rootPc: (((key.rootPc + transpose) % 12) + 12) % 12,
        scaleName: key.scaleName,
      });
      const dpr = g.canvas.width / Math.max(1, w);

      /* Everything the score writes is drawn once per document/size/palette
         and blitted; `score` changes identity on any param or seed change,
         so it keys the cache. Per frame only header, flashes and playhead. */
      const stat = staticLayer(w, h, dpr, [score, pal], (og) => {
        og.fillStyle = pal.faceSunken;
        og.fillRect(0, 0, w, h);
        og.font = '11px monospace';

        /* Lanes. */
        for (const box of boxes) {
          og.strokeStyle = pal.edgeDark;
          og.lineWidth = 1;
          og.beginPath();
          og.moveTo(PLOT.left, Math.round(box.y) + 0.5);
          og.lineTo(w - PLOT.right, Math.round(box.y) + 0.5);
          og.stroke();
          og.fillStyle = pal.inkDim;
          og.fillText(box.label, PLOT.left + 2, box.y + 11);
          /* Arrangement envelope, dim, along the lane floor. */
          const track = TRACKS.find((t) => t.id === box.track);
          if (track) {
            og.strokeStyle = pal.edgeLight;
            og.beginPath();
            for (let px = 0; px <= plotW; px += 4) {
              const b = (px / plotW) * TOTAL_BEATS;
              const level = b < track.enterAt || b >= track.exitAt ? 0 : envAt(track.env, b);
              const y = box.y + box.h - 2 - level * (box.h * 0.25);
              if (px === 0) og.moveTo(PLOT.left + px, y);
              else og.lineTo(PLOT.left + px, y);
            }
            og.stroke();
          }
        }

        /* Section boundaries. */
        for (const s of SECTIONS) {
          const x = Math.round(xAt(s.at)) + 0.5;
          og.strokeStyle = pal.edgeLight;
          og.beginPath();
          og.moveTo(x, PLOT.top);
          og.lineTo(x, h - PLOT.bottom);
          og.stroke();
          og.fillStyle = pal.inkDim;
          og.fillText(`§${s.numeral} ${s.name.toUpperCase()}`, x + 3, h - PLOT.bottom + 12);
        }

        /* Minute marks (at the authored 120 BPM). */
        og.fillStyle = pal.inkDim;
        for (let b = 0; b <= TOTAL_BEATS; b += 120) {
          const x = xAt(b);
          og.fillText(`${Math.floor(b / 120)}:00`, Math.min(x, w - PLOT.right - 24), PLOT.top - 4);
        }

        /* Events: every mark in the score, with the harmonizer's pull drawn
           as a tick from where the note arrived to where it now sits. */
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

      /* Header. */
      g.font = '11px monospace';
      g.fillStyle = pal.ink;
      g.fillText('CONCORDANCE No. 1 — three documents, one key', 8, 15);
      g.fillStyle = amount > 0 ? pal.ok : pal.warn;
      const shiftNote = userShift !== 0 ? ` · LOOM ${userShift > 0 ? '+' : ''}${userShift} ST` : '';
      g.fillText(
        amount > 0
          ? `CONSENSUS ${label.toUpperCase()} · FIT ${(key.fit * 100).toFixed(0)}% · HARMONIZE ${Math.round(amount * 100)}%${shiftNote}`
          : `HARMONIZER BYPASSED — SHIFTS ARRIVE UNCORRECTED${shiftNote}`,
        8,
        30,
      );

      /* Flashes on recently performed events. */
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

      /* Playhead. */
      const liveBeat = beat;
      const x = Math.round(xAt(Math.min(TOTAL_BEATS, Math.max(0, liveBeat)))) + 0.5;
      g.strokeStyle = pal.warn;
      g.beginPath();
      g.moveTo(x, PLOT.top);
      g.lineTo(x, h - PLOT.bottom);
      g.stroke();
    },
    click(cx, cy, frame) {
      const { width, height, nowMs } = frame;
      /* The timeline is a transport: every click moves the playhead. A
         click that lands on a mark also asks it why. */
      const hit: StageHit = { seek: beatAtX(cx, width) };
      const boxes = laneBoxes(height);
      let best = 8;
      for (const ev of scoreFor(frame.params, frame.seed, nowMs)) {
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
