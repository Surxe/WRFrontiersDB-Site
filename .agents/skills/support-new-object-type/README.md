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