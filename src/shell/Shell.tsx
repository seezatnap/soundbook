/*
 * The workshop floor. Header band, transport toolbar, lab browser, stage +
 * generated params, inspection drawer, status bar — all sim-city chrome,
 * all driven by the session document and the shared audio engine.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { IconButton } from '@simcity/components/IconButton';
import { SplitPane } from '@simcity/components/SplitPane';
import { LED, Readout, StatusBar } from '@simcity/components/StatusBar';
import { useToast } from '@simcity/components/Toast';
import { hash32 } from '@/sdk/prng';
import { morphParams } from '@/sdk/params';
import type { NoteEvent } from '@/sdk/events';
import { useSession } from '@/shell/useSession';
import { useAudio } from '@/shell/useAudio';
import { LabBrowser, type PublishedSnapshot } from '@/shell/LabBrowser';
import { TransportBar } from '@/shell/TransportBar';
import { ParamPanel } from '@/shell/ParamPanel';
import { StageHost } from '@/shell/StageHost';
import { Drawer } from '@/shell/Drawer';

const PUBLISH_KEY = 'soundbook.published.v1';

/** Below this, panels become slide-in sheets and the toolbar folds. */
const COMPACT_QUERY = '(max-width: 900px)';

function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (): void => setCompact(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return compact;
}

type SheetId = 'none' | 'labs' | 'params' | 'inspect';

/*
 * Fire an action on a beat grid while the transport runs. Epochs only fire
 * forward, so seeks, restarts and toggling resync silently instead of
 * triggering. Drives AutoRandomize and AutoRandomSeed.
 */
function useBeatTrigger(
  enabled: boolean,
  beats: number,
  playing: boolean,
  getBeat: () => number,
  fire: () => void,
): void {
  const epochRef = useRef(0);
  useEffect(() => {
    if (!(enabled && playing)) return;
    epochRef.current = Math.floor(getBeat() / beats);
    const timer = setInterval(() => {
      const epoch = Math.floor(getBeat() / beats);
      if (epoch > epochRef.current) fire();
      epochRef.current = epoch;
    }, 100);
    return () => clearInterval(timer);
  }, [enabled, beats, playing, getBeat, fire]);
}

