/**
 * Plain-text matching shared by the site's runtime search boxes (dropdowns,
 * lists): case-, accent- and spacing-insensitive, and every query word must
 * appear somewhere in the text, in any order ("heavy rail" finds "Railgun
 * (Heavy)"). DOM-free, so it runs in tests too.
 */

/** Lower-cased, accents stripped, whitespace collapsed. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The query's normalized words; none for a blank query. */
export function parseQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Whether normalized `text` contains every term (a blank query matches all). */
export function matchesTerms(text: string, terms: readonly string[]): boolean {
  return terms.every((term) => text.includes(term));
}
