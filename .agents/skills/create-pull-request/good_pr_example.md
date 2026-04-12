## Summary

This pull request implements level-based gear stat embedding functionality for module detail pages.

## Features

- Adds `getModuleStatValueChoices()` which:
  - Identifies primary_stat_ref and secondary_stat_ref.
  - Loops through module.module_scalars.levels.variables.
  - Maps PrimaryParameter to the primary stat's short_key.
  - Maps SecondaryParameter to the secondary stat's short_key.
  - Supports level indexing (0-12 for levels 1-13).
  - Handles cases where stats or parameters are missing gracefully.

- Created a reusable LevelSwitcher component that allows users to toggle between different stat levels (1-13) on module pages, providing an interactive way to explore stat progression. When the user changes the level, the stats are updated dynamically.

- `unit_scalar` is only applied to pilot stats and not module stats, as they are pre-cooked for module stats.
