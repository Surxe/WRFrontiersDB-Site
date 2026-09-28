/**
 * Filters already-rendered elements by a search query, toggling `hidden`, and
 * hides each group header whose items all miss. Knows nothing of what the
 * elements are (dropdown options, list rows, cards), so any runtime list can
 * reuse it: build it once from the elements and their text, then call
 * {@link ElementFilter.apply} on every input.
 */
import { matchesTerms, normalizeSearchText, parseQuery } from './text';

/** Anything showable/hideable; HTMLElement in the browser. */
export interface Hideable {
  hidden: boolean;
}

export interface FilterItem<E extends Hideable = HTMLElement> {
  element: E;
  /** What the query is matched against, e.g. the element's textContent. */
  text: string;
}

export interface FilterGroup<E extends Hideable = HTMLElement> {
  /** Hidden when none of `items` match; null for an ungrouped run. */
  header: E | null;
  items: readonly FilterItem<E>[];
}

export class ElementFilter<E extends Hideable = HTMLElement> {
  private readonly groups: {
    header: E | null;
    items: { element: E; text: string }[];
  }[];

  constructor(groups: readonly FilterGroup<E>[]) {
    this.groups = groups.map((group) => ({
      header: group.header,
      items: group.items.map((item) => ({
        element: item.element,
        text: normalizeSearchText(item.text),
      })),
    }));
  }

  /** Show the items matching `query` (all, when blank) and hide the rest.
   * Returns how many items are shown. */
  apply(query: string): number {
    const terms = parseQuery(query);
    let shown = 0;
    for (const group of this.groups) {
      let groupShown = 0;
      for (const item of group.items) {
        const match = matchesTerms(item.text, terms);
        item.element.hidden = !match;
        if (match) groupShown++;
      }
      if (group.header) group.header.hidden = groupShown === 0;
      shown += groupShown;
    }
    return shown;
  }
}
