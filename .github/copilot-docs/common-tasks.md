# Common Tasks

## Adding a New Object Type

1. **Study JSON structure** in `WRFrontiersDB-Data/archive/{version}/Objects/{parseObject}.json`
2. **Create type interface** in `src/types/{parseObject}.ts` (e.g., `export interface Weapon { ... }`) with the url constant for `parseObjectUrl`
3. **Configure PageRef overload** in `src/utils/page_ref.ts`'s `getPageRefData` function
4. **Create list page**: `src/pages/{parseObject}s.astro` (properly pluralized) using `ParseObjectList`
5. **Create detail page**: `src/pages/{parseObject}s/[id]/[version].astro` with `getStaticPaths()`
6. **Call** `generateObjectStaticPaths("Objects/{parseObject}.json", true)`
7. **Add link** to homepage ([index.astro](../../src/pages/index.astro))

## Working with Icons/Textures

- Texture paths in objects: `"inventory_icon_path": "WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_Icon"`
- Physical files: `WRFrontiersDB-Data/textures/WRFrontiers/Content/.../T_Icon.png`
- Use `Icon` component with `iconPath` prop (no `.png` extension)

## Client-side Object Data

Page-specific scripts access object data via:

```javascript
const el = document.getElementById('object-data');
const objectData = JSON.parse(el.textContent);
```

Injected by `ObjectPageScripts` component using `<script type="application/json">`

## Adding New Components

1. **Create component** in `src/components/` with `.astro` extension
2. **Import and use** in pages or other components
3. **Pass props** using TypeScript interfaces for type safety
4. **Use slots** for flexible content injection when appropriate

## Working with Versions

- **Latest version**: `Object.keys(versions)[0]` (versions are ordered newest-first)
- **Version metadata**: Use `getVersionsData(version)` to get `versionInfo`
- **Version navigation**: Use `VersionList` component for version switcher UI
