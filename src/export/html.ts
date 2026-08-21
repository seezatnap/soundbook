/*
 * The index.html of a code export: the settings summarized as a static
 * table (readable with scripts off), a transport the runtime fills with
 * PLAY / PAUSE / STOP, and the whole document — seed, tempo, every param —
 * passed explicitly to Soundbook.mount. Deliberately plain: a reader should
 * be able to open the file, read the state, change a number, reload, and
 * hear the difference.
 */

import type { LabDefinition } from '@/sdk/lab';
import type { ParamSpec, ParamValue } from '@/sdk/params';
import type { ExportState } from '@/export/runtime';

export interface ExportHtmlOptions {
  lab: LabDefinition;
  state: ExportState;
  /** File name of the bundled lab script, relative to index.html. */
  scriptFile: string;
  /** The workshop URL this export was taken from (the URL is the document). */
  sourceUrl?: string;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* HTML comments may not contain "--"; an em dash reads the same. */
const commentSafe = (text: string): string => escapeHtml(text).replace(/--/g, '—');

/** A param's value the way the workshop's panel shows it. */
export function formatParam(spec: ParamSpec, value: ParamValue): string {
  switch (spec.kind) {
    case 'select':
      return spec.options.find((option) => option.value === value)?.label ?? String(value);
    case 'toggle':
      return value ? 'On' : 'Off';
    case 'number':
      return spec.unit ? `${value} ${spec.unit}` : String(value);
    case 'int':
      return String(value);
  }
}

function settingsRows(lab: LabDefinition, state: ExportState): string {
  const row = (label: string, value: string, dim = false): string =>
    `<tr${dim ? ' class="dim"' : ''}><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
  const heading = (label: string): string =>
    `<tr class="group"><th colspan="2">${escapeHtml(label)}</th></tr>`;
  const specs = new Map(lab.params.map((spec) => [spec.key, spec]));
  const paramRow = (spec: ParamSpec): string =>
    row(
      spec.label,
      formatParam(spec, state.params[spec.key] ?? spec.default) +
        (state.locked?.includes(spec.key) ? ' (locked)' : ''),
      spec.control === true,
    );
  const rows: string[] = [
    heading('Session'),
    row('Lab', `${lab.title} — ${lab.id} v${lab.version}`),
    row('Seed', String(state.seed)),
    row('Tempo', `${state.tempo} BPM`),
  ];
  if (lab.paramGroups) {
    for (const group of lab.paramGroups) {
      rows.push(heading(group.label));
      for (const key of group.keys) {
        const spec = specs.get(key);
        if (spec) rows.push(paramRow(spec));
      }
    }
  } else {
    rows.push(heading('Parameters'));
    for (const spec of lab.params) rows.push(paramRow(spec));
  }
  return rows.join('\n');
}

export function renderExportHtml({ lab, state, scriptFile, sourceUrl }: ExportHtmlOptions): string {
  /* "</script>" inside a string literal would end the tag early. */
  const json = JSON.stringify(state, null, 2).replace(/</g, '\\u003c');
  const source = sourceUrl
    ? `<meta name="soundbook-source" content="${escapeHtml(sourceUrl)}">\n`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(lab.title)} — seed ${state.seed}</title>
${source}<!--
  ${commentSafe(lab.title)} (Soundbook lab "${lab.id}" v${lab.version})
  ${commentSafe(lab.question)}

  A standalone, audio-only reproduction of one Soundbook session.
  ${commentSafe(scriptFile)} is the lab and its player, bundled; the state passed to
  Soundbook.mount at the bottom is the entire document. Same seed + params
  + tempo → the same events, every time, on any machine. Edit a value,
  reload, and the music follows. Soundbook.lab is the lab definition:
  Soundbook.lab.events({params, seed, range: {from: 0, to: 16}}) lists the
  notes, each with its provenance.
-->
<style>
html{background:#1d2523;color:#e3ede8;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}
body{max-width:720px;margin:0 auto;padding:24px 16px}
h1{font-size:15px;letter-spacing:2px;color:#f0a830;margin:0 0 4px}
p{color:#9db0a8;margin:0 0 16px}
#transport{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;background:#3c4a46;border:1px solid #171d1c;margin-bottom:16px}
#transport button{font:inherit;letter-spacing:1px;padding:4px 14px;background:#485652;color:#e3ede8;border:1px solid #171d1c;cursor:pointer}
#transport button:first-child{background:#f0a830;color:#1b1305}
#transport button:active{filter:brightness(.85)}
#transport span{margin-left:auto;color:#9db0a8}
table{width:100%;border-collapse:collapse;background:#2a3331;border:1px solid #171d1c}
th,td{text-align:left;padding:4px 10px;border-top:1px solid #171d1c;vertical-align:top}
th{font-weight:normal;color:#9db0a8;width:40%}
tr.group th{color:#5ad2c0;letter-spacing:1px;padding-top:10px}
tr.dim td,tr.dim th{color:#6c7c76}
</style>
</head>
<body>
<h1>${escapeHtml(lab.title.toUpperCase())}</h1>
<p>${escapeHtml(lab.question)}</p>
<div id="transport"></div>
<table>
${settingsRows(lab, state)}
</table>
<script src="${escapeHtml(scriptFile)}"></script>
<script>
Soundbook.mount(document.getElementById('transport'), ${json});
</script>
</body>
</html>
`;
}
