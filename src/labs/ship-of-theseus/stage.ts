/*
 * SHIP OF THESEUS stage — the hull as one plank per note, colored by how
 * many times it has been replaced, with the ledger and a legend.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';
import { STEP_BEATS, shipAtCycle } from '@/labs/ship-of-theseus';

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, seed, beat, width: w, height: h, nowMs }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);
      const length = params.length as number;
      const cycleBeats = length * STEP_BEATS;
      const cycle = Math.max(0, Math.floor(beat / cycleBeats));
      const ship = shipAtCycle(params, seed, cycle);
      const liveBeat = beat;
      const step = Math.floor(((liveBeat / STEP_BEATS) % length + length) % length);

      const waterY = h * 0.62;

      /* Sea. */
      g.strokeStyle = pal.accent2;
      g.globalAlpha = 0.5;
      for (let row = 0; row < 3; row++) {
        g.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y =
            waterY +
            8 +
            row * 12 +
            Math.sin(x * 0.03 + nowMs * 0.0012 + row * 1.7) * 3;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;

      /* Hull: one trapezoid strip per plank along a gentle arc. */
      const hullW = Math.min(w * 0.7, 560);
      const hullX = (w - hullW) / 2;
      const plankW = hullW / length;
      const hullTop = waterY - 40;
      for (let i = 0; i < length; i++) {
        const plank = ship.planks[i];
        const x = hullX + i * plankW;
        const arc = Math.sin((i / (length - 1 || 1)) * Math.PI) * 14;
        const yTop = hullTop - arc * 0.35;
        const yBot = waterY + 6 - arc;
        const gen = plank.generation;
        g.fillStyle = gen === 0 ? pal.accent : gen === 1 ? pal.ok : pal.accent2;
        g.globalAlpha = gen === 0 ? 1 : 0.9;
        g.fillRect(Math.round(x) + 1, yTop, Math.ceil(plankW) - 2, yBot - yTop);
        g.globalAlpha = 1;
        g.strokeStyle = pal.edgeDark;
        g.strokeRect(Math.round(x) + 0.5, yTop + 0.5, Math.ceil(plankW) - 1, yBot - yTop - 1);
        /* The sounding plank glows. */
        if (i === step) {
          g.strokeStyle = pal.ink;
          g.lineWidth = 2;
          g.strokeRect(Math.round(x) - 0.5, yTop - 2, Math.ceil(plankW) + 1, yBot - yTop + 3);
          g.lineWidth = 1;
        }
      }

      /* Mast and sail. */
      const mastX = hullX + hullW * 0.45;
      g.fillStyle = pal.inkDim;
      g.fillRect(mastX - 2, hullTop - 90, 4, 90 - 8);
      g.fillStyle = pal.face;
      g.beginPath();
      g.moveTo(mastX + 4, hullTop - 86);
      g.lineTo(mastX + 4 + hullW * 0.22, hullTop - 40);
      g.lineTo(mastX + 4, hullTop - 20);
      g.closePath();
      g.fill();
      g.strokeStyle = pal.edgeLight;
      g.stroke();

      /* Ledger. */
      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      g.fillText(
        `CYCLE ${cycle}  ·  HULL ${(ship.originalFraction * 100).toFixed(0)}% ORIGINAL  ·  ${ship.replacements} REPLACEMENTS MADE`,
        8,
        16,
      );
      g.fillStyle = pal.inkDim;
      g.fillText(
        ship.originalFraction === 0
          ? 'NO ORIGINAL TIMBER REMAINS. SAME SHIP?'
          : `replacement every ${params.every} cycle${(params.every as number) > 1 ? 's' : ''}`,
        8,
        32,
      );

      /* Legend. */
      const legend: Array<[string, string]> = [
        [pal.accent, 'original'],
        [pal.ok, 'replaced'],
        [pal.accent2, 'replaced again'],
      ];
      let lx = 8;
      const ly = h - 14;
      g.font = '10px monospace';
      for (const [color, label] of legend) {
        g.fillStyle = color;
        g.fillRect(lx, ly - 7, 8, 8);
        g.fillStyle = pal.inkDim;
        g.fillText(label, lx + 12, ly);
        lx += 12 + g.measureText(label).width + 16;
      }
    },
    click(x, _y, { params, events, width: w }) {
      const length = params.length as number;
      const hullW = Math.min(w * 0.7, 560);
      const hullX = (w - hullW) / 2;
      const plankW = hullW / length;
      const idx = Math.floor((x - hullX) / plankW);
      if (idx < 0 || idx >= length) return null;
      const hit = events.find((ev) => (ev.data?.plank as number) === idx);
      return hit ? { inspect: hit } : null;
    },
  };
}
