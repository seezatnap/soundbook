/*
 * The export promise, enforced: every registered lab bundles into a
 * standalone, audio-only, React-free script whose lab definition reproduces
 * the workshop's events bit-for-bit — for defaults and for every story —
 * and the HTML + ZIP around it round-trip. A lab whose index.ts pulls in
 * React, the design system, the shell or any stage code fails here, which
 * is the point: the Code button must work for every lab, always.
 */

/// <reference types="node" />
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { LABS } from '@/labs/registry';
import { defaultsOf, sanitizeAll } from '@/sdk/params';
import type { LabDefinition } from '@/sdk/lab';
import { formatParam, renderExportHtml } from '@/export/html';
import type { ExportState } from '@/export/runtime';
import { crc32, zip } from '@/export/zip';
import {
  bundleLab,
  labModulePath,
  listLabIds,
  type LabBundle,
} from '../../../tools/export-bundler.mjs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');

/* A standalone script must stay small enough to be a thing people open
   and read — it ships unminified, comments and all. DroneLab (three labs +
   harmonizer + rooms) is the largest. */
const MAX_SCRIPT_BYTES = 200_000;

/** Evaluate the IIFE in a bare realm and hand back its `Soundbook` global. */
function evaluate(bundle: LabBundle): { lab: LabDefinition; mount: unknown } {
  const sandbox: Record<string, unknown> = { console, performance, crypto: globalThis.crypto };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(bundle.code, context, { filename: `${bundle.id}.js` });
  return sandbox.Soundbook as { lab: LabDefinition; mount: unknown };
}

describe('code export', () => {
  it('lists exactly the registered labs, one folder per lab id', () => {
    expect(listLabIds(root)).toEqual(LABS.map((lab) => lab.id).sort());
    for (const lab of LABS) expect(existsSync(labModulePath(root, lab.id))).toBe(true);
  });

  for (const lab of LABS) {
    describe(lab.id, () => {
      let bundle: LabBundle;
      beforeAll(async () => {
        bundle = await bundleLab(root, lab.id);
      }, 60_000);

      it('bundles standalone and readable: audio only — no React, design system, shell or stage', () => {
        const offenders = bundle.moduleIds.filter(
          (id) =>
            id.includes('node_modules') ||
            id.includes('/vendor/') ||
            id.includes('/src/shell/') ||
            id.endsWith('.tsx') ||
            id.endsWith('/stage.ts'),
        );
        expect(offenders).toEqual([]);
        expect(bundle.code.length).toBeLessThan(MAX_SCRIPT_BYTES);
        expect(bundle.code).toMatch(/\nvar Soundbook = \(function \(\) \{/);
        expect(bundle.code).toContain('function rngFor(');
      });

      it('keeps every source comment: file headers, doc comments, inline notes, type contracts', () => {
        for (const file of bundle.moduleIds) {
          const source = readFileSync(file, 'utf8');
          /* Each file is a labelled section… */
          expect(bundle.code).toContain(` * ${path.relative(root, file)}\n`);
          /* …and every line of every comment in it survives — verbatim in
             code, or inside a commented-out interface / type alias. */
          for (const comment of source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) ?? []) {
            for (const line of comment.split('\n')) {
              if (line.trim()) expect(bundle.code).toContain(line.trim());
            }
          }
        }
        /* The contracts themselves read on, as comments — including those
           the lab only imported as types. */
        expect(bundle.code).toContain('// export interface EngineFacade {');
        expect(bundle.code).toContain('// export interface Instrument {');
        expect(bundle.code).toContain('// export interface NoteEvent {');
        /* Stripped annotations leave no gaps behind. */
        expect(bundle.code.match(/.{0,40}\w {2,}[=;,)].{0,20}/)?.[0]).toBeUndefined();
      });

      it('reproduces the workshop events for the defaults and every story', () => {
        const exported = evaluate(bundle);
        expect(exported.lab.id).toBe(lab.id);
        expect(exported.lab.version).toBe(lab.version);
        expect(typeof exported.mount).toBe('function');
        const cases = [
          { seed: 1234, params: defaultsOf(lab.params) },
          ...lab.stories.map((story) => ({
            seed: story.seed,
            params: sanitizeAll(lab.params, { ...defaultsOf(lab.params), ...story.params }),
          })),
        ];
        for (const { seed, params } of cases) {
          const here = JSON.stringify(lab.events({ params, seed, range: { from: 0, to: 24 } }));
          const there = JSON.stringify(
            exported.lab.events({ params, seed, range: { from: 0, to: 24 } }),
          );
          expect(there).toBe(here);
        }
      });
    });
  }
});

