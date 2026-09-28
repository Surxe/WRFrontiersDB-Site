/**
 * A tiny observable build: holds the selection, keeps it resolved, and tells
 * subscribers (dropdowns, URL, 3D viewer) whenever it changes.
 */
import { resolveBuild } from './graph';
import type { CompatibilityIndex } from './compatibility';
import type {
  BuildSelection,
  BuildTables,
  ResolvedBuild,
  SlotKey,
} from './types';

export type BuildListener = (build: ResolvedBuild) => void;

export class BuildStore {
  private build: ResolvedBuild;
  private listeners = new Set<BuildListener>();

  constructor(
    private readonly tables: BuildTables,
    private readonly index: CompatibilityIndex,
    initial: BuildSelection = {}
  ) {
    this.build = resolveBuild(initial, tables, index);
  }

  get current(): ResolvedBuild {
    return this.build;
  }

  /** Put a module in a slot, or empty it with `null`. Descendant choices are
   * kept where they still fit the new part. */
  select(key: SlotKey, moduleId: string | null): void {
    const next: BuildSelection = { ...this.build.selection };
    if (moduleId) next[key] = moduleId;
    else delete next[key];
    this.replace(next);
  }

  /** Replace the whole selection. */
  replace(selection: BuildSelection): void {
    this.build = resolveBuild(selection, this.tables, this.index);
    for (const listener of this.listeners) listener(this.build);
  }

  /** Listen for changes; returns an unsubscribe function. */
  subscribe(listener: BuildListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
