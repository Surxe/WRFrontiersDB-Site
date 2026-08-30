---
name: production-readiness
description: How production-ready filtering works for parse objects - a Module counts as ready only when its production_status attribute exists and equals 'Ready'; every other object class is always ready. Load when filtering, listing, or deciding what appears in production (e.g. anything using prodReadyOnly).
---

# Production readiness

Modules are production ready only if their `production_status` attribute exists
and is set to `'Ready'`. All other parse object classes are always production
ready.

This is what `prodReadyOnly` list pages filter on: objects where
`production_status !== 'Ready'` (and the attribute exists) are excluded. See
`docs/conventions.md` for the list-page pattern.
