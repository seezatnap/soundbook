/*
 * The inspection drawer: Events (this cycle's ledger), Provenance (why one
 * event exists), State (the serialized document), Docs (the lab's notes and
 * stories), Diagnostics (engine vitals). The drawer answers questions; the
 * stage asks them.
 */

import { useMemo, type JSX } from 'react';
import { Badge } from '@simcity/components/Badge';
import { Button } from '@simcity/components/Button';
import { DataTable, type DataTableColumn } from '@simcity/components/DataTable';
import { DataList, DataListRow } from '@simcity/components/DataList';
import { EmptyState } from '@simcity/components/EmptyState';
import { Tab, TabList, TabPanel, Tabs } from '@simcity/components/Tabs';
import { Well } from '@simcity/components/Well';
import { midiName, type NoteEvent } from '@/sdk/events';
import type { LabDefinition, Story } from '@/sdk/lab';
import type { Session } from '@/shell/useSession';

interface DrawerProps {
  lab: LabDefinition;
  session: Session;
  events: NoteEvent[];
  inspected: NoteEvent | null;
  onInspect(event: NoteEvent): void;
  onLoadStory(story: Story): void;
  diagnostics(): Record<string, string | number>;
  urlPayload: string;
  tab: string;
  onTab(tab: string): void;
}

function freqLabel(freq: number): string {
  const midi = 69 + 12 * Math.log2(freq / 440);
  return `${midiName(midi)} (${freq.toFixed(1)} Hz)`;
}

export function Drawer({
  lab,
  session,
  events,
  inspected,
  onInspect,
  onLoadStory,
  diagnostics,
  urlPayload,
  tab,
  onTab,
}: DrawerProps): JSX.Element {
  const columns = useMemo<Array<DataTableColumn<NoteEvent>>>(
    () => [
      { key: 'beat', header: 'BEAT', width: 80, render: (ev) => ev.beat.toFixed(2), sortable: true },
      { key: 'voice', header: 'VOICE', width: 90, sortable: true },
      { key: 'freq', header: 'PITCH', width: 150, render: (ev) => freqLabel(ev.freq) },
      { key: 'gain', header: 'GAIN', width: 70, render: (ev) => ev.gain.toFixed(2) },
      {
        key: 'provenance',
        header: 'FIRST CAUSE',
        render: (ev) => ev.provenance[0]?.rule ?? '—',
      },
    ],
    [],
  );

  const stateJson = useMemo(
    () =>
      JSON.stringify(
        {
          lab: session.labId,
          version: lab.version,
          seed: session.seed,
          tempo: session.tempo,
          params: session.params,
          b: session.b ?? undefined,
        },
        null,
        2,
      ),
    [session, lab],
  );

  const diag = diagnostics();

  return (
    <div className="sb-drawer">
      <Tabs value={tab} onValueChange={onTab} className="sb-drawer__tabs">
        <TabList aria-label="Inspectors">
          <Tab value="events">EVENTS</Tab>
          <Tab value="provenance">
            PROVENANCE
            {inspected ? <Badge variant="accent">1</Badge> : null}
          </Tab>
          <Tab value="state">STATE</Tab>
          <Tab value="docs">DOCS</Tab>
          <Tab value="diagnostics">DIAGNOSTICS</Tab>
        </TabList>

        <TabPanel value="events" className="sb-drawer__panel">
          <DataTable
            aria-label="Events in the current cycle"
            columns={columns}
            rows={events}
            rowKey={(ev) => ev.id}
            density="compact"
            maxHeight={170}
            selectionMode="single"
            selectedKeys={inspected ? [inspected.id] : []}
            onSelectionChange={(keys) => {
              const hit = events.find((ev) => ev.id === keys[0]);
              if (hit) onInspect(hit);
            }}
            emptyState={
              <EmptyState
                icon="bell"
                title="NO EVENTS THIS CYCLE"
                description="Raise density, or press play to advance."
              />
            }
          />
        </TabPanel>

        <TabPanel value="provenance" className="sb-drawer__panel">
          {inspected ? (
            <div className="sb-drawer__columns">
              <Well className="sb-drawer__provenance">
                <div className="sb-drawer__prov-head">
                  {inspected.id} · beat {inspected.beat.toFixed(2)} · {freqLabel(inspected.freq)}
                </div>
                <ol className="sb-drawer__causes">
                  {inspected.provenance.map((cause, i) => (
                    <li key={i}>
                      <Badge variant={i === 0 ? 'accent' : 'default'}>{cause.rule}</Badge>
                      <span className="sb-drawer__cause-detail">{cause.detail}</span>
                    </li>
                  ))}
                </ol>
              </Well>
              {inspected.data && (
                <DataList aria-label="Event payload" className="sb-drawer__payload">
                  {Object.entries(inspected.data).map(([key, value]) => (
                    <DataListRow key={key} label={key.toUpperCase()}>
                      {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 3) : value}
                    </DataListRow>
                  ))}
                </DataList>
              )}
            </div>
          ) : (
            <EmptyState
              icon="inspect"
              title="NOTHING UNDER THE GLASS"
              description="Click an event in the stage or the EVENTS table to ask why it happened."
            />
          )}
        </TabPanel>

        <TabPanel value="state" className="sb-drawer__panel">
          <div className="sb-drawer__columns">
            <Well className="sb-drawer__state">
              <pre>{stateJson}</pre>
            </Well>
            <div className="sb-drawer__statemeta">
              <DataList aria-label="Serialization">
                <DataListRow label="FRAGMENT">{urlPayload.length} chars</DataListRow>
                <DataListRow label="CODEC">deflate-raw + base64url, v1</DataListRow>
                <DataListRow label="PROMISE">same URL → same events</DataListRow>
              </DataList>
              <Button
                icon="copy"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(stateJson).catch(() => {})}
              >
                COPY STATE
              </Button>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="docs" className="sb-drawer__panel">
          <div className="sb-drawer__docs">
            <div className="sb-drawer__question">{lab.question}</div>
            {lab.docs.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <div className="sb-drawer__stories">
              {lab.stories.map((story) => (
                <div key={story.name} className="sb-drawer__story">
                  <Button size="sm" icon="play" onClick={() => onLoadStory(story)}>
                    {story.name.toUpperCase()}
                  </Button>
                  <span className="sb-drawer__story-note">{story.note}</span>
                </div>
              ))}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="diagnostics" className="sb-drawer__panel">
          <DataList aria-label="Engine diagnostics">
            {Object.entries(diag).map(([key, value]) => (
              <DataListRow key={key} label={key.toUpperCase()}>
                {value}
              </DataListRow>
            ))}
            <DataListRow label="GUARANTEES">
              seeded PRNG only · no Math.random in musical code · 32-voice cap · one AudioContext
            </DataListRow>
          </DataList>
        </TabPanel>
      </Tabs>
    </div>
  );
}
