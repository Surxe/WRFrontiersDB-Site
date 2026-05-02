---
name: support-new-object-type
description: Adds support for a new object type to the WRFrontiersDB-Site
---

## Prerequisites

Ensure you have answers from the user for the following questions:

1. What is the name of the JSON file that contains the data for this object type? (e.g., `Module.json`)
2. Should this object type have its own dedicated list and detail pages? 
   1. If no:
      1. Should it have any purpose beyond ObjRef integration?
   2. If yes:
      1. What is the name of the url it should live at? (e.g., `/modules`)
      2. What should the breadcrumb path be? (e.g., `Module Groups` -> `Modules` -> `<Module>`)
3. What should the slug derive from? (e.g., `name`.`en`)
4. What name and icon attribute should be used for this object type? If not specified, check if there is 1 name and 1 icon field. If there are more than 1 that could apply, ask the user which one to use.
5. Which object type should I use as a guide? (e.g. model it after `Pilot` object type)

## Adding a New Object Type

1. **Study JSON structure** in `public/WRFrontiersDB-Data/current/Objects/{parseObject}.json`
2. **Create type interface** in `src/types/{parseObject}.ts` (e.g., `export interface Weapon { ... }`) with url constant for `parseObjectUrl`
3. **Add to getAllParseObjects** in `src/utils/parse_object.ts`
4. **Add to slugableObjectTypes** in `src/components/obj_ref/ObjRef.astro`'s `slugableObjectTypes()` function
5. **Configure ObjRef overload** in `src/utils/obj_ref.ts`'s `getObjRefData` function
6. **Create list page**: `src/pages/{parseObject}s.astro` (properly pluralized) using `ParseObjectList`
7. **Create detail page**: `src/pages/{parseObject}s/[id].astro` with `getStaticPaths()` and include `ObjectPageScripts` component
8. **Call** `generateSlugBasedStaticPaths("{parseObject}")`
9. **Add link** to homepage ([index.astro](../../src/pages/index.astro))
10. **Configure breadcrumbs** in `src/components/Breadcrumbs.astro`'s `getBreadcrumbPath` function
11. **Configure slug generation** in `src/utils/slug_generator.ts`'s `generateSlugForObjectType` function and add to list of supported object types in `scripts/build-slugs.ts`
12. **Rebuild slugs**: `npm run build:slugs`
