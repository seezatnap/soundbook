/*
 * POLYMETER LOOM stage — one row per thread with its seeded figure, a
 * per-thread wrapping playhead, and the LCM superperiod progress bar.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';
import { lcmAll } from '@/labs/shared/music';
import { STEP_BEATS, THREADS, figureFor, threadLengths } from '@/labs/polymeter-loom';

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, seed, beat, recent, width: w, height: h, nowMs }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);
      const liveBeat = beat;
      const lens = threadLengths(params);
      const superSteps = lcmAll(lens);
      const globalStep = Math.floor(liveBeat / STEP_BEATS);
      const density = params.density as number;
      const threadColors = [pal.accent, pal.ok, pal.accent2, pal.warn];

      const rowH = (h - 60) / THREADS.length;
      THREADS.forEach((thread, ti) => {
        const len = lens[ti];
        const figure = figureFor(seed, thread.name, len);
        const y = 30 + ti * rowH;
        const cellW = (w - 90) / len;
        const x0 = 70;

        g.fillStyle = pal.inkDim;
        g.font = '10px monospace';
        g.fillText(`${thread.name.toUpperCase()} ${len}`, 8, y + rowH / 2 + 3);

        /* Thread line. */
        g.strokeStyle = pal.edgeDark;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y + rowH / 2 + 0.5);
        g.lineTo(x0 + cellW * len, y + rowH / 2 + 0.5);
        g.stroke();

        for (let c = 0; c < len; c++) {
          const cx = x0 + cellW * (c + 0.5);
          const cy = y + rowH / 2;
          const cell = figure[c];
          const active = c === 0 || cell.gateRoll < density;
          const size = c === 0 ? 7 : 5;
          if (active) {
            g.fillStyle = threadColors[ti];
            g.fillRect(cx - size / 2, cy - size / 2, size, size);
          } else {
            g.strokeStyle = pal.edgeLight;
            g.strokeRect(cx - 2.5, cy - 2.5, 5, 5);
          }
        }

        /* Per-thread playhead, wrapping at the thread's own length. */
        const pos = ((globalStep % len) + len) % len;
        const frac = (liveBeat / STEP_BEATS) % 1;
        const px = x0 + cellW * (pos + frac + 0.5);
        if (px <= x0 + cellW * len) {
          g.fillStyle = pal.ink;
          g.fillRect(Math.round(px) - 1, y + 4, 2, rowH - 8);
        }
      });

      /* Flashes. */
      for (const { event, at } of recent) {
        const age = nowMs - at;
        if (age < 0 || age > 300) continue;
        const ti = (event.data?.thread as number) ?? 0;
        const len = lens[ti];
        const c = (event.data?.cell as number) ?? 0;
        const y = 30 + ti * rowH + rowH / 2;
        const cellW = (w - 90) / len;
        const x = 70 + cellW * (c + 0.5);
        const t = age / 300;
        g.globalAlpha = 1 - t;
        g.strokeStyle = threadColors[ti];
        g.lineWidth = 2;
        g.strokeRect(x - 5 - t * 5, y - 5 - t * 5, (5 + t * 5) * 2, (5 + t * 5) * 2);
        g.globalAlpha = 1;
      }

      /* Superperiod progress: when do all threads realign? */
      const superPos = ((globalStep % superSteps) + superSteps) % superSteps;
      const barY = h - 18;
      g.strokeStyle = pal.edgeLight;
      g.strokeRect(70.5, barY + 0.5, w - 90, 8);
      g.fillStyle = pal.accent2;
      g.fillRect(71, barY + 1, (w - 92) * ((superPos + ((liveBeat / STEP_BEATS) % 1)) / superSteps), 7);
      g.fillStyle = pal.inkDim;
      g.font = '10px monospace';
      g.fillText(`LCM ${superSteps}`, 8, barY + 8);

      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      g.fillText(
        `threads ${lens.join('·')}  ·  realign every ${superSteps} steps (${(superSteps * STEP_BEATS).toFixed(1)} beats)`,
        8,
        16,
      );
    },
    click(x, y, { params, events, width, height }) {
      const rowH = (height - 60) / THREADS.length;
      const ti = Math.floor((y - 30) / rowH);
      if (ti < 0 || ti >= THREADS.length) return null;
      const len = threadLengths(params)[ti];
      const cellW = (width - 90) / len;
      const cell = Math.floor((x - 70) / cellW);
      const hit = events.find(
        (ev) => (ev.data?.thread as number) === ti && (ev.data?.cell as number) === cell,
      );
      return hit ? { inspect: hit } : null;
    },
  };
}
