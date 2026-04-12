## Summary

This pull request implements gear stat embedding functionality for module detail pages, allowing users to view detailed stat information with embedded descriptions and proper formatting. The feature includes a level switcher component and intelligent stat handling that differentiates between pilot and module scaling behavior.

## Changes Made

- **Gear stat embeds first working version**: Implemented the core functionality for displaying embedded stat information on module detail pages, including client-side JavaScript for dynamic stat rendering and updated utility functions for stat processing.

- **Level switcher component**: Created a reusable LevelSwitcher component that allows users to toggle between different stat levels (1-13) on module pages, providing an interactive way to explore stat progression.

- **Extract stat meta data and only apply unit_scaler for pilots not modules**: Refactored stat handling logic to properly extract stat metadata and ensure unit scaling is only applied to pilot stats, not module stats, improving accuracy of stat display.

- **Fix formatting and add parentheses for clarity in stat.ts**: Minor code formatting improvements and added parentheses for better operator precedence clarity in the stat scaling function.

## Testing

All tests pass (368/368), linting passes, formatting is applied, and the build completes successfully with 373 pages generated. The dev server starts without errors.
