/*
 * Generated controls. One row per ParamSpec: the control itself (slider,
 * stepper, select or switch), exact numeric entry where it applies, a lock
 * (randomize skips locked params) and a reset-to-default. Nothing here is
 * lab-specific — the schema is the single source of truth. A lab that
 * declares paramGroups gets one folder tab per group; the rows themselves
 * are identical either way.
 */

import { type JSX } from 'react';
import { IconButton } from '@simcity/components/IconButton';
import { NumberField } from '@simcity/components/NumberField';
import { Panel } from '@simcity/components/Panel';
import { Select } from '@simcity/components/Select';
import { Slider } from '@simcity/components/Slider';
import { Switch } from '@simcity/components/Switch';
import { Callout } from '@simcity/components/Callout';
import { Tab, TabList, TabPanel, Tabs } from '@simcity/components/Tabs';
import type { ParamGroup } from '@/sdk/lab';
import type { ParamSpec, ParamValues } from '@/sdk/params';

interface ParamPanelProps {
  specs: readonly ParamSpec[];
  /** Tabbed grouping for console labs; absent renders the flat panel. */
  groups?: readonly ParamGroup[];
  values: ParamValues;
  locked: ReadonlySet<string>;
  onChange(key: string, value: ParamValues[string]): void;
  onToggleLock(key: string): void;
  /** Morphing freezes editing so A stays A while you audition the blend. */
  morphing: boolean;
  /** Keys whose effective value is a true A/B blend — shown as ‹blended›. */
  blendedKeys: readonly string[];
}

interface ParamRowProps {
  spec: ParamSpec;
  value: ParamValues[string];
  isLocked: boolean;
  isBlended: boolean;
  morphing: boolean;
  onChange(key: string, value: ParamValues[string]): void;
  onToggleLock(key: string): void;
}

function ParamRow({
  spec,
  value,
  isLocked,
  isBlended,
  morphing,
  onChange,
  onToggleLock,
}: ParamRowProps): JSX.Element {
  const isDefault = value === spec.default;
  return (
    <div className="sb-params__row" title={spec.hint}>
      <div className="sb-params__control">
        {spec.kind === 'number' && (
          <div className="sb-params__numberpair">
            <Slider
              label={spec.label}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={value as number}
              onValueChange={(v) => onChange(spec.key, v)}
              showValue
              getValueText={(v) => `${v}${spec.unit ? ` ${spec.unit}` : ''}`}
              disabled={morphing}
              className="sb-params__slider"
            />
            <NumberField
              value={value as number}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              onValueChange={(v) => v !== null && onChange(spec.key, v)}
              disabled={morphing}
              className="sb-params__exact"
            />
          </div>
        )}
        {spec.kind === 'int' && (
          <NumberField
            label={spec.label}
            value={value as number}
            min={spec.min}
            max={spec.max}
            step={1}
            onValueChange={(v) => v !== null && onChange(spec.key, Math.round(v))}
            disabled={morphing}
          />
        )}
        {spec.kind === 'select' && (
          <Select
            label={spec.label}
            options={spec.options}
            value={isBlended ? null : (value as string)}
            placeholder={isBlended ? '‹blended›' : undefined}
            onValueChange={(v) => v !== null && onChange(spec.key, v)}
            disabled={morphing}
          />
        )}
        {spec.kind === 'toggle' && (
          <Switch
            label={spec.label}
            checked={value as boolean}
            onCheckedChange={(v) => onChange(spec.key, v)}
            disabled={morphing}
          />
        )}
      </div>
      <div className="sb-params__tools">
        {/* Transport controls are immune to randomize and morph by
            definition — a lock would have nothing to hold. */}
        {!spec.control && (
          <IconButton
            icon={isLocked ? 'lock' : 'unlock'}
            label={isLocked ? `Unlock ${spec.label}` : `Lock ${spec.label} against randomize and morph`}
            size="sm"
            variant={isLocked ? 'accent' : 'default'}
            onClick={() => onToggleLock(spec.key)}
          />
        )}
        <IconButton
          icon="refresh"
          label={`Reset ${spec.label} to default`}
          size="sm"
          disabled={isDefault || morphing}
          onClick={() => onChange(spec.key, spec.default)}
        />
      </div>
    </div>
  );
}

export function ParamPanel({
  specs,
  groups,
  values,
  locked,
  onChange,
  onToggleLock,
  morphing,
  blendedKeys,
}: ParamPanelProps): JSX.Element {
  const rows = (list: readonly ParamSpec[]): JSX.Element[] =>
    list.map((spec) => (
      <ParamRow
        key={spec.key}
        spec={spec}
        value={values[spec.key]}
        isLocked={locked.has(spec.key)}
        isBlended={blendedKeys.includes(spec.key)}
        morphing={morphing}
        onChange={onChange}
        onToggleLock={onToggleLock}
      />
    ));

  const morphCallout = morphing && (
    <Callout variant="info" title="MORPHING">
      Hearing the A→B blend. APPLY commits it; morph to 0 returns to A.
    </Callout>
  );

  if (groups && groups.length > 0) {
    const byKey = new Map(specs.map((spec) => [spec.key, spec]));
    return (
      <Panel title="PARAMETERS" className="sb-params" flush>
        <Tabs defaultValue={groups[0].id} className="sb-params__tabs">
          <TabList aria-label="Parameter groups">
            {groups.map((group) => (
              <Tab key={group.id} value={group.id}>
                {group.label.toUpperCase()}
              </Tab>
            ))}
          </TabList>
          {groups.map((group) => (
            <TabPanel key={group.id} value={group.id} className="sb-params__tabpanel">
              <div className="sb-params__body">
                {morphCallout}
                {rows(group.keys.flatMap((key) => byKey.get(key) ?? []))}
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </Panel>
    );
  }

  return (
    <Panel title="PARAMETERS" className="sb-params" flush>
      <div className="sb-params__body">
        {morphCallout}
        {rows(specs)}
      </div>
    </Panel>
  );
}
