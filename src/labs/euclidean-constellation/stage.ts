/*
 * EUCLIDEAN CONSTELLATION stage — E(k,n) rings as star polygons on
 * concentric orbits, with a sweeping playhead and flashes on each hit.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';
import { STEP_BEATS, VOICES, voicePattern } from '@/labs/euclidean-constellation';

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, beat, recent, width: w, height: h, nowMs }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);
      const steps = params.steps as number;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.42;
      const orbitR = [maxR * 0.45, maxR * 0.72, maxR];
      const orbitColor = [pal.accent, pal.ok, pal.accent2];

      const angleOf = (step: number): number => (step / steps) * Math.PI * 2 - Math.PI / 2;

      /* Step lattice. */
      for (let s = 0; s < steps; s++) {
        const a = angleOf(s);
        g.fillStyle = s % 4 === 0 ? pal.inkDim : pal.edgeDark;
        const r = maxR + 10;
        g.fillRect(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2);
      }

      VOICES.forEach((voice, vi) => {
        const pattern = voicePattern(params, voice);
        const hits: number[] = [];
        pattern.forEach((on, s) => on && hits.push(s));
        const r = orbitR[vi];

        g.strokeStyle = pal.edgeDark;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();

        /* The constellation: chords between consecutive pulses. */
        if (hits.length > 1) {
          g.strokeStyle = orbitColor[vi];
          g.globalAlpha = 0.5;
          g.lineWidth = 1;
          g.beginPath();
          hits.forEach((s, i) => {
            const a = angleOf(s);
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          });
          g.closePath();
          g.stroke();
          g.globalAlpha = 1;
        }

        /* Stars. */
        for (const s of hits) {
          const a = angleOf(s);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          g.fillStyle = orbitColor[vi];
          g.fillRect(x - 2, y - 2, 5, 5);
        }
      });

      /* Flashes on recent hits. */
      for (const { event, at } of recent) {
        const age = nowMs - at;
        if (age < 0 || age > 350) continue;
        const vi = VOICES.findIndex((v) => v.name === event.voice);
        if (vi === -1) continue;
        const s = (event.data?.step as number) ?? 0;
        const a = angleOf(s);
        const r = orbitR[vi];
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const t = age / 350;
        g.globalAlpha = 1 - t;
        g.strokeStyle = pal.ink;
        g.lineWidth = 2;
        g.strokeRect(x - 4 - t * 6, y - 4 - t * 6, (4 + t * 6) * 2 + 1, (4 + t * 6) * 2 + 1);
        g.globalAlpha = 1;
      }

      /* Playhead sweep. */
      const cycleBeats = steps * STEP_BEATS;
      const liveBeat = beat;
      const pos = ((liveBeat % cycleBeats) + cycleBeats) % cycleBeats;
      const pa = (pos / cycleBeats) * Math.PI * 2 - Math.PI / 2;
      g.strokeStyle = pal.warn;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(pa) * (maxR + 8), cy + Math.sin(pa) * (maxR + 8));
      g.stroke();

      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      g.fillText(
        `E(${Math.min(params.pulsesA as number, steps)},${steps}) · E(${Math.min(params.pulsesB as number, steps)},${steps}) · E(${Math.min(params.pulsesC as number, steps)},${steps})`,
        8,
        16,
      );
    },
    click(px, py, { params, events, width: w, height: h }) {
      const x = px - w / 2;
      const y = py - h / 2;
      const steps = params.steps as number;
      const angle = Math.atan2(y, x) + Math.PI / 2;
      const step = ((Math.round((angle / (Math.PI * 2)) * steps) % steps) + steps) % steps;
      const maxR = Math.min(w, h) * 0.42;
      const dist = Math.hypot(x, y);
      const orbit = dist < maxR * 0.58 ? 'low' : dist < maxR * 0.86 ? 'mid' : 'high';
      const hit = events.find((ev) => ev.voice === orbit && (ev.data?.step as number) === step);
      return hit ? { inspect: hit } : null;
    },
  };
}
