// @ts-check
/*
 * Build-time bundling for Code export. A lab's standalone script is its
 * definition (src/labs/<id>/index.ts — never stage.ts) plus the export
 * runtime (src/export/runtime.ts), linked into one readable, audio-only
 * classic script that defines `Soundbook = { lab, mount }`.
 *
 * This is deliberately not a minifying bundler. An export is meant to be
 * read — by a person, or by an agent downstream — so every source module
 * is kept as a labelled section with its types stripped and every comment
 * exactly where it was: file headers, doc comments, inline notes. Only the
 * module boundaries are rewritten: an `import { a, b } from '@/x'` becomes
 * `const { a, b } = sdk_x;` where it stood, and each section ends with a
 * `return { ...its exports }`. Modules are emitted dependency-first, so
 * plain destructuring is enough (the project has no import cycles).
 *
 * Types are stripped with node's `module.stripTypeScriptTypes` (exact
 * layout, whitespace in place of types) when available, and with the
 * TypeScript compiler otherwise (comments kept, code re-printed). With the
 * exact stripper, interfaces and type aliases — contracts an agent reading
 * the export wants — are kept as `//` comments rather than dropped, and the
 * whitespace left where annotations stood is removed.
 *
 * Shared by the Vite plugin (serving bundles to the CODE button), the
 * export test suite (proving every lab links React-free, stage-free and
 * reproduces its events), and the CLI.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { rolldown } from 'rolldown';

/** Lab ids are folder names: every src/labs/<id>/index.ts is exportable. */
export function listLabIds(root) {
  const dir = path.join(root, 'src', 'labs');
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, 'index.ts')))
    .map((entry) => entry.name)
    .sort();
}

export function labModulePath(root, id) {
  return path.join(root, 'src', 'labs', id, 'index.ts');
}

/* ---------------------------------------------------------- type strip */

/** Node ≥ 22.13's whitespace-preserving stripper, when present. */
function exactStripper() {
  return /** @type {((code: string, opts: { mode: 'strip' }) => string) | undefined} */ (
    /** @type {any} */ (nodeModule).stripTypeScriptTypes
  );
}

/**
 * @param {string} code
 * @param {string} fileName
 */
function stripTypes(code, fileName) {
  const strip = exactStripper();
  if (strip) {
    /* Node flags the API experimental on first use; the warning is noise
       in test and dev output and says nothing about the export. */
    const emitWarning = process.emitWarning;
    process.emitWarning = /** @type {typeof process.emitWarning} */ (
      (warning, ...rest) => {
        const text = typeof warning === 'string' ? warning : warning.message;
        if (text.includes('stripTypeScriptTypes')) return;
        return emitWarning.call(process, warning, ...rest);
      }
    );
    try {
      return strip(code, { mode: 'strip' });
    } finally {
      process.emitWarning = emitWarning;
    }
  }
  return ts.transpileModule(code, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
      removeComments: false,
    },
  }).outputText;
}

/* ------------------------------------------------------------ resolve */

/**
 * @param {string} root
 * @param {string} fromFile
 * @param {string} spec
 */
