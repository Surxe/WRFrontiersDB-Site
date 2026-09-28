---
name: production-readiness
description: How production-ready filtering works for parse objects - a Module counts as ready only when its production_status attribute exists and equals 'Ready' (and, in lists, its name is non-empty); every other object class is always ready. Load when filtering, listing, or deciding what appears in production (e.g. anything using prodReadyOnly).
---

# Production readiness

Modules are production ready only if their `production_status` attribute exists
and is set to `'Ready'`. All other parse object classes are always production
ready.

A missing `production_status` means not ready. `prodReadyOnly` list filtering
(`prepareObjectList` in `src/utils/list.ts`) and static path generation
(`generateObjectStaticPaths` in `src/utils/parse_object.ts`) additionally drop
Modules with an empty or missing `name`. `isObjectProductionReady` checks only
`production_status`. See `docs/conventions.md` for the list-page pattern.
