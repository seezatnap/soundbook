/*
 * The command strip: transport, tempo, seed, undo/redo, A/B morph,
 * randomize, copy link, publish, export. One Toolbar, grouped by
 * separators, every control wired to the session or audio APIs.
 */

import { type JSX } from 'react';
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
}

export function TransportBar(props: TransportBarProps): JSX.Element {
  return (
    <Toolbar aria-label="Transport and session" className="sb-transport">
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

      <ToolbarSeparator />

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
    </Toolbar>
  );
}
