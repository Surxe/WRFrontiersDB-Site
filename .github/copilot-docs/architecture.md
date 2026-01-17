# Architecture

## Data Layer (WRFrontiersDB-Data/)

- **External data source**: Separate repository as subfolder containing parsed game data
- **Structure**: `archive/{version}/Objects/{ParseObject}.json` and `archive/{version}/Localization/{lang}.json`
- **versions.json**: Master version registry with metadata (title, date, manifest_id, patch_notes_url, is_season_release)
- **Data is read-only**: Site consumes but never modifies WRFrontiersDB-Data files

## Static Site Generation

- **Framework**: Astro 5.x with static output (`output: 'static'`)
- **Base path**: `/` (always)
- **URL pattern**: `/{parseObject}/{id}/{version}` (e.g., `/modules/MOD_ArmorShield/2025-12-09`)

## Build-time vs Runtime

### Build-time (Node.js)

- `src/utils/parse_object.ts`: Loads JSON from filesystem using `fs` and `path`
- `generateObjectStaticPaths()`: Creates all static routes during build
- Type definitions in `src/types/`

### Runtime (Browser)

- Client-side localization lazy-loaded on language change
- `public/js/*.js`: Plain JavaScript modules (not TypeScript)
- Fetches localization JSON from `${window.__ASTRO_BASE_PATH__}public/WRFrontiersDB-Data/archive/{version}/Localization/{lang}.json`
