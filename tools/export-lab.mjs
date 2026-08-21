#!/usr/bin/env node
// @ts-check
/*
 * Produce a code export from the command line — the same index.html +
 * <lab>.js pair the CODE button downloads, without a browser:
 *
 *   npm run export:lab -- <lab-id> [--story "Name"] [--seed N] [--tempo N]
 *                                  [--param key=value ...] [--out dir]
 *
 * Writes dist-export/<lab-id>/ by default. Open index.html in a browser
 * (file:// is fine — the script is a classic IIFE) and press PLAY. Audio
 * only: the lab's stage.ts is never part of the bundle.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundleForNode, bundleLab, listLabIds } from './export-bundler.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const labId = args.find((arg) => !arg.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const paramFlags = args.flatMap((arg, i) => (arg === '--param' ? [args[i + 1]] : []));

if (!labId) {
  console.error(`usage: export-lab <lab-id> [--story "Name"] [--seed N] [--tempo N] [--param key=value] [--out dir]`);
  console.error(`labs: ${listLabIds(root).join(', ')}`);
  process.exit(2);
}

/* The app's registry + HTML renderer, bundled for node so "@/" resolves. */
const cacheDir = path.join(root, 'node_modules', '.cache', 'soundbook-export');
mkdirSync(cacheDir, { recursive: true });
const helperFile = path.join(cacheDir, 'cli.mjs');
writeFileSync(helperFile, await bundleForNode(root, 'src/export/cli.ts'));
const app = await import(pathToFileURL(helperFile).href);

const lab = app.findLab(labId);
if (!lab) {
  console.error(`unknown lab "${labId}" — registered: ${app.LABS.map((l) => l.id).join(', ')}`);
  process.exit(2);
}

const storyName = flag('story');
const story = storyName
  ? lab.stories.find((s) => s.name.toLowerCase() === storyName.toLowerCase())
  : undefined;
if (storyName && !story) {
  console.error(`unknown story "${storyName}" — ${lab.stories.map((s) => `"${s.name}"`).join(', ')}`);
  process.exit(2);
}

const overrides = {};
for (const pair of paramFlags) {
  const eq = pair.indexOf('=');
  if (eq === -1) continue;
  const key = pair.slice(0, eq);
  const raw = pair.slice(eq + 1);
  overrides[key] = raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
}

const state = {
  seed: Number(flag('seed') ?? story?.seed ?? 1) >>> 0,
  tempo: Number(flag('tempo') ?? 120),
  params: app.sanitizeAll(lab.params, { ...app.defaultsOf(lab.params), ...story?.params, ...overrides }),
};

const bundle = await bundleLab(root, labId);
const scriptFile = `${labId}.js`;
const html = app.renderExportHtml({ lab, state, scriptFile });

const outDir = path.resolve(root, flag('out') ?? path.join('dist-export', labId));
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'index.html'), html);
writeFileSync(path.join(outDir, scriptFile), bundle.code);
console.log(
  `${path.relative(root, outDir)}/ — index.html (${html.length} B) + ${scriptFile} (${bundle.code.length} B, ${bundle.moduleIds.length} modules)` +
    `\nseed ${state.seed} · ${state.tempo} BPM${story ? ` · story "${story.name}"` : ''}`,
);