function resolveImport(root, fromFile, spec) {
  let target;
  if (spec.startsWith('@/')) target = path.join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) target = path.resolve(path.dirname(fromFile), spec);
  else {
    throw new Error(
      `${path.relative(root, fromFile)} imports "${spec}": a code export may only bundle project sources, never packages`,
    );
  }
  for (const candidate of [target, `${target}.ts`, path.join(target, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`${path.relative(root, fromFile)} imports "${spec}", which does not resolve to a .ts file`);
}

/** src/labs/drone-lab/index.ts → labs_drone_lab; src/sdk/prng.ts → sdk_prng. */
function moduleVar(root, file) {
  const rel = path.relative(path.join(root, 'src'), file).replace(/\.ts$/, '');
  const parts = rel.split(path.sep);
  if (parts.length > 1 && parts[parts.length - 1] === 'index') parts.pop();
  return parts.join('_').replace(/[^A-Za-z0-9_]/g, '_');
}

/* ------------------------------------------------------------- analyze */

/**
 * @typedef {{ file: string; rel: string; name: string; js: string; deps: string[]; typeDeps: string[];
 *   edits: Array<{ start: number; end: number; text: string }>;
 *   exports: Array<{ exported: string; local: string }> }} Module
 */

/**
 * Strip one file's types, then find every import/export statement in the
 * result and plan its rewrite. Positions come from the JavaScript itself,
 * so either type stripper works.
 * @param {string} root
 * @param {string} file
 * @returns {Module}
 */
function analyze(root, file) {
  const rel = path.relative(root, file);
  const source = readFileSync(file, 'utf8');
  const js = stripTypes(source, file);
  const sf = ts.createSourceFile(file, js, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  /** @type {Module['edits']} */
  const edits = [];
  /* Offsets line up with the source only under the exact stripper. */
  const aligned = js.length === source.length;
  /** @type {Module['exports']} */
  const exports = [];
  /** @type {string[]} */
  const deps = [];
  /* Modules imported for their types only. Nothing at runtime needs them,
     but their interfaces are the contracts a reader wants next to the
     code, so they are linked too — after everything else. */
  /** @type {string[]} */
  const typeDeps = [];
  const unsupported = (/** @type {string} */ what) =>
    new Error(`${rel}: ${what} is not supported by the code export linker — use named imports/exports`);

  for (const stmt of sf.statements) {
    const start = stmt.getStart(sf);
    const end = stmt.end;
    if (ts.isImportDeclaration(stmt)) {
      const spec = /** @type {ts.StringLiteral} */ (stmt.moduleSpecifier).text;
      const clause = stmt.importClause;
      if (!clause || clause.isTypeOnly) {
        edits.push({ start, end, text: '' });
        continue;
      }
      if (clause.name) throw unsupported('a default import');
      const target = resolveImport(root, file, spec);
      const from = moduleVar(root, target);
      const bindings = clause.namedBindings;
      let text = '';
      if (bindings && ts.isNamespaceImport(bindings)) {
        text = `const ${bindings.name.text} = ${from};`;
      } else if (bindings && ts.isNamedImports(bindings)) {
        const names = bindings.elements
          .filter((el) => !el.isTypeOnly)
          .map((el) => (el.propertyName ? `${el.propertyName.text}: ${el.name.text}` : el.name.text));
        if (names.length > 0) text = `const { ${names.join(', ')} } = ${from};`;
      }
      if (text) deps.push(target);
      edits.push({ start, end, text });
      continue;
    }
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly) {
        edits.push({ start, end, text: '' });
        continue;
      }
      if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) throw unsupported('export *');
      const names = stmt.exportClause.elements
        .filter((el) => !el.isTypeOnly)
        .map((el) => ({ exported: el.name.text, local: (el.propertyName ?? el.name).text }));
      let text = '';
      if (stmt.moduleSpecifier) {
        /* Re-export: pull the names in, then hand them on. */
        const target = resolveImport(root, file, /** @type {ts.StringLiteral} */ (stmt.moduleSpecifier).text);
        deps.push(target);
        const pulled = names.map((n) => (n.exported === n.local ? n.local : `${n.local}: ${n.exported}`));
        text = `const { ${pulled.join(', ')} } = ${moduleVar(root, target)};`;
        exports.push(...names.map((n) => ({ exported: n.exported, local: n.exported })));
      } else {
        exports.push(...names);
      }
      edits.push({ start, end, text });
      continue;
    }
    if (ts.isExportAssignment(stmt)) throw unsupported('export default');
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const exportKeyword = modifiers?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exportKeyword) continue;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) throw unsupported('export default');
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) throw unsupported('an exported destructuring pattern');
        exports.push({ exported: decl.name.text, local: decl.name.text });
      }
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && stmt.name) {
      exports.push({ exported: stmt.name.text, local: stmt.name.text });
    } else {
      /* interface / type alias: already blank after stripping. */
      continue;
    }
    /* Drop the `export ` keyword, nothing else. */
    const keywordEnd = exportKeyword.end + (js[exportKeyword.end] === ' ' ? 1 : 0);
    edits.push({ start: exportKeyword.getStart(sf), end: keywordEnd, text: '' });
  }

  const tsf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  for (const stmt of tsf.statements) {
    /* `import type …` and `import { type X }` vanish in the stripped JS;
       read them from the TypeScript itself. */
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const clause = stmt.importClause;
    const bindings = clause.namedBindings;
    const typeOnly =
      clause.isTypeOnly ||
      (bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.every((el) => el.isTypeOnly));
    if (typeOnly) {
      typeDeps.push(resolveImport(root, file, /** @type {ts.StringLiteral} */ (stmt.moduleSpecifier).text));
    }
  }
  if (aligned) {
    /* Interfaces and type aliases: blanked by the stripper, restored here
       as line comments so the contract stays readable next to the code. */
    for (const stmt of tsf.statements) {
      if (!ts.isInterfaceDeclaration(stmt) && !ts.isTypeAliasDeclaration(stmt)) continue;
      const start = stmt.getStart(tsf);
      const text = source.slice(start, stmt.end);
      edits.push({ start, end: stmt.end, text: text.split('\n').map((line) => `// ${line}`).join('\n') });
    }
    /* Everything else the stripper blanked (annotations, generics, `as`,
       modifiers) leaves runs of spaces mid-line; drop them. Runs touching
       another edit are left to that edit. */
    const taken = edits.map((e) => [e.start, e.end]);
    const blanked = (/** @type {number} */ k) => js[k] === ' ' && source[k] !== ' ';
    let i = 0;
    while (i < js.length) {
      if (!blanked(i)) {
        i++;
        continue;
      }
      /* A span: blanked chars, plus the original spaces between them
         (`: number` is two blanked words around one real space). */
      let j = i;
      let lastBlank = i;
      while (j < js.length && (blanked(j) || source[j] === ' ')) {
        if (blanked(j)) lastBlank = j;
        j++;
      }
      j = lastBlank + 1;
      let start = i;
      let end = j;
      if (source[start - 1] === ' ' && /[;,)\]}\n]|$/.test(source[end] ?? '')) {
        /* `value as number;` → `value;` — eat the space before the span. */
        start -= 1;
      } else if (/[\s]/.test(source[start - 1] ?? '\n') && source[end] === ' ' && /\S/.test(source[end + 1] ?? '')) {
        /* `  readonly ctx;` → `  ctx;` — a leading modifier takes its space. */
        end += 1;
      }
      if (!taken.some(([a, b]) => start < b && end > a)) edits.push({ start, end, text: '' });
      i = j;
    }
  }

  return { file, rel, name: moduleVar(root, file), js, deps, typeDeps, edits, exports };
}

