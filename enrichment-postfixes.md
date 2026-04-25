# Enrichment Postfixes

## Module Groups Sort Order Fix

**Issue**: Module groups with `sort_order: 0` were appearing at the end of lists instead of the beginning.

**Cause**: Used logical OR operator (`||`) which treats `0` as falsy, causing fallback to `999`.

**Fix**: Replaced `||` with nullish coalescing operator (`??`) in:

- `src/pages/module_groups.astro`
- `src/components/nav/ModuleGroupsNavBox.astro`

**Result**: Module groups now correctly sort by sort_order, with Titan Torso (0) appearing first.

## Apostrophe Handling in Slug Generation

**Issue**: Apostrophes in names were being replaced with hyphens (e.g., "trickster's-triumph" → "trickster-s-triumph").

**Cause**: `toSlug` function used `/[^a-z0-9]+/g` which treats apostrophes as special characters.

**Fix**: Modified `src/utils/slug_base.ts` to remove apostrophes before other character replacement:

- Added `.replace(/'/g, '')` before the general character replacement
- Regenerated slug map with `npm run build:slugs`

**Result**: DA_Talent_Ult_Duncan.0 now generates "tricksters-triumph" instead of "trickster-s-triumph".

## Left/Right Localization for Titan Shoulder Modules

**Issue**: "Left" and "Right" text for titan shoulder modules was hardcoded in English instead of using localization keys.

**Cause**: `obj_ref.ts` used hardcoded strings `{ en: 'Left Shoulder' }` and `{ en: 'Right Shoulder' }`.

**Fix**:

- Added missing `Socket_Left` and `Socket_Right` keys to Spanish locale (es.json)
- Updated `src/utils/obj_ref.ts` to use proper LocalizationKey objects with `Key`, `TableNamespace`, and `en` fallback
- Changed from hardcoded strings to `{ Key: 'Socket_Left', TableNamespace: 'Web_UI', en: 'Left' }` and `{ Key: 'Socket_Right', TableNamespace: 'Web_UI', en: 'Right' }`

**Result**: Titan shoulder modules now properly localized:

- English: "Alpha Left", "Alpha Right"
- Spanish: "Alpha Izquierdo", "Alpha Derecho"
- All other languages will use English fallback until localization keys are added.
