# Conventions

## Parse Object Pages Pattern

### List Page

Example: [modules.astro](../../src/pages/modules.astro)

- Uses `ParseObjectListPage` wrapper component
- Shows `ParseObjectList` component with latest version data
- `prodReadyOnly={true}`: Filters objects where `production_status !== 'Ready'` (where the attribute exists)

### Detail Page

Example: [modules/[id].astro](../../src/pages/modules/[id].astro)

- Dynamic routes with `getStaticPaths()` calling `generateSlugBasedStaticPaths()`
- Uses `ParseObjectPage` wrapper
- Props: `{ id }` from params
- Shows object data for latest version only

## Localization System

### Server-side (build)

- Localization keys stored in JSON objects: `{ Key: string, TableNamespace: string, en: string }`
- `en` value used as default/fallback text in SSR HTML
- Game localization data exists in `WRFrontiersDB-Data/current/Localization/` directory
- Site localization data exists in `public/locales/` directory
- Site localization includes Web_UI section with meta description templates for SEO
- Meta descriptions generated server-side for each language using embedment system
- Functions like `generatePilotLocalizedMetaDescriptions()` create localized meta tags
- Templates support variable embedding: `{variable_name}` replaced with object data
- Each language gets separate `<meta name="description" lang="{lang}">` tag in HTML head

### Client-side (runtime)

- `LocalizedText` component renders elements with `data-loc-key` and `data-loc-namespace` attributes
- Language selector updates `localStorage.selectedLang` and triggers page reload
- `initializeLocalization(version)` in `public/js/localization.js` handles loading and updating text
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

- **Pages**: `src/pages/{parseObject}.astro` (list) and `src/pages/{parseObject}/[id].astro` (detail)
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
- **Test Files**: `{fileName}/{functionOrInterfaceName}.ts` in `tests/` subdirectories

## Development

- **Type Safety**: Use TypeScript interfaces for all data structures
- **IIFE Functions**: Avoid at all costs using IIFE functions

## Error Handling

When an error occurs due to a specific parse object having an undefined attribute, first check `src/types/{parseObject}.ts` file to see if it should be required.
If it should be required but was found with an undefined value, find specific parse objects that violate this and prompt the user to further research or update them.