function loadPublished(): PublishedSnapshot[] {
  try {
    const raw = localStorage.getItem(PUBLISH_KEY);
    const parsed = raw ? (JSON.parse(raw) as PublishedSnapshot[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function Shell(): JSX.Element {
  const s = useSession();
  const { toast } = useToast();
  const compact = useCompact();

  const [morph, setMorph] = useState(0);
  /* Which slide-in sheet is open in compact mode; one at a time, modal. */
  const [sheet, setSheet] = useState<SheetId>('none');
  const [inspected, setInspected] = useState<NoteEvent | null>(null);
  const [drawerTab, setDrawerTab] = useState('events');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [published, setPublished] = useState<PublishedSnapshot[]>(loadPublished);
  const [exporting, setExporting] = useState(false);
  const [chrome, setChrome] = useState<'dark' | 'light'>('dark');
  const [statusTick, setStatusTick] = useState(0);

  /* Locks are document state — serialized, published, undoable. */
  const locked = s.session.locked;

  /* What the ear gets: A, or the A→B blend while morphing. Labs may
     resolve the blend themselves (e.g. averaging waveforms) and report
     which keys have no single truthful value. Locked params sit the morph
     out entirely: they hold A's value through the scrub and through APPLY,
     even against a lab's own morph resolution. */
  const { params: effectiveParams, blended: blendedKeys } = useMemo(() => {
    if (!(morph > 0 && s.session.b)) return { params: s.session.params, blended: [] as string[] };
    const resolved = s.lab.morph
      ? s.lab.morph(s.session.params, s.session.b, morph)
      : {
          params: morphParams(s.lab.params, s.session.params, s.session.b, morph),
          blended: [] as string[],
        };
    if (locked.size === 0) return resolved;
    const params = { ...resolved.params };
    for (const key of locked) {
      if (key in s.session.params) params[key] = s.session.params[key];
    }
    return { params, blended: resolved.blended.filter((key) => !locked.has(key)) };
  }, [morph, s.session.params, s.session.b, s.lab, locked]);

  const audio = useAudio(s.lab, effectiveParams, s.session.seed, s.session.tempo);

  /* Labs that declare the transport-control params (DroneLab's Master tab)
     get their buttons pressed on a beat grid: AutoRandomize → randomize
     unlocked params, AutoRandomSeed → reseed (crossfaded via fadeBeats). */
  useBeatTrigger(
    effectiveParams.autoRandom === true,
    Math.max(1, Number(effectiveParams.autoRandomBeats) || 1),
    audio.playing,
    audio.getBeat,
    s.randomize,
  );
  useBeatTrigger(
    effectiveParams.autoReseed === true,
    Math.max(1, Number(effectiveParams.autoReseedBeats) || 1),
    audio.playing,
    audio.getBeat,
    s.reseed,
  );

  /* Coarse clock for the status bar readouts. */
  useEffect(() => {
    const timer = setInterval(() => setStatusTick((t) => t + 1), 250);
    return () => clearInterval(timer);
  }, []);
  void statusTick;

  useEffect(() => {
    document.documentElement.setAttribute('data-chrome', chrome);
  }, [chrome]);

  /* Lab switch: clear inspection and morph. Locks travel with the session
     (parked per lab, decoded from the URL), so they are not cleared here. */
  useEffect(() => {
    setInspected(null);
    setMorph(0);
  }, [s.lab.id]);

  /* Leaving compact closes whatever sheet was up. */
  useEffect(() => {
    if (!compact) setSheet('none');
  }, [compact]);

  const onInspect = useCallback(
    (event: NoteEvent): void => {
      setInspected(event);
      setDrawerTab('provenance');
      setDrawerOpen(true);
      if (compact) setSheet('inspect');
    },
    [compact],
  );

  const toggleSheet = useCallback((which: SheetId): void => {
    setSheet((prev) => (prev === which ? 'none' : which));
  }, []);

  const onCopyLink = useCallback((): void => {
    void s.copyLink().then((url) => {
      toast({ title: 'LINK COPIED', description: `${url.length} chars — the URL is the document.` });
    });
  }, [s, toast]);

  const onPublish = useCallback((): void => {
    void s.copyLink().then((url) => {
      const payload = url.split('#')[1] ?? '';
      const stamp = hash32(payload).toString(16).padStart(8, '0').slice(0, 6);
      const snapshot: PublishedSnapshot = {
        name: `${s.lab.title} #${stamp}`,
        payload,
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      setPublished((prev) => {
        if (prev.some((p) => p.payload === payload)) return prev;
        const next = [snapshot, ...prev].slice(0, 30);
        localStorage.setItem(PUBLISH_KEY, JSON.stringify(next));
        return next;
      });
      toast({
        title: 'SNAPSHOT PUBLISHED',
        description: `${snapshot.name} — content-addressed, immutable, on your local shelf. URL copied.`,
      });
    });
  }, [s, toast]);

  const onOpenSnapshot = useCallback((snap: PublishedSnapshot): void => {
    window.location.hash = snap.payload;
  }, []);

  const onDeleteSnapshot = useCallback((snap: PublishedSnapshot): void => {
    setPublished((prev) => {
      const next = prev.filter((p) => p.payload !== snap.payload);
      localStorage.setItem(PUBLISH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const onExport = useCallback((): void => {
    setExporting(true);
    /* Labs loop: render 4 cycles. A through-composed piece renders whole. */
    const pieceBeats = s.lab.pieceBeats;
    const cycles = pieceBeats
      ? Math.max(1, Math.round(pieceBeats / s.lab.cycleBeats(s.session.params)))
      : 4;
    void audio
      .exportWav(cycles)
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${s.lab.id}-seed${s.session.seed}.wav`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast({
          title: 'WAV EXPORTED',
          description: pieceBeats
            ? 'Whole piece rendered offline, same events as live.'
            : '4 cycles rendered offline, same events as live.',
        });
      })
      .catch((error: unknown) => {
        toast({ title: 'EXPORT FAILED', description: String(error), variant: 'danger' });
      })
      .finally(() => setExporting(false));
  }, [audio, s.lab, s.session.seed, s.session.params, toast]);

  const onApplyMorph = useCallback((): void => {
    if (morph > 0 && s.session.b) {
      /* Commit exactly what was being heard — effectiveParams already holds
         the lab's own morph resolution with locked params pinned to A.
         Blended discrete states land as real params (e.g. wave/waveB/blend),
         so the result stays serializable. */
      s.setParams(effectiveParams);
      setMorph(0);
      toast({ title: 'MORPH APPLIED', description: 'The blend is now A.' });
    }
  }, [morph, s, effectiveParams, toast]);

  /* Current-cycle events for the drawer table (coarse clock is fine). */
  const beatNow = audio.getBeat();
  const cycleBeats = s.lab.cycleBeats(effectiveParams);
  const cycleIndex = Math.max(0, Math.floor(beatNow / cycleBeats));
  const cycleEvents = useMemo(
    () =>
      s.lab.events({
        params: effectiveParams,
        seed: s.session.seed,
        range: { from: cycleIndex * cycleBeats, to: (cycleIndex + 1) * cycleBeats },
      }),
    [s.lab, effectiveParams, s.session.seed, cycleIndex, cycleBeats],
  );

  const bar = Math.floor(beatNow / 4) + 1;
  const beatInBar = Math.floor(beatNow % 4) + 1;

  /* The same furniture serves both layouts: desktop split panes, or
     compact slide-in sheets with 20px edge tabs. */
  const browserEl = (
    <LabBrowser
      selectedId={s.lab.id}
      onSelect={(id) => {
        audio.stop();
        s.selectLab(id);
        if (compact) setSheet('none');
      }}
      published={published}
      onOpenSnapshot={onOpenSnapshot}
      onDeleteSnapshot={onDeleteSnapshot}
      analyser={audio.analyser}
    />
  );
  const stageEl = (
    <StageHost
      lab={s.lab}
      params={effectiveParams}
      seed={s.session.seed}
      playing={audio.playing}
      getBeat={audio.getBeat}
      analyser={audio.analyser}
      recentRef={audio.recentRef}
      onInspect={onInspect}
      onSeek={audio.seek}
    />
  );
  const paramsEl = (
    <ParamPanel
      specs={s.lab.params}
      groups={s.lab.paramGroups}
      values={effectiveParams}
      locked={locked}
      onChange={s.setParam}
      onToggleLock={s.toggleLock}
      onSetLocks={s.setLocks}
      morphing={morph > 0}
      blendedKeys={blendedKeys}
    />
  );
  const drawerEl = (
    <Drawer
      lab={s.lab}
      session={s.session}
      events={cycleEvents}
      inspected={inspected}
      onInspect={onInspect}
      onLoadStory={(story) => {
        s.loadStory(story);
        toast({ title: `STORY: ${story.name.toUpperCase()}`, description: story.note });
      }}
      diagnostics={audio.diagnostics}
      urlPayload={s.urlPayload}
      tab={drawerTab}
      onTab={setDrawerTab}
    />
  );

  return (
    <div className="sb-shell">
      <header className="sb-header bevel">
        <span className="sb-header__logo">◆ SOUNDBOOK</span>
        <span className="sb-header__lab">{s.lab.title.toUpperCase()}</span>
        <span className="sb-header__question">{s.lab.question}</span>
        <span className="sb-header__spacer" />
        <IconButton
          icon="eye"
          label="Toggle chrome variant"
          onClick={() => setChrome((c) => (c === 'dark' ? 'light' : 'dark'))}
        />
      </header>

      <TransportBar
        playing={audio.playing}
        onPlay={audio.play}
        onStop={audio.stop}
        onStep={audio.step}
        onRewind={audio.rewind}
        tempo={s.session.tempo}
        onTempo={s.setTempo}
        seed={s.session.seed}
        onSeed={s.setSeed}
        onReseed={s.reseed}
        onRandomize={s.randomize}
        canUndo={s.canUndo}
        canRedo={s.canRedo}
        onUndo={s.undo}
        onRedo={s.redo}
        hasB={s.session.b !== null}
        morph={morph}
        onMorph={setMorph}
        onSetB={() => {
          s.setB({ ...s.session.params });
          toast({ title: 'B STORED', description: 'Current parameters parked as morph target.' });
        }}
        onSwapAB={s.swapAB}
        onApplyMorph={onApplyMorph}
        onCopyLink={onCopyLink}
        onPublish={onPublish}
        onExport={onExport}
        exporting={exporting}
        compact={compact}
      />

      <div className="sb-body">
        {compact ? (
          <div className="sb-mobile">
            <div className="sb-mobile__stage">{stageEl}</div>
            {sheet !== 'none' && (
              <div className="sb-scrim" aria-hidden="true" onClick={() => setSheet('none')} />
            )}
            <div className={`sb-sheet sb-sheet--left${sheet === 'labs' ? ' sb-sheet--open' : ''}`}>
              <div className="sb-sheet__body">{browserEl}</div>
              <button
                type="button"
                className="sb-sheet__tab"
                aria-expanded={sheet === 'labs'}
                onClick={() => toggleSheet('labs')}
              >
                LABS
              </button>
            </div>
            <div
              className={`sb-sheet sb-sheet--right${sheet === 'params' ? ' sb-sheet--open' : ''}`}
            >
              <div className="sb-sheet__body">{paramsEl}</div>
              <button
                type="button"
                className="sb-sheet__tab"
                aria-expanded={sheet === 'params'}
                onClick={() => toggleSheet('params')}
              >
                PARAMS
              </button>
            </div>
            <div
              className={`sb-sheet sb-sheet--bottom${sheet === 'inspect' ? ' sb-sheet--open' : ''}`}
            >
              <div className="sb-sheet__body">{drawerEl}</div>
              <button
                type="button"
                className="sb-sheet__tab"
                aria-expanded={sheet === 'inspect'}
                onClick={() => toggleSheet('inspect')}
              >
                INSPECTOR
              </button>
            </div>
          </div>
        ) : (
          <SplitPane defaultSize={230} minSize={170} maxSize={400} label="Lab browser">
            {browserEl}
            <div className="sb-main">
              <div className="sb-workbench">
                {/* The params panel is the sized pane: drag the divider left
                    to widen it into the stage's room. */}
                <SplitPane
                  primary="second"
                  defaultSize={320}
                  minSize={320}
                  maxSize={720}
                  label="Parameters panel width"
                >
                  {stageEl}
                  {paramsEl}
                </SplitPane>
              </div>
              {drawerOpen && drawerEl}
            </div>
          </SplitPane>
        )}
      </div>

      <StatusBar className="sb-status">
        <LED tone={audio.playing ? 'active' : 'idle'} />
        <Readout label="TRANSPORT">{audio.playing ? 'PLAYING' : 'HOLD'}</Readout>
        <Readout label="POS">
          {bar}.{beatInBar}
        </Readout>
        <Readout label="TEMPO">{s.session.tempo} BPM</Readout>
        <Readout label="SEED" variant="accent">
          {s.session.seed}
        </Readout>
        <Readout label="CYCLE">{cycleBeats} beats</Readout>
        <Readout grow variant="dim">
          {s.lab.family.toUpperCase()} · v{s.lab.version} · {cycleEvents.length} events/cycle
        </Readout>
        <button
          type="button"
          className="sb-status__drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          {drawerOpen ? 'HIDE DRAWER' : 'SHOW DRAWER'}
        </button>
      </StatusBar>
    </div>
  );
}
