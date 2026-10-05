/**
 * Strips the game's rich-text markup from localized strings, shared by the
 * build (src/utils) and the client (localization.js).
 *
 * The game's strings use two kinds of markup:
 * - Styled spans `<Name>text</>` (colors, bold, highlights), e.g. `<Orange>Gear</>`
 * - Inline icons `<img id="Alloy"/>` and key glyphs `<key name="Spacebar"/>`, some
 *   written as an empty pair instead: `<img id="Craft"></>`
 *
 * Spans keep their text; icons and glyphs are removed with the space before
 * them. A name is a style when the language's dictionary closes it with `</>`
 * somewhere ({@link styleTagNames}); given those names, an unclosed opener of
 * a style (a translation slip, e.g. `<Italic>` with no `</>`) is removed too.
 * Any other `<...>` is left alone: it is story text, e.g. the `<LIE>`
 * interjections in a pilot bio, which are never closed.
 */

const STYLED_SPAN = /<(\w+)>([^<]*)<\/>/g;
const INLINE_ELEMENT = /[ \u00a0]?<(?:img|key)\b[^<>]*>(?:<\/>)?/g;
const STYLE_OPENER = /<(\w+)>/g;
const STRAY_CLOSER = /<\/>/g;

/**
 * Names used as styled spans anywhere in a localization dictionary.
 * @param {Record<string, Record<string, string>>} locData - Namespace -> key -> text
 * @returns {Set<string>} Style names, e.g. `Orange`, `Italic`
 */
export function styleTagNames(locData) {
  const names = new Set();
  for (const namespace of Object.values(locData)) {
    for (const text of Object.values(namespace)) {
      if (typeof text !== 'string') continue;
      for (const match of text
        .replace(INLINE_ELEMENT, '')
        .matchAll(STYLED_SPAN)) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

/**
 * @param {string} text - Localized text
 * @param {Set<string>} [styleNames] - The language's {@link styleTagNames}; without
 *   them only closed spans, icons and glyphs are stripped
 * @returns {string} The text without game markup
 */
export function stripGameMarkup(text, styleNames) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  let stripped = text.replace(INLINE_ELEMENT, '').replace(STYLED_SPAN, '$2');
  if (styleNames) {
    stripped = stripped
      .replace(STYLE_OPENER, (tag, name) => (styleNames.has(name) ? '' : tag))
      .replace(STRAY_CLOSER, '');
  }
  return stripped;
}

/**
 * Strips game markup from every string of a localization dictionary, in place.
 * @param {Record<string, Record<string, string>>} locData - Namespace -> key -> text
 * @param {Set<string>} [styleNames] - Its {@link styleTagNames}, if already known
 * @returns {Record<string, Record<string, string>>} The same dictionary
 */
export function stripGameMarkupFromLocData(
  locData,
  styleNames = styleTagNames(locData)
) {
  for (const namespace of Object.values(locData)) {
    for (const [key, text] of Object.entries(namespace)) {
      namespace[key] = stripGameMarkup(text, styleNames);
    }
  }
  return locData;
}

/**
 * Escapes text for insertion as HTML, so story text like `<LIE>` shows as
 * written instead of being parsed as an element.
 * @param {string} text - Plain text
 * @returns {string} HTML-safe text
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
