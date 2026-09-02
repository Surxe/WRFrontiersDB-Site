---
name: styling
description: Load before writing or editing ANY CSS or Astro `<style>` block in this repo. Shared visual language (colors, fonts, links, buttons, toggles, tooltips) comes from the WRFrontiersDB-Design submodule - use its `--wrf-*` tokens and `.wrf-*` element classes, never raw chrome hex. Covers scoped-vs-global styles and where to change shared vs local styling.
---

# Styling

This site's visual language - palette, typography, and the reusable UI elements
(links, buttons, toggles, tooltips, form controls, focus, scrollbars, selection)
- is owned by the **WRFrontiersDB-Design** submodule, checked out at
`vendor/wrf-design/` and imported by `src/components/Page.astro`
(`import '../../vendor/wrf-design/index.css'`). WRFrontiers-Discount-Visualizer
consumes the same submodule, so the two sites stay visually identical.

**Canonical reference:** `vendor/wrf-design/STYLE-GUIDE.md` (palette, elements,
do/don't) and `vendor/wrf-design/README.md` (consuming, the local dev loop, and
how a change propagates to the live sites). This skill is the site-specific
how-to; the style guide is the source of truth.

## Rules

1. **Use tokens, never raw chrome hex.** Every chrome color, font, radius, and
   transition resolves through a `var(--wrf-*)` token. Do not write `#2a2a2a`,
   `#4fc3f7`, `#444`, etc. in component CSS - use `var(--wrf-surface)`,
   `var(--wrf-accent)`, `var(--wrf-border)`, and so on. See the token list in
   `design-tokens.css` / the style guide.
2. **Reuse the shared element classes.** Add `.wrf-btn` (`--primary` /
   `--secondary`), `.wrf-toggle` / `.wrf-toggle__btn`, `.wrf-tooltip` rather than
   restyling bare elements. Links (`a`), form controls, focus rings, scrollbars,
   and selection are styled globally by `elements.css` - don't re-declare them.
3. **Domain colors stay raw, on purpose.** Meaningful data-driven colors -
   rarity / faction / talent swatches and similar - are NOT chrome and are
   intentionally left as raw hex. Don't tokenize them.
4. **Change shared looks in the submodule, not here.** If an element's canonical
   look needs to change, edit `vendor/wrf-design/` (see the dev loop below), not
   a per-component override. Local component CSS is for this site's own layout.

## Scoped vs. global styles (Astro)

- **Default to a scoped `<style>` block** co-located in the `.astro` component.
  Astro scopes it (adds a `data-astro-cid-*` attribute), which is already the
  modular state - do NOT extract scoped styles to an external `.css` just to
  "modularize"; that would make them global and break scoping.
- **Use `:global(...)` only for DOM built in JavaScript** (via `innerHTML` /
  `document.createElement`), which the scoping attribute never reaches. Keep
  `:global` blocks next to the script that generates the markup.
- An `@import` inside a scoped `<style>` IS scoped per-component by Astro, so a
  shared partial (e.g. a tooltip stylesheet) imported into two components is
  scoped separately in each.

## Tooltips

Use `.wrf-tooltip` / `.wrf-tooltip__icon` / `.wrf-tooltip__bubble` (see the style
guide). The bubble is `position: fixed` and placed by `public/js/wrf-tooltip.js`,
loaded from `Page.astro`. That script is an **identical mirror** of the canonical
source in `vendor/wrf-design/README.md` (this repo hosts the JS because the design
repo is CSS-only); WRFrontiers-Discount-Visualizer keeps its own identical copy.
Keep all three in sync. Any page using `.wrf-tooltip` must load the script.

## Local dev loop for shared styling

To change a shared token/element and see it live here without any CI or submodule
bump: branch inside the submodule (`cd vendor/wrf-design && git switch -c ...`),
edit the CSS, and run this site's dev server (the `run-dev-server` skill) - it
HMRs the change because the CSS is a relative import in the Vite graph. Full loop,
the independent-checkouts gotcha, and the 3-step propagation-to-live model are in
`vendor/wrf-design/README.md`.

## Related

- `core-components` - reuse `ObjRef`, `Page`, nav, etc.; those components already
  carry the shared styling, so prefer them over hand-rolled markup.
