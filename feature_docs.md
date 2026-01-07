# Feature Documentation

Documentation on various isolated development features, however small or large.

## Production Status

Objects are only displayed in the site if they have a `production_status` attribute and if its `true`

## Textures

- Texture files live at [WRFrontiersDB-Data/textures/](/WRFrontiersDB-Data/textures/)
- Path of a texture file per module is specified in e.g. [WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json](/WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json) under the e.g. `inventory_icon_path` attribute like `"WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon"`.
- The texture is then loaded from [WRFrontiersDB-Data/textures/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon.png](/WRFrontiersDB-Data/textures/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon.png)
- Some datas, such as `badge`, may store a reference to an image in addition to a hex color that should be used to color the image. For now, the images are just png's, so coloring support is not perfect. This may need to become more fleshed out in the future utilizing svg's.

## Localization

- Given a module, the localization namespace and key are in e.g. [WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json](WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json) under e.g. the `name` attribute as

```json
"name": {
    "Key": "ABL_name_ArmorShield",
    "TableNamespace": "Ability_name",
    "en": "Emergency Shield"
}
```

- The `en` value is used as the default localization value while the page lazy loads
- On changing the language selector, the localStorage is updated to include the chosen language
- The chosen language is extracted from localStorage
- Assuming Russian is chosen, [WRFrontiersDB-Data/archive/2025-03-04/Localization/ru.json](/WRFrontiersDB-Data/archive/2025-03-04/Localization/ru.json) is lazy loaded. The `TableNamespace` is used as the first-level for `ru.json`, and the `Key` is used as the second-level to access the localization.

## Parse Objects

ParseObject is the name of the class that all parsed data collections (such as Modules, Pilots, PilotClasses, etc.) from WRFrontiersDB-Data are created as before being saved to JSON.

All dirs inside of [src/pages](src/pages) represent a ParseObject (class), which inside contain a dir called `[id]`, within that a file called `[version].astro`, such as [src/pages/modules/[id]/[version].astro](src/pages/modules/[id]/[version].astro). This file creates every individual Module page, for every version. These pages always extend the `ParseObjectPage` component from [src/components/ParseObjectPage.astro](src/components/ParseObjectPage.astro)

All `.astro` pages that are directly in [src/pages](src/pages) except (currently) `index.astro` and `versions.astro` extend the component `ParseObjectListPage` from [src/components/ParseObjectListPage.astro](src/components/ParseObjectListPage.astro), such as [src/modules.astro](src/modules.astro). This file creates an aggregated view of all Modules. Most will utilize the component [src/components/ParseObjectList.astro](src/components/ParseObjectList.astro) that generates a list of each Module page with `href`s. The `ParseObjectList` component should not be confused with the `ParseObjectListPage` component.

Both the `ParseObjectPage` and `ParseObjectListPage` component extend the `Page` component from [src/components/Page.astro](src/components/Page.astro).
