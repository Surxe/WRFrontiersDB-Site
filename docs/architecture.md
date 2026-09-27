# Architecture

## Data Layer (WRFrontiersDB-Data/)

- **External data source**: Separate repository as subfolder containing parsed game data
- **Structure**: `current/Objects/{ParseObject}.json` and `current/Localization/{lang}.json`
- **Data is read-only**: Site consumes but never modifies WRFrontiersDB-Data files

## Static Site Generation

- **Framework**: Astro 5.x with static output (`output: 'static'`)
- **Base path**: `/` (always)
- **URL pattern**: `/{parseObject}/{id}` (e.g., `/modules/MOD_ArmorShield`)

## Build-time vs Runtime

### Build-time (Node.js)

- `src/utils/parse_object.ts`: Loads JSON from filesystem using `fs` and `path`
- `generateSlugBasedStaticPaths()`: Creates static routes
- Type definitions in `src/types/`

### Runtime (Browser)

- Client-side localization lazy-loaded on language change
- `public/js/*.js`: Plain JavaScript modules (not TypeScript)
- Fetches localization JSON from `WRFrontiersDB-Data/current/Localization/{lang}.json`

### Bundled client scripts (src/scripts)

Newer client code is TypeScript under `src/scripts/`, imported from an Astro
`<script>` tag so Vite bundles it (as opposed to the plain-JS `public/js/`
files, which are served as-is). Bundled code reaches the site's runtime
localization through `src/scripts/localization.ts`, which imports
`/js/localization.js` by URL at runtime rather than bundling it.

## Robot builds and 3D models (/models)

Two layers:

- **`src/scripts/robot/`: headless core.** No DOM or WebGL, so it runs in the
  browser, at build time (deep links on robot / preset pages) and in tests.
  - `build/`: a robot build as a slot tree resolved from a selection
    (`resolveBuild`), socket compatibility, URL params, observable stores, and
    A/B comparison.
  - `model/`: mount resolution (`placeModules`), hitbox primitives and mesh
    bounds, on three.js math classes (`Matrix4`, ...).
  - `hitbox_area/`: health pools and projected hitbox area per view
    (`measureHitboxes`, `compareHitboxes`).
  - `assembly.ts`: `assemble(modules, tables, cache)` loads the models a
    module list needs, places them and collects their hitboxes. This is the
    entry point for computing a build's numbers on any page:

    ```ts
    const tables = await loadRobotTables();
    const cache = new ModelCache(fetchModuleModel);
    const build = resolveBuild(
      selection,
      tables,
      buildCompatibilityIndex(tables)
    );
    const assembly = await assemble(toPresetModules(build), tables, cache);
    const { areas } = measureHitboxes(assembly.hitboxes);
    ```

- **`src/scripts/model_viewer/`: the /models page.** `page.ts` (the
  controller) wires the stores to `render/` (the three.js viewer, which only
  draws assemblies) and `ui/` (builder dropdowns, area panel, 2D labels).

Mount-correction constants live in `src/utils/constants.ts`; see the
`model-correction` skill and `docs/weapon_mount_findings.md`.
