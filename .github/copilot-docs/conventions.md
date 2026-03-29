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

The redirect system follows a three-step flow to ensure users always reach the correct versioned detail page.
The following example uses the Module object type:

1. `/modules` (list page)
2. `/modules/{moduleId}` (redirect page)
3. `/modules/{moduleId}/{latestVersion}` (versioned detail page)

#### Version Resolution Logic

The summary file for a given object type specifies the versions that the object was modified in, starting with the version they were added in.

If a given object was added in the first version and never modified, they will not have an entry in the summary file.

If every entry in a given summary file meets the above criteria, the entire summary file will not exist. 
For example, Module Rarity's might not have ever been changed since their initial release, meaning the entire `ModuleRarity.json` summary file will not exist.

**Redirect Scenarios**:
1. Summary file does not exist -> Use earliest version
2. Entry within summary file does not exist -> Use earliest version
3. Entry within summary file exists -> Use the latest version from the entry

**Example Flow**:
1. User clicks "Ammo Fabricator" on `/modules` page
2. Browser navigates to `/modules/DA_Module_Ability_AmmoGenerator.1`
3. `[id].astro` determines latest version is "2025-12-23" 
4. Redirects to `/modules/DA_Module_Ability_AmmoGenerator.1/2025-12-23`
5. `[id]/[version].astro` renders the full detail page


## Development
- **Type Safety**: Use TypeScript interfaces for all data structures
- **IIFE Functions**: Avoid at all costs using IIFE functions

## Error Handling

When an error occurs due to a specific parse object having an undefined attribute, first check the `src/types/{parseObject}.ts` file to see if it should be required.
If it should be required but was found with an undefined value, find specific parse objects that violate this and prompt the user to further research or update them.
