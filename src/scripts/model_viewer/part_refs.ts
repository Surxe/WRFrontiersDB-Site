/**
 * Client side of the builder's rich dropdown options: clones the ObjRefs that
 * ModelPartRefs.astro pre-renders and localizes.
 */

/** A lookup returning a fresh copy of a part's pre-rendered ObjRef. */
export function partRefLookup(
  palette: HTMLElement | null
): (moduleId: string) => Node | null {
  const byId = new Map<string, Element>();
  for (const node of palette?.querySelectorAll<HTMLElement>(
    '[data-module-id]'
  ) ?? []) {
    const ref = node.firstElementChild;
    if (ref && node.dataset.moduleId) byId.set(node.dataset.moduleId, ref);
  }
  return (moduleId) => byId.get(moduleId)?.cloneNode(true) ?? null;
}

declare global {
  interface Window {
    wrfModelPartsLocalized?: boolean;
  }
}

/** Resolves once ModelPartRefs.astro's localization pass has run over the
 * page (so ObjRef clones taken after it come out localized). */
export function whenLocalized(): Promise<void> {
  return new Promise((resolve) => {
    if (window.wrfModelPartsLocalized) {
      resolve();
      return;
    }
    window.addEventListener('wrf:model-parts-localized', () => resolve(), {
      once: true,
    });
  });
}
