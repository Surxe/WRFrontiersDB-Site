# Style guide

The visual style guide for this site - palette, typography, links, buttons,
toggles, tooltips, and the rest of the shared UI vocabulary - is the **canonical
WRFrontiersDB style guide** in the design system:

**[`vendor/wrf-design/STYLE-GUIDE.md`](../vendor/wrf-design/STYLE-GUIDE.md)**

That guide is shared with WRFrontiers-Discount-Visualizer so the two sites look
identical; both consume the same WRFrontiersDB-Design submodule. Read it first for
anything about colors, fonts, or the reusable elements.

## Site-specific notes

- **Delivery.** The shared CSS is bundled: `src/components/Page.astro` does
  `import '../../vendor/wrf-design/index.css'` (tokens + fonts + elements), and
  Astro/Vite bundle and hash it. This site's own base sheet is
  `src/styles/global.css`, imported after it.
- **Where component CSS lives.** Component-specific styling stays in a scoped
  `<style>` block co-located in the `.astro` file. Do not extract scoped styles to
  an external `.css` (that makes them global). See the `styling` skill for the
  scoped-vs-`:global` rule and the token/element usage rules.
- **Tooltips.** `public/js/wrf-tooltip.js` positions `.wrf-tooltip__bubble` and is
  loaded from `Page.astro`; it is an identical mirror of the canonical source in
  `vendor/wrf-design/README.md`.
- **Domain colors** (rarity / faction / talent swatches, etc.) are intentionally
  left as raw hex - they are data, not chrome. Don't tokenize them.

## For agents

Load the **`styling`** skill before writing or editing any CSS or `<style>` block.
For how a design-system change reaches this live site, see the propagation model in
`vendor/wrf-design/README.md`.
