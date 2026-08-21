/*
 * The CODE button: bundle the current session into a ZIP of index.html +
 * <lab>.js that plays exactly this document, standalone and audio-only.
 * The script comes prebuilt from the Vite plugin (one bundle per lab,
 * lazily loaded); the HTML carries the state.
 */

import { loadBundle } from 'virtual:soundbook-export';
import type { LabDefinition } from '@/sdk/lab';
import type { ParamValues } from '@/sdk/params';
import { renderExportHtml } from '@/export/html';
import type { ExportState } from '@/export/runtime';
import { zip } from '@/export/zip';

export interface CodeExportRequest {
  lab: LabDefinition;
  seed: number;
  tempo: number;
  /** What the ear gets — the effective params, morph already resolved. */
  params: ParamValues;
  locked?: readonly string[];
  sourceUrl?: string;
}

export interface CodeExport {
  blob: Blob;
  files: string[];
  /** Size of the standalone script, in bytes. */
  scriptBytes: number;
}

export function exportFileName(lab: LabDefinition, seed: number): string {
  return `${lab.id}-seed${seed}.zip`;
}

export async function buildCodeExport(req: CodeExportRequest): Promise<CodeExport> {
  const code = await loadBundle(req.lab.id);
  const state: ExportState = {
    seed: req.seed >>> 0,
    tempo: req.tempo,
    params: { ...req.params },
  };
  /* Locks matter only to AutoRandomize; transport controls can't be locked. */
  const lockable = (req.locked ?? []).filter((key) =>
    req.lab.params.some((spec) => spec.key === key && !spec.control),
  );
  if (lockable.length > 0) state.locked = [...new Set(lockable)].sort();

  const scriptFile = `${req.lab.id}.js`;
  const html = renderExportHtml({ lab: req.lab, state, scriptFile, sourceUrl: req.sourceUrl });
  const blob = await zip([
    { name: 'index.html', data: html },
    { name: scriptFile, data: code },
  ]);
  return { blob, files: ['index.html', scriptFile], scriptBytes: code.length };
}
