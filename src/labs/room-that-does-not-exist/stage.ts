/*
 * A ROOM THAT DOES NOT EXIST stage — an axonometric box whose back face
 * disagrees with its front by the impossibility, and echo ripples that
 * bloom per the impulse response's envelope.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';
import { SLOTS } from '@/labs/room-that-does-not-exist';

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, recent, width: w, height: h, nowMs }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);
      const imp = params.impossibility as number;
      const size = params.size as number;

      /* An axonometric box whose back face refuses to agree with its front. */
      const cx = w / 2;
      const cy = h / 2 + 10;
      const scale = Math.min(w, h) * (0.16 + Math.min(size, 30) * 0.006);
      const fw = scale * 1.6;
      const fh = scale * 1.0;
      const dx = scale * 0.55;
      const dyBack = -scale * 0.45;
      /* Impossibility swings the back face the wrong way. */
      const wrong = imp * scale * 0.9;

      const front = [
        [cx - fw / 2, cy - fh / 2],
        [cx + fw / 2, cy - fh / 2],
        [cx + fw / 2, cy + fh / 2],
        [cx - fw / 2, cy + fh / 2],
      ];
      const back = [
        [cx - fw / 2 + dx, cy - fh / 2 + dyBack],
        [cx + fw / 2 + dx - wrong, cy - fh / 2 + dyBack + wrong * 0.6],
        [cx + fw / 2 + dx - wrong, cy + fh / 2 + dyBack + wrong * 0.2],
        [cx - fw / 2 + dx, cy + fh / 2 + dyBack],
      ];

      g.strokeStyle = pal.inkDim;
      g.lineWidth = 1;
      const poly = (pts: number[][]): void => {
        g.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
        g.closePath();
        g.stroke();
      };
      poly(back);
      /* Connectors — the impossible ones cross. */
      front.forEach(([x, y], i) => {
        const [bx, by] = back[(i + Math.round(imp * 1.99)) % 4];
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(bx, by);
        g.stroke();
      });
      g.strokeStyle = pal.ink;
      g.lineWidth = 2;
      poly(front);

      /* Echo ripples from recent sparks, blooming per the IR envelope. */
      const decay = params.decay as number;
      for (const { event, at } of recent) {
        const age = (nowMs - at) / 1000;
        if (age < 0 || age > decay) continue;
        const t = age / decay;
        const bloomPeak = 0.15 + 0.45 * imp;
        const possible = Math.exp(-t * 4);
        const bloom = Math.exp(-((t - bloomPeak) ** 2) / 0.04);
        const strength = (1 - imp) * possible + imp * bloom;
        const slotRng = ((event.data?.slot as number) ?? 0) / SLOTS;
        const ox = cx - fw / 2 + fw * slotRng + dx * 0.3;
        const oy = cy + fh * 0.1 - t * 20;
        g.globalAlpha = Math.min(1, strength);
        g.strokeStyle = pal.accent2;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(ox, oy, 6 + t * scale * 1.4, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }

      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      g.fillText(
        `${size.toFixed(1)} m mean path · RT ${decay.toFixed(1)}s · impossibility ${(imp * 100).toFixed(0)}%`,
        8,
        16,
      );
      if (imp > 0.6) {
        g.fillStyle = pal.warn;
        g.fillText('SURVEYOR ADVISORY: GEOMETRY NON-EUCLIDEAN', 8, 32);
      }
    },
    click(_x, _y, { events }) {
      return events.length > 0 ? { inspect: events[0] } : null;
    },
  };
}