/** Apply planned edits (non-overlapping) from the end backwards. */
function rewrite(/** @type {Module} */ mod) {
  let out = mod.js;
  for (const edit of [...mod.edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out
    .replace(/^[ \t]+$/gm, '') /* lines the stripper left as pure whitespace */
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '');
}

/* ---------------------------------------------------------------- link */

/**
 * Walk the graph from the entries, dependency-first.
 * @param {string} root
 * @param {string[]} entries
 */
function collect(root, entries) {
  /** @type {Map<string, Module>} */
  const modules = new Map();
  /** @type {Module[]} */
  const ordered = [];
  /** @type {Set<string>} */
  const visiting = new Set();
  const visit = (/** @type {string} */ file, /** @type {string[]} */ chain) => {
    if (modules.has(file)) return;
    if (visiting.has(file)) {
      throw new Error(
        `import cycle: ${[...chain, file].map((f) => path.relative(root, f)).join(' → ')} — the export linker emits modules dependency-first and cannot order a cycle`,
      );
    }
    visiting.add(file);
    const mod = analyze(root, file);
    for (const dep of mod.deps) visit(dep, [...chain, file]);
    visiting.delete(file);
    modules.set(file, mod);
    ordered.push(mod);
  };
  for (const entry of entries) visit(entry, []);
  /* Type-only modules last: they may lean on anything above, nothing
     above leans on them at runtime. */
  for (let i = 0; i < ordered.length; i++) {
    for (const dep of ordered[i].typeDeps) visit(dep, []);
  }
  return ordered;
}

const RULE = '═'.repeat(72);

function banner(/** @type {string} */ id) {
  return `/*
 * Soundbook code export — lab "${id}", audio only.
 *
 * This is a readable bundle of the lab's own source modules, not a
 * minified build. Each section below is one file from the Soundbook
 * repository, types stripped, comments untouched, in dependency order:
 *
 *   src/sdk/*            the contract: seeded PRNG, events + provenance,
 *                        param schemas, the lab definition shape
 *   src/engine/*         one shared AudioContext behind a safety chain, a
 *                        beat-domain transport, the lookahead scheduler,
 *                        the mobile audio unlock
 *   src/labs/*           the lab definition (params, pure events, the
 *                        instrument, stories, docs) and shared music/DSP
 *                        helpers; a console lab embeds other labs' files
 *   src/export/runtime.ts  the player wired to index.html's transport
 *
 * Module boundaries are the only rewrite: where a file said
 * \`import { a } from '@/x'\` it now reads \`const { a } = sdk_x;\`, and
 * every section ends by returning what it exported. TypeScript types are
 * stripped; interfaces and type aliases are kept as // comments so the
 * contracts (EngineFacade, Instrument, NoteEvent, LabDefinition…) can
 * still be read where they were declared.
 *
 * What this script leaves on the page:
 *   Soundbook.lab            the lab definition — call
 *                            Soundbook.lab.events({ params, seed, range: { from, to } })
 *                            for the notes in any beat window, each with
 *                            its provenance chain (why it sounded)
 *   Soundbook.mount(root, state)  the player; index.html calls it with the
 *                            whole document: { seed, tempo, params, locked? }
 *
 * Invariants the code relies on: events are pure functions of (params,
 * seed, beat range) and chunk-independent; all randomness flows through
 * rngFor(seed, ...keys); instruments build against an EngineFacade and
 * skip notes when acquireVoice() returns null; the same seed + params +
 * tempo always yields the same event sequence.
 *
 * Generated by tools/export-bundler.mjs in the Soundbook repository.
 */`;
}

/**
 * Link a lab's definition and the export runtime into one classic script.
 * @param {string} root project root
 * @param {string} id lab id
 * @returns {Promise<{ id: string; code: string; moduleIds: string[] }>}
 */
export async function bundleLab(root, id) {
  const labFile = labModulePath(root, id);
  if (!existsSync(labFile)) throw new Error(`no lab at ${path.relative(root, labFile)}`);
  const runtimeFile = path.join(root, 'src', 'export', 'runtime.ts');
  const modules = collect(root, [labFile, runtimeFile]);
  const labVar = moduleVar(root, labFile);
  const runtimeVar = moduleVar(root, runtimeFile);

  const sections = modules.map((mod) => {
    const body = rewrite(mod);
    const returned = mod.exports.map((e) =>
      e.exported === e.local ? e.local : `${e.exported}: ${e.local}`,
    );
    return `/* ${RULE}
 * ${mod.rel}
 * ${RULE} */
const ${mod.name} = (() => {
${body}

return { ${returned.join(', ')} };
})();`;
  });

  const code = `${banner(id)}
'use strict';
var Soundbook = (function () {

${sections.join('\n\n')}

/* ${RULE}
 * entry
 * ${RULE} */
const lab = Object.values(${labVar}).find(
  (value) =>
    value && typeof value === 'object' && value.id === ${JSON.stringify(id)} && typeof value.events === 'function',
);
if (!lab) throw new Error('lab ${id} does not export its definition');
return { lab, mount: (root, state) => ${runtimeVar}.mountLab(lab, state, root) };
})();
`;
  return { id, code, moduleIds: modules.map((mod) => mod.file) };
}

/**
 * Bundle a project module as a node ESM string (the CLI loads html.ts and
 * the registry through this, since node cannot import "@/" TypeScript).
 * @param {string} root
 * @param {string} entryFile path relative to root
 */
export async function bundleForNode(root, entryFile) {
  const bundle = await rolldown({
    input: path.join(root, entryFile),
    cwd: root,
    platform: 'node',
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  try {
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}
