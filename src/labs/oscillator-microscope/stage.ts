/*
 * OSCILLATOR MICROSCOPE stage — an oscilloscope: the ideal mathematical
 * waveform derived from params (deterministic) and the live analyser trace.
 * Workshop-only: the code export ships index.ts without this file.
 */

import type { StageRenderer } from '@/sdk/lab';

/** The ideal waveform sample at phase t∈[0,1), from params alone. */
function idealSample(shape: string, partials: number, t: number): number {
  const tau = t * Math.PI * 2;
  switch (shape) {
    case 'sine':
      return Math.sin(tau);
    case 'square':
      return Math.sin(tau) >= 0 ? 1 : -1;
    case 'sawtooth':
      return 2 * (t - Math.floor(t + 0.5));
    case 'triangle':
      return 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1;
    default: {
      let sum = 0;
      for (let k = 1; k <= partials; k++) sum += Math.sin(tau * k) / k;
      return sum / 1.6;
    }
  }
}

export function makeStage(): StageRenderer {
  return {
    draw(g, { params, analyser, playing, width: w, height: h }, pal) {
      g.fillStyle = pal.faceSunken;
      g.fillRect(0, 0, w, h);

      /* Graticule. */
      g.strokeStyle = pal.edgeDark;
      g.lineWidth = 1;
      const cells = 8;
      for (let i = 1; i < cells; i++) {
        const x = Math.round((w * i) / cells) + 0.5;
        const y = Math.round((h * i) / cells) + 0.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.strokeStyle = pal.edgeLight;
      g.beginPath();
      g.moveTo(0, Math.round(h / 2) + 0.5);
      g.lineTo(w, Math.round(h / 2) + 0.5);
      g.stroke();

      const mid = h / 2;
      const amp = h * 0.36;

      /* Ideal waveform — the deterministic promise. Two cycles, the two
         shapes averaged pointwise exactly as the instrument sums them. */
      const blend = params.blend as number;
      const mixA = 1 - blend;
      const mixB = blend;
      g.strokeStyle = pal.inkDim;
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= w; x++) {
        const t = ((x / w) * 2) % 1;
        const partials = params.partials as number;
        const sample =
          idealSample(params.wave as string, partials, t) * mixA +
          idealSample(params.waveB as string, partials, t) * mixB;
        const y = mid - sample * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();

      /* Live trace — what the speaker actually got, when running. */
      if (analyser && playing) {
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        /* Trigger on a rising zero crossing for a stable picture. */
        let start = 0;
        for (let i = 1; i < data.length / 2; i++) {
          if (data[i - 1] <= 0 && data[i] > 0) {
            start = i;
            break;
          }
        }
        const span = Math.min(data.length - start, Math.floor(data.length / 2));
        g.strokeStyle = pal.accent;
        g.lineWidth = 2;
        g.beginPath();
        for (let x = 0; x <= w; x++) {
          const i = start + Math.floor((x / w) * span);
          const y = mid - (data[i] ?? 0) * amp * 1.6;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }

      /* Readout. */
      g.fillStyle = pal.ink;
      g.font = '11px monospace';
      const freq = params.freq as number;
      const blendPct = Math.round(blend * 100);
      g.fillText(
        `${freq.toFixed(1)} Hz  ·  period ${(1000 / freq).toFixed(2)} ms  ·  ${params.wave}→${params.waveB} ${blendPct}%`,
        8,
        16,
      );
      g.fillStyle = pal.inkDim;
      g.fillText(playing ? 'LIVE TRACE + IDEAL' : 'IDEAL WAVEFORM (press play)', 8, h - 8);
    },
  };
}
