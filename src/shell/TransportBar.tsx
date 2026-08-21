/*
 * The command strip: transport, tempo, seed, undo/redo, A/B morph,
 * randomize, copy link, publish, export (WAV), code (standalone HTML+JS).
 * One Toolbar, grouped by separators, every control wired to the session
 * or audio APIs.
 */

import { useState, type JSX } from 'react';
import { Button } from '@simcity/components/Button';
import { IconButton } from '@simcity/components/IconButton';
import { NumberField } from '@simcity/components/NumberField';
import { Slider } from '@simcity/components/Slider';
import { Toolbar, ToolbarSeparator } from '@simcity/components/Toolbar';
import { Tooltip } from '@simcity/components/Tooltip';

interface TransportBarProps {
  playing: boolean;
  onPlay(): void;
  onStop(): void;
  onStep(): void;
  onRewind(): void;
  tempo: number;
  onTempo(tempo: number): void;
  seed: number;
  onSeed(seed: number): void;
  onReseed(): void;
  onRandomize(): void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  hasB: boolean;
  morph: number;
  onMorph(t: number): void;
  onSetB(): void;
  onSwapAB(): void;
  onApplyMorph(): void;
  onCopyLink(): void;
  onPublish(): void;
  onExport(): void;
  exporting: boolean;
  onExportCode(): void;
  exportingCode: boolean;
  /** Below the mobile breakpoint: transport only, session controls fold
      into an expandable second row behind a show/hide toggle. */
  compact?: boolean;
}

export function TransportBar(props: TransportBarProps): JSX.Element {
  const [more, setMore] = useState(false);

  const transport = (
    <>
      {props.playing ? (
        <Button variant="accent" icon="stop" onClick={props.onStop}>
          STOP
        </Button>
      ) : (
        <Button variant="accent" icon="play" onClick={props.onPlay}>
          PLAY
        </Button>
      )}
      <Tooltip content="Perform one beat, then hold">
        <Button icon="clock" onClick={props.onStep} disabled={props.playing}>
          STEP
        </Button>
      </Tooltip>
      <Tooltip content="Seek to beat zero">
        <IconButton icon="home" label="Rewind to start" onClick={props.onRewind} />
      </Tooltip>
    </>
  );

  const session = (
    <>
      <NumberField
        label="Tempo"
        value={props.tempo}
        min={40}
        max={240}
        step={1}
        onValueChange={(v) => v !== null && props.onTempo(v)}
        className="sb-transport__tempo"
      />
      <NumberField
        label="Seed"
        value={props.seed}
        min={0}
        max={4294967295}
        step={1}
        onValueChange={(v) => v !== null && props.onSeed(v >>> 0)}
        className="sb-transport__seed"
      />
      <Tooltip content="Draw a fresh seed">
        <IconButton icon="dice" label="Reseed" onClick={props.onReseed} />
      </Tooltip>
      <Tooltip content="Randomize unlocked parameters">
        <IconButton icon="shuffle" label="Randomize parameters" onClick={props.onRandomize} />
      </Tooltip>

      <ToolbarSeparator />

      <IconButton icon="undo" label="Undo" onClick={props.onUndo} disabled={!props.canUndo} />
      <IconButton icon="redo" label="Redo" onClick={props.onRedo} disabled={!props.canRedo} />

      <ToolbarSeparator />

      <Tooltip content="Store current parameters as morph target B">
        <Button icon="bookmark" onClick={props.onSetB}>
          SET B
        </Button>
      </Tooltip>
      <div className="sb-transport__morph">
        <Slider
          label="A→B"
          min={0}
          max={1}
          step={0.01}
          value={props.morph}
          onValueChange={props.onMorph}
          disabled={!props.hasB}
        />
      </div>
      <Tooltip content="Commit the blended parameters as A">
        <Button onClick={props.onApplyMorph} disabled={!props.hasB || props.morph === 0}>
          APPLY
        </Button>
      </Tooltip>
      <Tooltip content="Swap A and B">
        <Button onClick={props.onSwapAB} disabled={!props.hasB}>
          A⇄B
        </Button>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Copy this session's URL — the URL is the document">
        <Button icon="link" onClick={props.onCopyLink}>
          COPY LINK
        </Button>
      </Tooltip>
      <Tooltip content="Freeze this state onto the local published shelf">
        <Button icon="upload" onClick={props.onPublish}>
          PUBLISH
        </Button>
      </Tooltip>
      <Tooltip content="Render 4 cycles offline to a WAV file">
        <Button icon="download" onClick={props.onExport} disabled={props.exporting}>
          {props.exporting ? 'RENDERING…' : 'EXPORT'}
        </Button>
      </Tooltip>
      <Tooltip content="Download a ZIP of index.html + JS that reproduces exactly this state, standalone">
        <Button icon="build" onClick={props.onExportCode} disabled={props.exportingCode}>
          {props.exportingCode ? 'BUNDLING…' : 'CODE'}
        </Button>
      </Tooltip>
    </>
  );

  if (!props.compact) {
    return (
      <Toolbar aria-label="Transport and session" className="sb-transport">
        {transport}
        <ToolbarSeparator />
        {session}
      </Toolbar>
    );
  }

  return (
    <div className="sb-transport-stack">
      <Toolbar aria-label="Transport" className="sb-transport sb-transport--compact">
        {transport}
        <span className="sb-transport__spacer" />
        <IconButton
          icon={more ? 'chevron-up' : 'chevron-down'}
          label={more ? 'Hide session controls' : 'Show session controls'}
          variant={more ? 'accent' : 'default'}
          onClick={() => setMore((m) => !m)}
        />
      </Toolbar>
      {more && (
        <Toolbar aria-label="Session controls" className="sb-transport sb-transport--more">
          {session}
        </Toolbar>
      )}
    </div>
  );
}
