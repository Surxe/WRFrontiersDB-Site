# Feature Documentation
Documentation on various isolated development features, however small or large.

## Production Status
Objects are only displayed in the site if they have a `production_status` attribute and if its `true`

## Textures
* Texture files live at [WRFrontiersDB-Data/textures/](/WRFrontiersDB-Data/textures/)
* Path of a texture file per module is specified in e.g. [WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json](/WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json) under the e.g. `inventory_icon_path` attribute like `"WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon"`. 
* The texture is then loaded from [WRFrontiersDB-Data/textures/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon.png](/WRFrontiersDB-Data/textures/WRFrontiers/Content/Sparrow/UI/Textures/Abilities/T_AddShieldIcon.png)


## Localization
* Given a module, the localization namespace and key are in e.g. [WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json](WRFrontiersDB-Data/archive/2025-03-04/Objects/Module.json) under e.g. the `name` attribute as 
```json
"name": {
    "Key": "ABL_name_ArmorShield",
    "TableNamespace": "Ability_name",
    "en": "Emergency Shield"
}
```
* The `en` value is used as the default localization value while the page lazy loads
* On changing the language selector, the localStorage is updated to include the chosen language
* The chosen language is extracted from localStorage
* Assuming Russian is chosen, [WRFrontiersDB-Data/archive/2025-03-04/Localization/ru.json](/WRFrontiersDB-Data/archive/2025-03-04/Localization/ru.json) is lazy loaded. The `TableNamespace` is used as the first-level for `ru.json`, and the `Key` is used as the second-level to access the localization.