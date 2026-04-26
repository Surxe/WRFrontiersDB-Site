## Summary

Localize module group labels (Shoulder/Torso) using proper localization keys

## Changes Made

- Updated BotItem.astro to use LocalizedText component for module category names
- Changed module mapping from ModuleGroup to ModuleCategory for proper localization
- Moved module category logic into getProcessedData() function for efficiency
- Updated tests to match new implementation

## Technical Details

- Module category labels (Shoulder/Torso) now use HNG_Shoulder and HNG_Torso localization keys
- LocalizedText component handles client-side localization with proper data attributes
- Build-time optimization: category names calculated once during data processing

## Verification

- All tests pass (370/370)
- Build completes successfully (590 pages)
- No linting errors
- Code properly formatted
