# Conventions

## Parse Object Pages Pattern

### List Page

Example: [modules.astro](../src/pages/modules.astro)

- Uses `ParseObjectListPage` wrapper component
- Shows `ParseObjectList` component with latest version data
- `prodReadyOnly={true}`: Keeps only objects whose `production_status` is `'Ready'` and whose `name` is non-empty; a missing `production_status` counts as not ready (see `prepareObjectList` in `src/utils/list.ts` and the `production-readiness` skill). Only Module lists use it, since only Modules carry `production_status`

### Detail Page

Example: [modules/[slug].astro](../src/pages/modules/[slug].astro)

- Dynamic routes with `getStaticPaths()` calling `generateSlugBasedStaticPaths()`
- Uses `ParseObjectPage` wrapper
- Includes `ObjectPageScripts` (browser data + localization init). Its optional `jsFileName` is loaded as `/js/{jsFileName}` with no build-time check, so it must name an existing file in `public/js/` (e.g. `module_page.js`)
- Params: `{ slug }`; props: `{ id }` (the object id the slug maps to)
- Shows object data for latest version only

## Localization System

### Server-side (build)

- Localization keys stored in JSON objects: `{ Key: string, TableNamespace: string, en: string }`
- `en` value used as default/fallback text in SSR HTML
- Game localization data exists in `WRFrontiersDB-Data/current/Localization/` directory
- Site localization data exists in `public/locales/` directory
- Meta descriptions live in `src/utils/meta_description.ts`. Each object type has a body builder (`pilotMetaBody`, `pilotTalentMetaBody`, `moduleMetaBody`, or `templateMetaBody` for Web_UI templates) that returns the body for one language
- `precomputeMetaBodies(buildBody)` runs a builder for every language (empty bodies fall back to English); the `generate*LocalizedMetaDescriptions()` wrappers do this per type
- Stat-bearing text goes through `statEmbeddedText()`: localized per language, stats embedded at level 1, markup stripped
- Templates support variable embedding: `{variable_name}` replaced with object data
- Each language gets separate `<meta name="description" lang="{lang}">` tag in HTML head; the unlabelled description and og/twitter tags (what link embeds read) carry the English body

### Client-side (runtime)

- `LocalizedText` component renders elements with `data-loc-key` and `data-loc-namespace` attributes
- The language lives in the `?lang=` URL query param: `getCurrentLanguage()` reads it (default `en`), and the language selector calls `setCurrentLanguage()`, which navigates to the same URL with `lang` updated
- An inline script in `Page.astro` redirects to `?lang=en` when the param is missing or invalid, and internal links are rewritten to carry `lang`
- `localStorage` holds only the number separator preference (`number_formatting.js`), not the language
- `initializeLocalization(version)` in `public/js/localization.js` handles loading and updating text. The `version` argument is currently ignored: it always loads `current`
- Uses two-level lookup: `locData[namespace][key]`

### Runtime-built UI (bundled scripts)

Text a client script builds (dropdowns, result tables) is localized too:

- Declare every string in one catalog of `{ Key, TableNamespace }` refs
  (e.g. `src/scripts/model_viewer/strings.ts`), preferring the game's own
  localization keys and adding `Web_UI` keys to `public/locales/en.json`
  otherwise.
- The page resolves the catalog at build time (`resolveLocalizationKeys`),
  renders its static text with `LocalizedText`, and passes the resolved
  catalog to the script. The script localizes the page (`localizePage`) and
  builds its own text in the reader's language, falling back to English.
- Pass JSON to a script through a `data-*` attribute, not
  `<script type="application/json" set:text=...>`: `set:text` HTML-escapes the
  quotes and the browser does not decode entities inside `<script>`.

## File Organization

- **Pages**: `src/pages/{parseObject}.astro` (list) and `src/pages/{parseObject}/[slug].astro` (detail)
- **Components**: Reusable UI in `src/components/`
- **Utils**: Build-time helpers in `src/utils/` (TypeScript, Node.js APIs)
- **Public JS**: Client-side scripts in `public/js/` (plain JavaScript, browser APIs)
- **Bundled scripts**: Client TypeScript in `src/scripts/` imported from Astro `<script>` tags (see Architecture)
- **Types**: TypeScript interfaces in `src/types/` (e.g., `Module`, `LocalizationKey`)
- **Tests**: Test files in `tests/` directory, organized by type (e.g., `tests/ts_utils/`, `tests/components/`)

## Naming Conventions

- **Parse Object Types**: Singular (e.g., `Module`, `Pilot`)
- **Page URLs**: Properly pluralized (e.g., `/modules`, `/pilots`, `/pilot_personalities`)
- **File Names**: Snake case for multi-word pages (e.g., `pilot_personalities.astro`)
- **Component Names**: PascalCase (e.g., `ParseObjectList.astro`)
- **Test Files**: under `tests/`, mirroring the source tree. `src/utils` tests are split per function (`tests/ts_utils/{fileName}/{functionName}.ts`); components get one file each (`tests/components/Icon.ts`); `src/scripts` tests are one file per source module (`tests/robot/build/params.ts`). Either `.ts` or `.test.ts` works (Vitest runs every `tests/**/*.ts`); `*.heavy.ts` runs only under `npm run vitest:heavy`. See the `add-test` skill

## Development

- **Type Safety**: Use TypeScript interfaces for all data structures
- **IIFE Functions**: Avoid at all costs using IIFE functions. Inline `<script define:vars>` blocks need none: Astro already wraps them in one

## Error Handling

When an error occurs due to a specific parse object having an undefined attribute, first check `src/types/{parseObject}.ts` file to see if it should be required.
If it should be required but was found with an undefined value, find specific parse objects that violate this and prompt the user to further research or update them.