describe('export html', () => {
  it('carries the whole document and the bundled script', () => {
    const lab = LABS[0];
    const state: ExportState = { seed: 42, tempo: 133, params: { ...defaultsOf(lab.params), freq: 440 } };
    const html = renderExportHtml({
      lab,
      state,
      scriptFile: `${lab.id}.js`,
      sourceUrl: 'https://soundbook.example/#1.abc--def',
    });
    expect(html).toContain(`<script src="${lab.id}.js"></script>`);
    expect(html).toContain("Soundbook.mount(document.getElementById('transport'), {");
    expect(html).toContain('"seed": 42');
    expect(html).toContain('"tempo": 133');
    /* Every param is both in the state and summarized, labelled, in the table. */
    for (const spec of lab.params) {
      expect(html).toContain(`"${spec.key}":`);
      expect(html).toContain(`<th>${spec.label}</th><td>${formatParam(spec, state.params[spec.key])}</td>`);
    }
    expect(html).toContain('<td>440 Hz</td>');
    expect(html).toContain('soundbook-source');
    /* Grouped labs get one heading per tab. */
    const dl = LABS.find((l) => l.id === 'drone-lab')!;
    const grouped = renderExportHtml({
      lab: dl,
      state: { seed: 1, tempo: 120, params: defaultsOf(dl.params) },
      scriptFile: 'drone-lab.js',
    });
    for (const group of dl.paramGroups!) expect(grouped).toContain(`<th colspan="2">${group.label}</th>`);
    /* The comment never contains "--" (it would end the comment early). */
    const comment = html.slice(html.indexOf('<!--'), html.indexOf('-->'));
    expect(comment.slice(4)).not.toContain('--');
  });
});

describe('zip', () => {
  it('writes a deflated archive that inflates back to its files', async () => {
    const files = [
      { name: 'index.html', data: '<!doctype html>'.repeat(40) },
      { name: 'lab.js', data: new TextEncoder().encode('var Soundbook=1;'.repeat(50)) },
    ];
    const bytes = new Uint8Array(await (await zip(files)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    /* End record → central directory → each entry. */
    const endAt = bytes.length - 22;
    expect(view.getUint32(endAt, true)).toBe(0x06054b50);
    const count = view.getUint16(endAt + 10, true);
    expect(count).toBe(2);
    let at = view.getUint32(endAt + 16, true);
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      const method = view.getUint16(at + 10, true);
      const crc = view.getUint32(at + 16, true);
      const csize = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true);
      const offset = view.getUint32(at + 42, true);
      const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
      expect(view.getUint32(offset, true)).toBe(0x04034b50);
      const dataAt = offset + 30 + view.getUint16(offset + 26, true);
      const packed = bytes.subarray(dataAt, dataAt + csize);
      const raw =
        method === 8
          ? new Uint8Array(
              await new Response(
                new Blob([packed as BlobPart])
                  .stream()
                  .pipeThrough(new DecompressionStream('deflate-raw')),
              ).arrayBuffer(),
            )
          : packed;
      const expected = files.find((f) => f.name === name)!;
      const expectedBytes =
        typeof expected.data === 'string' ? new TextEncoder().encode(expected.data) : expected.data;
      expect(decoder.decode(raw)).toBe(decoder.decode(expectedBytes));
      expect(crc).toBe(crc32(expectedBytes));
      at += 46 + nameLen;
    }
  });
});
