/**
 * Rich part names for runtime-built UI: clones of the ObjRefs (icon +
 * localized name) that ModelPartRefs.astro pre-renders, so dropdowns and
 * labels show parts exactly as the rest of the site does.
 */
import { queryAll } from './dom';

export class PartRefs {
  private readonly byId = new Map<string, Element>();

  /** Index the palette's `[data-module-id]` entries (none when absent). */
  constructor(palette: HTMLElement | null) {
    if (!palette) return;
    for (const entry of queryAll(palette, '[data-module-id]', HTMLElement)) {
      const ref = entry.firstElementChild;
      const moduleId = entry.dataset.moduleId;
      if (ref && moduleId) this.byId.set(moduleId, ref);
    }
  }

  /** A fresh copy of a part's ObjRef, or null when it has none (unnamed
   * modules). Clone after the page is localized to get localized names. */
  clone(moduleId: string): Node | null {
    return this.byId.get(moduleId)?.cloneNode(true) ?? null;
  }
}
