# Architecture

## Data Layer (WRFrontiersDB-Data/)

- **External data source**: Separate repository as subfolder containing parsed game data
- **Structure**: `current/Objects/{ParseObject}.json` and `current/Localization/{lang}.json`
- **versions.json**: Master version registry with metadata (title, date, manifest_id, patch_notes_url, is_season_release)
- **Data is read-only**: Site consumes but never modifies WRFrontiersDB-Data files

## Static Site Generation

- **Framework**: Astro 5.x with static output (`output: 'static'`)
- **Base path**: `/` (always)
- **URL pattern**: `/{parseObject}/{id}` (e.g., `/modules/MOD_ArmorShield`)
- **Version support**: Only latest version is supported; historical versions have been removed

## Build-time vs Runtime

### Build-time (Node.js)

- `src/utils/parse_object.ts`: Loads JSON from filesystem using `fs` and `path`
- `generateObjectListStaticPaths()`: Creates static routes for latest version only
- Type definitions in `src/types/`

### Runtime (Browser)

- Client-side localization lazy-loaded on language change
- `public/js/*.js`: Plain JavaScript modules (not TypeScript)
- Fetches localization JSON from `WRFrontiersDB-Data/current/Localization/{lang}.json`
