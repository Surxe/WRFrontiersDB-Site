# Conventions

## Parse Object Pages Pattern

### List Page

Example: [modules.astro](../../src/pages/modules.astro)

- Uses `ParseObjectListPage` wrapper component
- Shows `ParseObjectList` component with latest version data
- `prodReadyOnly={true}`: Filters objects where `production_status !== 'Ready'` (where the attribute exists)

### Detail Page

Example: [modules/[id]/[version].astro](../../src/pages/modules/[id]/[version].astro)

- Dynamic routes with `getStaticPaths()` calling `generateObjectStaticPaths()`
- Uses `ParseObjectPage` wrapper
- Props: `{ id, version }` from params, `{ objectVersions }` from props
- Shows object data, version info, and `VersionList` component for navigating versions

## Localization System

### Server-side (build)

- Localization keys stored in JSON objects: `{ Key: string, TableNamespace: string, en: string }`
- `en` value used as default/fallback text in SSR HTML

### Client-side (runtime)

- `LocalizedText` component renders elements with `data-loc-key` and `data-loc-namespace` attributes
- Language selector updates `localStorage.selectedLang` and triggers page reload
- `initializeLocalization(version)` in `public/js/localization.js` handles loading and updating text
- Uses two-level lookup: `locData[namespace][key]`

## File Organization

- **Pages**: `src/pages/{parseObject}.astro` (list) and `src/pages/{parseObject}/[id]/[version].astro` (detail)
- **Components**: Reusable UI in `src/components/`
- **Utils**: Build-time helpers in `src/utils/` (TypeScript, Node.js APIs)
- **Public JS**: Client-side scripts in `public/js/` (plain JavaScript, browser APIs)
- **Types**: TypeScript interfaces in `src/types/` (e.g., `Module`, `LocalizationKey`)
- **Tests**: Test files in `tests/` directory, organized by type (e.g., `tests/ts_utils/`, `tests/components/`)

## Naming Conventions

- **Parse Object Types**: Singular (e.g., `Module`, `Pilot`)
- **Page URLs**: Properly pluralized (e.g., `/modules`, `/pilots`, `/pilot_personalities`)
- **File Names**: Snake case for multi-word pages (e.g., `pilot_personalities.astro`)
- **Component Names**: PascalCase (e.g., `ParseObjectList.astro`)
- **Test Files**: `{fileName}/{functionOrInterfaceName}.ts` in `tests/` subdirectories

### Detail Page Redirect Logic

When summary files are missing or incomplete, the system falls back to the earliest game version available:

1. **Fallback Version Selection**: Uses `getEarliestVersion()` from `summary.ts` to get the first version in chronological order (e.g., "2025-03-04" Launch version)

2. **Static Path Generation**: The `generateObjectStaticPaths()` function in `parse_object.ts` handles both cases:
   - **With summary file**: Processes objects from summary file using their full version history
   - **Without summary file**: Processes all objects from the earliest version data file, ensuring all objects have accessible detail pages

3. **Implementation Details**:
   - **Summary file check**: `fs.existsSync(summaryPath)` determines if summary exists
   - **Fallback processing**: When summary doesn't exist, reads from earliest version data file
   - **Path generation**: Creates static paths for all valid objects regardless of summary completeness
   - **Error handling**: Proper logging for debugging missing data files

This ensures that:
- Objects with complete summary data get proper version-specific detail pages
- Objects without summary data still get functional detail pages using the earliest available version
- No 404 errors occur due to missing static paths

**Example**: Pilot personalities without complete summary files redirect to "Launch (2025-03-04)" version, the earliest game version available.

- **Type Safety**: Use TypeScript interfaces for all data structures
- **IIFE Functions**: Avoid at all costs using IIFE functions

# Error Handling

When an error occurs due to a specific parse object having an undefined attribute, first check the `src/types/{parseObject}.ts` file to see if it should be required.
If it should be required but was found with an undefined value, find specific parse objects that violate this and prompt the user to further research or update them.
