#!/usr/bin/env node
/*
 * Integrity checker for a vendored SIM CITY DESIGN SYSTEM tree.
 *
 * Compares every file against MANIFEST.txt and cross-references
 * LOCAL_CHANGELOG.md: every modified, added, or deleted file must be claimed
 * by at least one [LOCAL] entry. Exit 0 = clean or fully documented;
 * exit 1 = undocumented drift or malformed changelog.
 *
 * Zero dependencies; runs with any Node >= 18 from any working directory:
 *   node vendor/sim-city-design-system/check-local-changes.mjs
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/* Files outside manifest discipline. */
const IGNORED = new Set(['LOCAL_CHANGELOG.md', 'LOCAL_CHANGELOG.md.bak', 'MANIFEST.txt', '.DS_Store']);

function hashFile(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
}

/* ---- manifest ---- */
const manifestPath = path.join(root, 'MANIFEST.txt');
if (!existsSync(manifestPath)) {
  console.error('FAIL: MANIFEST.txt missing — this tree is not an intact distribution.');
  process.exit(1);
}
const manifest = new Map();
for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
  const m = line.match(/^([0-9a-f]{16})  (.+)$/);
  if (m) manifest.set(m[2], m[1]);
}

/* ---- changelog ---- */
const changelogPath = path.join(root, 'LOCAL_CHANGELOG.md');
const claimed = new Set();
const claimedDeleted = new Set();
const stampedClaimed = new Set();
const problems = [];
let entryCount = 0;
if (existsSync(changelogPath)) {
  const lines = readFileSync(changelogPath, 'utf8').split('\n');
  let current = null; // 'local' | 'stamped' | null
  let inFiles = false;
  for (const line of lines) {
    const header = line.match(/^## \[([A-Z]+)([^\]]*)\] (\d{4}-\d{2}-\d{2})\s+(\S+)/);
    if (line.startsWith('## ')) {
      if (!header) {
        problems.push(`Malformed entry header: "${line.trim()}"`);
        current = null;
      } else {
        const kind = header[1];
        if (!['LOCAL', 'UPSTREAMED', 'REJECTED'].includes(kind)) {
          problems.push(`Unknown entry kind [${kind}${header[2]}] in "${line.trim()}"`);
        }
        current = kind === 'LOCAL' ? 'local' : 'stamped';
        if (kind === 'LOCAL') entryCount++;
      }
      inFiles = false;
      continue;
    }
    if (/^Files:\s*$/.test(line)) {
      inFiles = current !== null;
      continue;
    }
    if (inFiles) {
      const f = line.match(/^- (.+?)(\s+\(deleted\))?\s*$/);
      if (f) {
        if (current === 'local') (f[2] ? claimedDeleted : claimed).add(f[1]);
        else if (current === 'stamped') stampedClaimed.add(f[1]);
      } else if (line.trim() !== '') {
        inFiles = false;
      }
    }
  }
} else {
  problems.push('LOCAL_CHANGELOG.md is missing (it ships with the tarball; restore it).');
}

/* ---- walk tree ---- */
const present = new Map();
(function walk(rel) {
  for (const entry of readdirSync(path.join(root, rel)).sort()) {
    const relPath = rel === '' ? entry : `${rel}/${entry}`;
    const full = path.join(root, relPath);
    if (statSync(full).isDirectory()) walk(relPath);
    else if (!(rel === '' && IGNORED.has(entry))) present.set(relPath, hashFile(full));
  }
})('');

/* ---- reconcile ---- */
const modifiedUnclaimed = [];
const stampedPending = [];
const modifiedClaimed = [];
const addedUnclaimed = [];
const addedClaimed = [];
const deletedUnclaimed = [];
const deletedClaimed = [];
const claimedButPristine = [];

for (const [rel, hash] of manifest) {
  if (!present.has(rel)) {
    (claimedDeleted.has(rel) ? deletedClaimed : deletedUnclaimed).push(rel);
  } else if (present.get(rel) !== hash) {
    if (claimed.has(rel)) modifiedClaimed.push(rel);
    else if (stampedClaimed.has(rel)) stampedPending.push(rel);
    else modifiedUnclaimed.push(rel);
  }
}
for (const rel of present.keys()) {
  if (!manifest.has(rel)) (claimed.has(rel) ? addedClaimed : addedUnclaimed).push(rel);
}
for (const rel of claimed) {
  if (manifest.has(rel) && present.has(rel) && present.get(rel) === manifest.get(rel)) {
    claimedButPristine.push(rel);
  }
  if (!manifest.has(rel) && !present.has(rel)) {
    problems.push(`Changelog claims unknown file: ${rel}`);
  }
}

/* ---- report ---- */
const say = (label, list) => list.length && console.log(`${label}\n${list.map((f) => '  ' + f).join('\n')}`);
say('Modified, documented:', modifiedClaimed);
say('Added, documented:', addedClaimed);
say('Deleted, documented:', deletedClaimed);
say('NOTE — claimed by a [LOCAL] entry but identical to the manifest (stale claim, or an edit lost in an update):', claimedButPristine);
say('NOTE — modified, claimed only by a stamped entry (folded upstream; update to the new tarball to clear):', stampedPending);
say('ERROR — modified without a changelog entry:', modifiedUnclaimed);
say('ERROR — added without a changelog entry:', addedUnclaimed);
say('ERROR — deleted without a changelog entry:', deletedUnclaimed);
for (const p of problems) console.log('ERROR — ' + p);

const errors =
  modifiedUnclaimed.length + addedUnclaimed.length + deletedUnclaimed.length + problems.length;
const touched = modifiedClaimed.length + addedClaimed.length + deletedClaimed.length;
if (errors) {
  console.log(`\nFAIL: ${errors} problem(s). Log the change in LOCAL_CHANGELOG.md (see INSTRUCTIONS.md) or revert it.`);
  process.exit(1);
}
console.log(
  touched
    ? `\nOK: ${touched} file(s) locally changed, all documented across ${entryCount} [LOCAL] entr${entryCount === 1 ? 'y' : 'ies'}.`
    : '\nOK: tree is pristine against MANIFEST.txt.',
);
