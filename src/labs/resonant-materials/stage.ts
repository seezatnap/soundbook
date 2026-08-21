/*
 * RESONANT MATERIALS stage — four resonator discs, strike rings that die
 * with the decay param, and a sixteenth ruler of this cycle's strikes.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';
import { CYCLE_BEATS, RESONATORS, SLOTS } from '@/labs/resonant-materials';

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, beat, events, recent, width: w, height: h, nowMs }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);

      const liveBeat = beat;
      const cyclePos = ((liveBeat % CYCLE_BEATS) + CYCLE_BEATS) % CYCLE_BEATS;

      /* Sixteenth ruler along the bottom. */
      const rulerY = h - 26;
      for (let s = 0; s < SLOTS; s++) {
        const x = (w * (s + 0.5)) / SLOTS;
        g.fillStyle = s % 4 === 0 ? pal.inkDim : pal.edgeDark;
        g.fillRect(Math.round(x) - 1, rulerY, 2, s % 4 === 0 ? 10 : 6);
      }
      const px = (w * cyclePos) / CYCLE_BEATS;
      g.fillStyle = pal.accent;
      g.fillRect(Math.round(px) - 1, rulerY - 4, 2, 18);

      /* Four resonators: discs sized by pitch (big = low). */
      const positions = RESONATORS.map((_, i) => ({
        x: (w * (i + 0.5)) / RESONATORS.length,
        y: h * 0.42,
        r: Math.min(w / 10, h / 5) / Math.sqrt(RESONATORS[i]),
      }));

      positions.forEach((pos, i) => {
        g.strokeStyle = pal.edgeLight;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = pal.face;
        g.beginPath();
        g.arc(pos.x, pos.y, pos.r - 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = pal.inkDim;
        g.font = '10px monospace';
        g.textAlign = 'center';
        g.fillText(`×${RESONATORS[i]}`, pos.x, pos.y + pos.r + 14);
        g.textAlign = 'left';
      });

      /* Strike flashes: expanding rings that die with the decay param. */
      const ringLife = Math.min(2.5, (params.decay as number)) * 1000;
      for (const { event, at } of recent) {
        const age = nowMs - at;
        if (age < 0 || age > ringLife) continue;
        const resonator = (event.data?.resonator as number) ?? 0;
        const pos = positions[resonator];
        const t = age / ringLife;
        g.globalAlpha = 1 - t;
        g.strokeStyle = pal.accent;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(pos.x, pos.y, pos.r * (1 + t * 0.9), 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }

      /* Upcoming strikes in this cycle, as dots on the ruler. */
      for (const ev of events) {
        const slot = (ev.data?.slot as number) ?? 0;
        const x = (w * (slot + 0.5)) / SLOTS;
        g.fillStyle = pal.accent2;
        g.fillRect(Math.round(x) - 2, rulerY - 10, 4, 4);
      }

      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      g.fillText(
        `${String(params.material).toUpperCase()}  ·  ${(params.fundamental as number).toFixed(0)} Hz  ·  ring ${(params.decay as number).toFixed(1)}s`,
        8,
        16,
      );
    },
    click(x, _y, { events, width }) {
      /* Map a click on the ruler to the nearest strike in this cycle. */
      const slot = Math.floor((x / width) * SLOTS);
      const hit = events.find((ev) => Math.abs(((ev.data?.slot as number) ?? -99) - slot) <= 1);
      return hit ? { inspect: hit } : null;
    },
  };
}
