/**
 * Share button behaviour.
 *
 * Each share button carries a `data-share-id` that points at a sibling
 * `<script type="application/json" id="share-data-{id}">` holding the
 * pre-generated share text for every supported language. On click the button
 * copies the current page URL (wrapped in <> to suppress link unfurling in
 * chat apps) followed by the shorthand text for the user's selected language.
 */

import { getCurrentLanguage } from './localization.js';

/**
 * Wire up every share button matching `selector`. Safe to call more than once;
 * each button is only bound a single time.
 * @param {string} selector - CSS selector for share buttons
 */
export function initShareButtons(selector = '.share-button') {
  document.querySelectorAll(selector).forEach((button) => {
    initShareButton(button);
  });
}

/**
 * Bind a single share button.
 * @param {HTMLElement} button
 */
function initShareButton(button) {
  if (button.dataset.shareBound === 'true') return;
  button.dataset.shareBound = 'true';

  const labelEl = button.querySelector('.share-button__label') || button;
  const defaultLabel = labelEl.textContent.trim() || 'Share';
  const copiedLabel = button.dataset.copiedLabel || 'Copied!';
  const failedLabel = button.dataset.failedLabel || 'Copy failed';

  button.addEventListener('click', async () => {
    // Read the share texts on click (not at init) so the JSON island is
    // guaranteed to be in the DOM regardless of script execution order.
    const textsByLang = readShareTexts(button);
    const lang = getCurrentLanguage();
    const shareText = textsByLang[lang] || textsByLang.en || '';
    const payload = buildSharePayload(shareText);

    const ok = await copyToClipboard(payload);
    flashLabel(labelEl, ok ? copiedLabel : failedLabel, defaultLabel);
  });
}

/**
 * Read and parse the per-language share texts associated with a button.
 * @param {HTMLElement} button
 * @returns {Record<string, string>}
 */
function readShareTexts(button) {
  const shareId = button.dataset.shareId;
  const dataEl = shareId
    ? document.getElementById(`share-data-${shareId}`)
    : null;
  if (!dataEl) return {};
  try {
    // Inside a <script> element the browser does not decode HTML entities, so
    // the JSON (HTML-escaped at build time by Astro's set:text) must be decoded
    // before parsing — otherwise &quot; etc. break JSON.parse.
    return JSON.parse(decodeHtmlEntities(dataEl.textContent || '{}'));
  } catch (error) {
    console.warn('Failed to parse share texts:', error);
    return {};
  }
}

/**
 * Decode HTML entities (e.g. &quot;, &amp;) using the browser's own parser.
 * @param {string} text
 * @returns {string}
 */
function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Build the clipboard payload: the page URL wrapped in <> then the shorthand.
 * @param {string} shorthand
 * @returns {string}
 */
export function buildSharePayload(shorthand) {
  const url = shareUrl();
  return shorthand ? `<${url}>\n${shorthand}` : `<${url}>`;
}

/**
 * The current page URL with the active `lang` query param applied and any
 * hash fragment stripped.
 * @returns {string}
 */
function shareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', getCurrentLanguage());
  url.hash = '';
  return url.toString();
}

/**
 * Copy text to the clipboard, falling back to a legacy path when the async
 * Clipboard API is unavailable (e.g. non-secure contexts).
 * @param {string} text
 * @returns {Promise<boolean>} whether the copy succeeded
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Briefly swap a label's text for feedback, then restore it.
 * @param {HTMLElement} labelEl
 * @param {string} message
 * @param {string} defaultLabel
 */
function flashLabel(labelEl, message, defaultLabel) {
  labelEl.textContent = message;
  window.setTimeout(() => {
    labelEl.textContent = defaultLabel;
  }, 1500);
}
