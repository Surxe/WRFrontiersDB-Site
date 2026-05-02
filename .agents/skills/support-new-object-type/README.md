---
name: support-new-object-type
description: Adds support for a new object type to the WRFrontiersDB-Site
---

# Prerequisites

Before adding a new object type, ensure you have answers from the user for the following questions:

1. Should this object type have its own dedicated list and detail pages? 
   1. If no:
      1. Should it have any purpose beyond ObjRef integration?
   2. If yes:
      1. What is the name of the JSON file that contains the data for this object type? (e.g., `Module.json`)
      2. What is the name of the url it should live at? (e.g., `/modules`)
      3. What should the breadcrumb path be? (e.g., `Module Groups` -> `Modules` -> `<Module>`)

# Adding a New Object Type

1. **Study JSON structure** in `public/WRFrontiersDB-Data/current/Objects/{parseObject}.json`
2. **Create type interface** in `src/types/{parseObject}.ts` (e.g., `export interface Weapon { ... }`) with url constant for `parseObjectUrl`
3. **Add to getAllParseObjects** in `src/utils/parse_object.ts`
4. **Configure ObjRef overload** in `src/utils/obj_ref.ts`'s `getObjRefData` function
5. **Create list page**: `src/pages/{parseObject}s.astro` (properly pluralized) using `ParseObjectList`
6. **Create detail page**: `src/pages/{parseObject}s/[id].astro` with `getStaticPaths()`
7. **Call** `generateObjectListStaticPaths("{parseObject}")`
8. **Add link** to homepage ([index.astro](../../src/pages/index.astro))
9. **Configure breadcrumbs** in `src/components/Breadcrumbs.astro`'s `getBreadcrumbPath` function
10. **Rebuild slugs**: `npm run build:slugs`
