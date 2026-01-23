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

# Code Practices

- **Type Safety**: Use TypeScript interfaces for all data structures
- **IIFE Functions**: Avoid at all costs using IIFE functions