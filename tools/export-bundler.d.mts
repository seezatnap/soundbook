export interface LabBundle {
  id: string;
  /** The standalone script: a readable IIFE defining `Soundbook = { lab, mount }`. */
  code: string;
  /** Every source file that went into it, dependency-first. */
  moduleIds: string[];
}
export function listLabIds(root: string): string[];
export function labModulePath(root: string, id: string): string;
/** Links index.ts + the export runtime, types stripped, every comment kept. */
export function bundleLab(root: string, id: string): Promise<LabBundle>;
export function bundleForNode(root: string, entryFile: string): Promise<string>;
