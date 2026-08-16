/*
 * URL fragment codec. The URL is the document: lab id/version, seed, tempo,
 * sparse params (defaults omitted), and the A/B alternate snapshot. Encoded
 * as deflate-raw + base64url behind a codec-version prefix, e.g. "#1.eJx…".
 * Runtime details (audio nodes, analyser samples) never serialize.
 */

import { defaultsOf, diffFromDefaults, sanitizeAll, type ParamValues } from '@/sdk/params';
import type { LabDefinition } from '@/sdk/lab';

export interface SessionState {
  labId: string;
  version: number;
  seed: number;
  tempo: number;
  params: ParamValues;
  /** The B snapshot for A/B morphing, sparse; absent when unused. */
  b?: ParamValues;
  /** Param keys locked against randomize/morph; absent when none. */
  locked?: string[];
}

const CODEC_VERSION = '1';

/* ---------------------------------------------------------------- base64url */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------- compression */

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------------- codec */

interface WireState {
  l: string;
  v: number;
  s: number;
  t: number;
  p?: ParamValues;
  b?: ParamValues;
  k?: string[];
}

/** Encode a session to the fragment payload (without the leading '#'). */
export async function encodeState(state: SessionState, lab: LabDefinition): Promise<string> {
  const wire: WireState = {
    l: state.labId,
    v: state.version,
    s: state.seed,
    t: state.tempo,
  };
  const sparse = diffFromDefaults(lab.params, state.params);
  if (Object.keys(sparse).length > 0) wire.p = sparse;
  if (state.b) {
    const sparseB = diffFromDefaults(lab.params, state.b);
    wire.b = sparseB;
  }
  /* Sorted so identical states always emit identical payloads (publish
     snapshots are content-addressed on the payload string). Transport
     controls can't meaningfully be locked, so stale entries are pruned. */
  if (state.locked && state.locked.length > 0) {
    const lockable = state.locked.filter((key) =>
      lab.params.some((spec) => spec.key === key && !spec.control),
    );
    if (lockable.length > 0) wire.k = [...lockable].sort();
  }
  const json = new TextEncoder().encode(JSON.stringify(wire));
  const packed = await deflate(json);
  return `${CODEC_VERSION}.${bytesToBase64Url(packed)}`;
}

/**
 * Decode a fragment payload. Unknown labs return null; params are validated
 * against the lab schema with unknown keys dropped and bad values defaulted.
 */
export async function decodeState(
  payload: string,
  findLab: (id: string) => LabDefinition | undefined,
): Promise<SessionState | null> {
  try {
    const dot = payload.indexOf('.');
    if (dot === -1 || payload.slice(0, dot) !== CODEC_VERSION) return null;
    const bytes = base64UrlToBytes(payload.slice(dot + 1));
    const json = new TextDecoder().decode(await inflate(bytes));
    const wire = JSON.parse(json) as WireState;
    const lab = findLab(wire.l);
    if (!lab) return null;
    const seed = Number.isFinite(wire.s) ? wire.s >>> 0 : 1;
    const tempo = Number.isFinite(wire.t) ? Math.min(300, Math.max(20, wire.t)) : 120;
    const state: SessionState = {
      labId: lab.id,
      version: lab.version,
      seed,
      tempo,
      params: sanitizeAll(lab.params, { ...defaultsOf(lab.params), ...wire.p }),
    };
    if (wire.b) state.b = sanitizeAll(lab.params, { ...defaultsOf(lab.params), ...wire.b });
    if (Array.isArray(wire.k)) {
      /* Locks are validated like params: unknown keys dropped, dupes folded,
         unlockable transport controls pruned. */
      const keys = wire.k.filter(
        (key): key is string =>
          typeof key === 'string' &&
          lab.params.some((spec) => spec.key === key && !spec.control),
      );
      if (keys.length > 0) state.locked = [...new Set(keys)].sort();
    }
    return state;
  } catch {
    return null;
  }
}
