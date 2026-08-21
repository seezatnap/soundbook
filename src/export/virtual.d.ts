/*
 * Build-time lab bundles, served by the `soundbookExport` Vite plugin
 * (vite.config.ts). Each lab's standalone script is bundled with rolldown
 * from src/labs/<id>/index.ts + src/export/runtime.ts and delivered as a
 * lazily imported string.
 */
declare module 'virtual:soundbook-export' {
  export function loadBundle(labId: string): Promise<string>;
}
