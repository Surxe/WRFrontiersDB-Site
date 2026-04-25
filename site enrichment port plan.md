# Site Data Enrichment Migration Plan

The WRFrontiersDB-Parser now outputs synthetic objects (`VirtualBot.json`, `ModuleGroup.json`) and directly enriches `Module.json` and `PilotTalent.json`. This plan outlines the steps to remove the old manual enrichment utilities from the Site repository and integrate the new parsed data.

## User Review Required

- **Deletion of Utils**: We will completely delete `src/utils/robot.ts` and `src/utils/module_group_mapping.ts` as their logic is fully superseded by the Parser.
- **Pilot Enrichment**: We will remove `src/utils/pilot.ts` (or the enrichment functions within it) since `PilotTalent.json` now inherently includes the `pilots_with_this_talent` mapping.
- **Data Loaders**: We will add `VirtualBot` and `ModuleGroup` to the allowed types in `src/utils/parse_object.ts` so they can be statically routed and loaded just like other objects.

## Open Questions

- None at the moment. The mapping from the parser output to the frontend usage is straightforward.

## Proposed Changes

### Types Updates

#### [MODIFY] src/types/module.ts

Add the new parser-provided fields to the `Module` interface:

- `module_group_ref?: string`
- `virtual_bot_ref?: string`
- `shoulder_side?: 'L' | 'R'`

#### [MODIFY] src/types/pilot.ts

Update `PilotTalent` to include the parser's enriched fields:

- `talent_type_ref?: string`
- `level?: number`
- `pilots_with_this_talent?: Array<{ pilot_ref: string; talentIndex: number }>`

#### [NEW] src/types/virtual_bot.ts

Create the `VirtualBot` interface matching the JSON structure:

- `id`, `name`, `character_type`, `has_distinct_shoulders`, `core_module_refs`, `factory_preset_refs`, `icon_path`.

#### [NEW] src/types/module_group.ts

Create the `ModuleGroup` interface matching the JSON structure:

- `id`, `name`, `description`, `sort_order`, `titan`.

---

### Utility Removals and Refactors

#### [DELETE] src/utils/robot.ts

Remove entirely. The `getVirtualBots` and `enrichModulesWithBotIds` functions are obsolete.

#### [DELETE] src/utils/module_group_mapping.ts

Remove entirely. `MODULE_GROUPS` and `getModuleGroupId` are replaced by `getParseObjects('Objects/ModuleGroup.json')`.

#### [MODIFY] src/utils/parse_object.ts

- Add `'VirtualBot'` and `'ModuleGroup'` to the allowed `objectType` lists in `generateObjectListStaticPaths` and `generateSlugBasedStaticPaths`.

#### [MODIFY] src/utils/slug_generator.ts

- Remove `getShoulderSideFromPreset` and references to `enrichModulesWithBotIds`.
- Update `generateModuleSlug` to use `module.shoulder_side`, `module.virtual_bot_ref`, and `module.module_group_ref`.
- Update `SlugContext` to include `allModuleGroups` instead of presets/enriched modules.

#### [MODIFY] src/utils/obj_ref.ts

- Refactor `getObjRefData` to support `OBJID_ModuleGroup` and `OBJID_VirtualBot` by querying `getParseObject`.
- For `OBJID_Module`, replace the dynamic shoulder side calculation with a simple check on `module.shoulder_side`.

#### [MODIFY] src/utils/bot_modules.ts

- Replace imports from `robot.ts` with direct calls to `getParseObjects('Objects/VirtualBot.json')`.

#### [MODIFY] src/utils/breadcrumb.ts

- Refactor to load `ModuleGroup` via `getParseObject` instead of the hardcoded `MODULE_GROUPS` map.

#### [MODIFY] src/utils/pilot.ts

- Remove `enrichPilotTalentsWithPilots`. Refactor any remaining functions to use the native `pilots_with_this_talent` field.

---

### Pages and Components

#### [MODIFY] src/pages/module_groups.astro & src/pages/module_groups/[slug].astro

- Switch data source from `MODULE_GROUPS` to `getParseObjects('Objects/ModuleGroup.json')`.

#### [MODIFY] src/components/nav/ModuleGroupsNavBox.astro & ModulesNavBox.astro & AllModulesNavBoxes.astro

- Switch data source from `MODULE_GROUPS` to `getParseObjects('Objects/ModuleGroup.json')`.

#### [MODIFY] src/components/bot/BotItem.astro

- Update to fetch the `ModuleGroup` name via `getParseObject` for grouping/rendering.

#### [MODIFY] src/utils/build_localization.ts

- Update references to pilot talent enrichment to use the new `pilot_ref` format instead of the old nested `pilot` object if applicable.

## Verification Plan

### Automated Tests

- Run `npm run test` (via the `non-playwright-test-suite` skill) to ensure no type errors or broken utility tests.
- Run `npm run playwright` (via the `playwright-test-site` skill) to ensure pages render correctly without throwing 500 errors.

### Manual Verification

- Start the dev server and manually navigate to `/module_groups`, `/modules`, `/robots`, and `/pilots` to verify UI integrity.
