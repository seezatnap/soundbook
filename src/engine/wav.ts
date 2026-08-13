/*
 * Offline WAV export. Renders the lab's events through the same instrument
 * factory used live, via an OfflineAudioContext, then encodes 16-bit PCM.
 * Same version + seed + state → identical event sequence; the audio is
 * rendered fresh each time.
 */

import type { LabDefinition } from '@/sdk/lab';
import type { ParamValues } from '@/sdk/params';
import { OfflineEngine } from '@/engine/engine';

const SAMPLE_RATE = 44100;
const TAIL_S = 2;

export async function renderWav(
  lab: LabDefinition,
  params: ParamValues,
  seed: number,
  tempo: number,
  cycles: number,
): Promise<Blob> {
  const beats = lab.cycleBeats(params) * cycles;
  const bps = tempo / 60;
  const durationS = beats / bps + TAIL_S;
  const ctx = new OfflineAudioContext(2, Math.ceil(durationS * SAMPLE_RATE), SAMPLE_RATE);
  const engine = new OfflineEngine(ctx);
  const instrument = lab.makeInstrument(engine, params, seed);

  const events = lab.events({ params, seed, range: { from: 0, to: beats } });
  const startAt = 0.05;
  for (const event of events) {
    instrument.trigger(event, startAt + event.beat / bps, event.dur / bps, params);
  }
  const buffer = await ctx.startRendering();
  instrument.dispose();
  return encodeWav(buffer);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const dataSize = frames * channels * 2;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const perChannel: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const copy = new Float32Array(frames);
    buffer.copyFromChannel(copy, ch);
    perChannel.push(copy);
  }
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, perChannel[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}
