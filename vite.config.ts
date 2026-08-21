/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleLab, listLabIds } from './tools/export-bundler.mjs';

const root = import.meta.dirname;

/*
 * Code export bundles. `virtual:soundbook-export` exposes loadBundle(id),
 * which lazily imports `virtual:soundbook-export/<id>` — a module whose
 * default export is that lab's standalone script, built with rolldown from
 * src/labs/<id>/index.ts + src/export/runtime.ts. Built on demand in dev
 * (and invalidated when any of its sources change), emitted as one lazy
 * chunk per lab in production.
 */
function soundbookExport(): Plugin {
  const INDEX = 'virtual:soundbook-export';
  const PREFIX = `${INDEX}/`;
  return {
    name: 'soundbook-export',
    resolveId(id) {
      if (id === INDEX || id.startsWith(PREFIX)) return `\0${id}`;
      return null;
    },
    async load(id) {
      if (id === `\0${INDEX}`) {
        const loaders = listLabIds(root)
          .map((labId) => `${JSON.stringify(labId)}: () => import(${JSON.stringify(PREFIX + labId)})`)
          .join(',\n');
        return `const loaders = {\n${loaders}\n};
export function loadBundle(labId) {
  const load = loaders[labId];
  if (!load) return Promise.reject(new Error('no code export bundle for lab ' + labId));
  return load().then((m) => m.default);
}`;
      }
      if (id.startsWith(`\0${PREFIX}`)) {
        const labId = id.slice(PREFIX.length + 1);
        const bundle = await bundleLab(root, labId);
        for (const file of bundle.moduleIds) this.addWatchFile(file);
        return `export default ${JSON.stringify(bundle.code)};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), soundbookExport()],
  resolve: {
    alias: {
      '@simcity': path.resolve(root, 'vendor/sim-city-design-system'),
      '@': path.resolve(root, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
