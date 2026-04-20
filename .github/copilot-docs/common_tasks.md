# Common Tasks

## Adding a New Object Type

1. **Study JSON structure** in `public/WRFrontiersDB-Data/current/Objects/{parseObject}.json`
2. **Create type interface** in `src/types/{parseObject}.ts` (e.g., `export interface Weapon { ... }`) with url constant for `parseObjectUrl`
3. **Add to getAllParseObjects** in `src/utils/parse_object.ts`
4. **Configure ObjRef overload** in `src/utils/obj_ref.ts`'s `getObjRefData` function
5. **Create list page**: `src/pages/{parseObject}s.astro` (properly pluralized) using `ParseObjectList`
6. **Create detail page**: `src/pages/{parseObject}s/[id].astro` with `getStaticPaths()`
7. **Call** `generateObjectListStaticPaths("{parseObject}")`
8. **Add link** to homepage ([index.astro](../../src/pages/index.astro))
9. **Rebuild slugs**: `npm run build:slugs`

## Working with Icons/Textures

- Texture paths in objects: `"inventory_icon_path": "WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_Icon"`
- Physical files: `public/WRFrontiersDB-Data/textures/WRFrontiers/Content/.../T_Icon.png`
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

- **Latest version**: `getLatestVersion()` returns the current latest version
- **Version support**: Only latest version is supported; no version navigation or historical data
