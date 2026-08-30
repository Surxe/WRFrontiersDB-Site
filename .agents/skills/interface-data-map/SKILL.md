---
name: interface-data-map
description: Maps each src/types TypeScript interface to its backing WRFrontiersDB-Data Objects JSON file. Load when you need to find which data file backs an interface (or vice versa), e.g. before validating, reviewing, or extending an interface.
---

# Interface to Data File Mapping

Each interface in `src/types/` is backed by a data file of the same name in
`WRFrontiersDB-Data/current/Objects/`. The interface name, not the source file
name, determines the data file: several interfaces can live in one `.ts` file
but each maps to its own `Objects/<Interface>.json`.

| Interface          | Data File               | Defined in            |
| ------------------ | ----------------------- | --------------------- |
| `PilotTalentType`  | `PilotTalentType.json`  | `src/types/pilot.ts`  |
| `PilotPersonality` | `PilotPersonality.json` | `src/types/pilot.ts`  |
| `PilotClass`       | `PilotClass.json`       | `src/types/pilot.ts`  |
| `PilotTalent`      | `PilotTalent.json`      | `src/types/pilot.ts`  |
| `Pilot`            | `Pilot.json`            | `src/types/pilot.ts`  |
| `PilotType`        | `PilotType.json`        | `src/types/pilot.ts`  |
| `Module`           | `Module.json`           | `src/types/module.ts` |
| `ModuleStat`       | `ModuleStat.json`       | `src/types/module.ts` |
| `ModuleCategory`   | `ModuleCategory.json`   | `src/types/module.ts` |
| `ModuleType`       | `ModuleType.json`       | `src/types/module.ts` |
| `ModuleRarity`     | `ModuleRarity.json`     | `src/types/module.ts` |
| `Rarity`           | `Rarity.json`           | `src/types/rarity.ts` |

**Key point:** `PilotTalentType` maps to `PilotTalentType.json`, NOT `Pilot.json`.
When in doubt, the data file has the same name as the interface, regardless of
which `src/types/*.ts` file the interface is declared in.
