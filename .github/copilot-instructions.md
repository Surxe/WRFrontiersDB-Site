# WRFrontiersDB-Site Copilot Instructions

## Project Overview
Static Astro site displaying War Robots Frontiers game data from versioned JSON archives. The site builds static pages for game objects such as (modules, pilots, talents) across multiple game versions with client-side localization.

## Architecture

### Data Layer (WRFrontiersDB-Data/)
- **External data source**: Separate repository as subfolder containing parsed game data
- **Structure**: `archive/{version}/Objects/{ParseObject}.json` and `archive/{version}/Localization/{lang}.json`
- **versions.json**: Master version registry with metadata (title, date, manifest_id, patch_notes_url, is_season_release)
- **Data is read-only**: Site consumes but never modifies WRFrontiersDB-Data files

### Static Site Generation
- **Framework**: Astro 5.x with static output (`output: 'static'`)
- **Base path**: `/WRFrontiersDB-Site/` for GitHub Pages deployment at `https://Surxe.github.io/WRFrontiersDB-Site/`
- **Always use full base path** in all internal links, asset references, and fetch URLs
- **URL pattern**: `/{parseObject}/{id}/{version}` (e.g., `/modules/MOD_ArmorShield/2025-12-09`)

### Build-time vs Runtime
**Build-time (Node.js)**:
- `src/utils/parse_object.ts`: Loads JSON from filesystem using `fs` and `path`
- `generateObjectStaticPaths()`: Creates all static routes during build
- Type definitions in `src/types/`

**Runtime (Browser)**:
- Client-side localization lazy-loaded on language change
- `public/js/*.js`: Plain JavaScript modules (not TypeScript)
- Fetches localization JSON from `/WRFrontiersDB-Site/WRFrontiersDB-Data/archive/{version}/Localization/{lang}.json`

## Key Conventions
### Parse Object Pages Pattern
See more in [docs.md](docs.md)'s "Parse Objects" section.
**List Page** (e.g., [modules.astro](src/pages/modules.astro)):
- Uses `ParseObjectListPage` wrapper component
- Shows `ParseObjectList` component with latest version data
- `prodReadyOnly={true}`: Filters objects where `production_status !== 'Ready'`

**Detail Page** (e.g., [modules/[id]/[version].astro](src/pages/modules/[id]/[version].astro)):
- Dynamic routes with `getStaticPaths()` calling `generateObjectStaticPaths()`
- Uses `ParseObjectPage` wrapper
- Props: `{ id, version }` from params, `{ objectVersions }` from props
- Shows object data, version info, and `VersionList` component for navigating versions

### Localization System
See more in [docs.md](docs.md)'s "Localization" section.
**Server-side (build)**:
- Localization keys stored in JSON objects: `{ Key: string, TableNamespace: string, en: string }`
- `en` value used as default/fallback text in SSR HTML

**Client-side (runtime)**:
- `LocalizedText` component renders elements with `data-loc-key` and `data-loc-namespace` attributes
- Language selector updates `localStorage.selectedLang` and triggers page reload
- `initializeLocalization(version)` in `public/js/localization.js` handles loading and updating text
- Uses two-level lookup: `locData[namespace][key]`

### File Organization
- **Pages**: `src/pages/{parseObject}.astro` (list) and `src/pages/{parseObject}/[id]/[version].astro` (detail)
- **Components**: Reusable UI in `src/components/`
- **Utils**: Build-time helpers in `src/utils/` (TypeScript, Node.js APIs)
- **Public JS**: Client-side scripts in `public/js/` (plain JavaScript, browser APIs)
- **Types**: TypeScript interfaces in `src/types/` (e.g., `Module`, `LocalizationKey`)

## Common Tasks

### Adding a New Object Type
1. Study JSON structure in `WRFrontiersDB-Data/archive/{version}/Objects/{parseObject}.json`
1. Create type interface in `src/types/{parseObject}.ts` (e.g., `export interface Weapon { ... }`)
2. Create list page: `src/pages/{parseObject}s.astro` (properly pluralized) using `ParseObjectList`
3. Create detail page: `src/pages/{parseObject}s/[id]/[version].astro` with `getStaticPaths()`
4. Call `generateObjectStaticPaths("Objects/{parseObject}.json", true)`
5. Add link to homepage ([index.astro](src/pages/index.astro))

### Working with Icons/Textures
See more in [docs.md](docs.md)'s "Textures" section.
- Texture paths in objects: `"inventory_icon_path": "WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_Icon"`
- Physical files: `WRFrontiersDB-Data/textures/WRFrontiers/Content/.../T_Icon.png`
- Use `Icon` component with `iconPath` prop (no `.png` extension)

### Client-side Object Data
Page-specific scripts access object data via:
```javascript
const el = document.getElementById("object-data");
const objectData = JSON.parse(el.textContent);
```
Injected by `ObjectPageScripts` component using `<script type="application/json">`

## Development Commands
- `npm run dev`: Dev server at `localhost:4321` (must use full base paths for links to work)
- `npm run build`: Static build to `./dist/`
- `npm run preview`: Preview built site locally

## Important Notes
- **All links/fetches must include `/WRFrontiersDB-Site/` prefix** - this is non-negotiable for GitHub Pages
- **Production status filter**: Only objects with `production_status === 'Ready'` appear in production lists
- **Version ordering**: `versions.json` is ordered newest-first; `Object.keys(versions)[0]` is latest
- **No TypeScript in public/js**: Client-side scripts are plain JavaScript with JSDoc for types
- **Localization is version-specific**: Each game version has its own localization files
