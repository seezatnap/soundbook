/*
 * Session state: the document. Everything here round-trips through the URL
 * fragment; undo/redo, story loading, randomize and A/B all operate on this
 * one record. UI-only state (locks, drawer tab) deliberately lives elsewhere.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodeState, decodeState, type SessionState } from '@/sdk/codec';
import { defaultsOf, randomizeParams, sanitizeAll, type ParamValues } from '@/sdk/params';
import type { LabDefinition, Story } from '@/sdk/lab';
import { freshSeed, makeRng } from '@/sdk/prng';
import { LABS, findLab } from '@/labs/registry';

export interface Session {
  labId: string;
  seed: number;
  tempo: number;
  params: ParamValues;
  b: ParamValues | null;
}

function freshSession(lab: LabDefinition): Session {
  return { labId: lab.id, seed: 1, tempo: 120, params: defaultsOf(lab.params), b: null };
}

const HISTORY_CAP = 100;
const COALESCE_MS = 400;

export interface SessionApi {
  session: Session;
  lab: LabDefinition;
  /** Payload currently in the address bar (diagnostics). */
  urlPayload: string;
  setParam(key: string, value: ParamValues[string]): void;
  setParams(values: ParamValues): void;
  setSeed(seed: number): void;
  reseed(): void;
  setTempo(tempo: number): void;
  selectLab(id: string): void;
  loadStory(story: Story): void;
  randomize(locked: ReadonlySet<string>): void;
  setB(b: ParamValues | null): void;
  swapAB(): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  copyLink(): Promise<string>;
}

export function useSession(): SessionApi {
  const [session, setSession] = useState<Session>(() => freshSession(LABS[0]));
  const [urlPayload, setUrlPayload] = useState('');
  const lab = useMemo(() => findLab(session.labId) ?? LABS[0], [session.labId]);

  /* Per-lab parking spots so browsing labs doesn't lose work. */
  const parkedRef = useRef(new Map<string, Session>());

  /* Undo/redo. */
  const pastRef = useRef<Session[]>([]);
  const futureRef = useRef<Session[]>([]);
  const lastPushRef = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);

  const commit = useCallback(
    (updater: (prev: Session) => Session, coalesce = false): void => {
      setSession((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        const now = performance.now();
        const past = pastRef.current;
        if (coalesce && now - lastPushRef.current < COALESCE_MS && past.length > 0) {
          /* Mid-drag: keep the pre-drag snapshot on top, don't stack every tick. */
        } else {
          past.push(prev);
          if (past.length > HISTORY_CAP) past.shift();
        }
        lastPushRef.current = now;
        futureRef.current = [];
        setHistoryTick((t) => t + 1);
        return next;
      });
    },
    [],
  );

  /* ------------------------------------------------------------- URL sync */

  const applyDecoded = useCallback((state: SessionState): void => {
    setSession({
      labId: state.labId,
      seed: state.seed,
      tempo: state.tempo,
      params: state.params,
      b: state.b ?? null,
    });
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  const hashWriteRef = useRef('');
  useEffect(() => {
    const readHash = (): void => {
      const payload = window.location.hash.replace(/^#/, '');
      if (!payload || payload === hashWriteRef.current) return;
      void decodeState(payload, findLab).then((state) => {
        if (state) applyDecoded(state);
      });
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [applyDecoded]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void encodeState(
        {
          labId: session.labId,
          version: lab.version,
          seed: session.seed,
          tempo: session.tempo,
          params: session.params,
          b: session.b ?? undefined,
        },
        lab,
      ).then((payload) => {
        hashWriteRef.current = payload;
        setUrlPayload(payload);
        history.replaceState(null, '', `#${payload}`);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [session, lab]);

  /* ------------------------------------------------------------- mutators */

  const setParam = useCallback(
    (key: string, value: ParamValues[string]): void => {
      commit((prev) => ({ ...prev, params: { ...prev.params, [key]: value } }), true);
    },
    [commit],
  );

  const setParams = useCallback(
    (values: ParamValues): void => {
      commit((prev) => ({ ...prev, params: { ...prev.params, ...values } }));
    },
    [commit],
  );

  const setSeed = useCallback(
    (seed: number): void => {
      commit((prev) => ({ ...prev, seed: seed >>> 0 }));
    },
    [commit],
  );

  const reseed = useCallback((): void => {
    commit((prev) => ({ ...prev, seed: freshSeed() }));
  }, [commit]);

  const setTempo = useCallback(
    (tempo: number): void => {
      commit((prev) => ({ ...prev, tempo: Math.min(300, Math.max(20, tempo)) }), true);
    },
    [commit],
  );

  const selectLab = useCallback(
    (id: string): void => {
      const target = findLab(id);
      if (!target) return;
      commit((prev) => {
        if (prev.labId === id) return prev;
        parkedRef.current.set(prev.labId, prev);
        return parkedRef.current.get(id) ?? freshSession(target);
      });
    },
    [commit],
  );

  const loadStory = useCallback(
    (story: Story): void => {
      commit((prev) => {
        const target = findLab(prev.labId);
        if (!target) return prev;
        return {
          ...prev,
          seed: story.seed,
          params: sanitizeAll(target.params, { ...defaultsOf(target.params), ...story.params }),
        };
      });
    },
    [commit],
  );

  const randomize = useCallback(
    (locked: ReadonlySet<string>): void => {
      commit((prev) => {
        const target = findLab(prev.labId);
        if (!target) return prev;
        /* Non-deterministic by design: a user gesture asking for novelty.
           The result immediately becomes explicit, serialized state. */
        const rng = makeRng(freshSeed());
        return { ...prev, params: randomizeParams(target.params, prev.params, locked, rng) };
      });
    },
    [commit],
  );

  const setB = useCallback(
    (b: ParamValues | null): void => {
      commit((prev) => ({ ...prev, b }));
    },
    [commit],
  );

  const swapAB = useCallback((): void => {
    commit((prev) => (prev.b ? { ...prev, params: prev.b, b: prev.params } : prev));
  }, [commit]);

  const undo = useCallback((): void => {
    setSession((current) => {
      const past = pastRef.current;
      if (past.length === 0) return current;
      const previous = past.pop()!;
      futureRef.current.push(current);
      setHistoryTick((t) => t + 1);
      return previous;
    });
  }, []);

  const redo = useCallback((): void => {
    setSession((current) => {
      const future = futureRef.current;
      if (future.length === 0) return current;
      const next = future.pop()!;
      pastRef.current.push(current);
      setHistoryTick((t) => t + 1);
      return next;
    });
  }, []);

  const buildLink = useCallback(async (): Promise<string> => {
    const payload = await encodeState(
      {
        labId: session.labId,
        version: lab.version,
        seed: session.seed,
        tempo: session.tempo,
        params: session.params,
        b: session.b ?? undefined,
      },
      lab,
    );
    return `${window.location.origin}${window.location.pathname}#${payload}`;
  }, [session, lab]);

  const copyLink = useCallback(async (): Promise<string> => {
    const url = await buildLink();
    /* Clipboard access can be denied; the link itself must still exist. */
    await navigator.clipboard.writeText(url).catch(() => {});
    return url;
  }, [buildLink]);

  void historyTick;
  return {
    session,
    lab,
    urlPayload,
    setParam,
    setParams,
    setSeed,
    reseed,
    setTempo,
    selectLab,
    loadStory,
    randomize,
    setB,
    swapAB,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    copyLink,
  };
}
