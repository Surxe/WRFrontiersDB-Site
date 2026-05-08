# Module Class and Tag Reference Data Structures Research

## Overview

This document details how module classes and tags are referenced and displayed across different module types in the WRFrontiersDB-Site, comparing the data structures for:

1. **Cycle/Supply Gear Modules** (ability modules)
2. **Weapon Modules** (titan weapons)
3. **Module Ability References** (per-ability scalars)

## Key Findings

### 1. Module-Level References (Common to All Module Types)

All modules share the same top-level reference structure:

```typescript
interface Module {
  module_classes_refs?: string[];      // Array of module class references
  module_tags_refs?: string[];          // Array of module tag references
  module_scalars: {
    levels: {
      constants: Record<string, unknown>; // Contains module_class_ref_X and module_tag_ref_X
    };
  };
  abilities_scalars?: Array<{
    levels: {
      constants: Record<string, unknown>; // Per-ability references
    };
  }>;
}
```

### 2. Cycle/Supply Gear Modules (Ability Modules)

**Example: DA_Module_Ability_CounterAttack.1**

```json
{
  "module_classes_refs": [
    "OBJID_ModuleClass::DA_Module_Class_Tactician.0"
  ],
  "module_tags_refs": [
    "OBJID_ModuleTag::DA_Tag_AbilityType_Defensive.0"
  ],
  "module_scalars": {
    "levels": {
      "constants": {
        "module_class_ref_1": "OBJID_ModuleClass::DA_Module_Class_Assault.0",
        "module_class_ref_2": "OBJID_ModuleClass::DA_Module_Class_Defender.0",
        "module_tag_ref_1": "OBJID_ModuleTag::DA_Tag_AbilityType_Defensive.0",
        "module_faction_ref": "OBJID_Faction::DA_Faction_FortEvo.0"
      }
    }
  }
}
```

**Characteristics:**
- Have `module_classes_refs` and `module_tags_refs` at the module level
- Have additional references in `module_scalars.levels.constants`
- References in scalars may differ from top-level references
- No `abilities_scalars` array (these are ability modules themselves)

### 3. Weapon Modules (Titan Weapons)

**Example: DA_Module_Weapon_Bayonet.0**

```json
{
  "module_classes_refs": [
    "OBJID_ModuleClass::DA_Module_Class_Tactician.0"
  ],
  "module_tags_refs": [
    "OBJID_ModuleTag::DA_Tag_WeaponDamageElectromagnetic.0",
    "OBJID_ModuleTag::DA_Tag_WeaponTypeSniper.0"
  ],
  "module_scalars": {
    "levels": {
      "constants": {
        "module_class_ref_1": "OBJID_ModuleClass::DA_Module_Class_Tactician.0",
        "module_tag_ref_1": "OBJID_ModuleTag::DA_Tag_WeaponDamageElectromagnetic.0",
        "module_tag_ref_2": "OBJID_ModuleTag::DA_Tag_WeaponTypeSniper.0",
        "module_faction_ref": "OBJID_Faction::DA_Faction_Freecon.0"
      }
    }
  }
}
```

**Characteristics:**
- Have `module_classes_refs` and `module_tags_refs` at the module level
- Have additional references in `module_scalars.levels.constants`
- Weapon-specific tags (e.g., `DA_Tag_WeaponDamageElectromagnetic`, `DA_Tag_WeaponTypeSniper`)
- No `abilities_scalars` array (these are primary modules, not ability modules)

### 4. Module Ability References (Per-Ability Scalars)

**Example: Chassis Module with Abilities**

```json
{
  "module_classes_refs": [
    "OBJID_ModuleClass::DA_Module_Class_Assault.0"
  ],
  "abilities_scalars": [
    {
      "levels": {
        "constants": {
          "module_class_ref_1": "OBJID_ModuleClass::DA_Module_Class_Assault.0",
          "module_class_ref_2": "OBJID_ModuleClass::DA_Module_Class_Tactician.0",
          "module_tag_ref_1": "OBJID_ModuleTag::DA_Tag_AbilityType_Offensive.0",
          "module_tag_ref_2": "OBJID_ModuleTag::DA_Tag_AbilityType_Mobility.0"
        }
      }
    },
    {
      "default_scalars": {
        "ChargeRegenDuration": 20.0
      }
    }
  ]
}
```

**Characteristics:**
- References are stored within `abilities_scalars` array
- Each ability can have its own set of class and tag references
- References are in `abilities_scalars[index].levels.constants`
- Different abilities can have different class/tag combinations
- Some abilities may only have `default_scalars` without `levels.constants`

## Data Structure Comparison

| Aspect | Cycle/Supply Gear | Weapon Modules | Module Ability References |
|--------|-------------------|----------------|---------------------------|
| **Top-level refs** | `module_classes_refs[]`, `module_tags_refs[]` | `module_classes_refs[]`, `module_tags_refs[]` | `module_classes_refs[]`, `module_tags_refs[]` |
| **Scalar refs** | `module_scalars.levels.constants` | `module_scalars.levels.constants` | `abilities_scalars[].levels.constants` |
| **Per-ability refs** | N/A (module is the ability) | N/A (module is the weapon) | Yes, each ability has own refs |
| **Tag types** | Ability-specific tags | Weapon-specific tags | Ability-specific tags |
| **Class resolution** | ModuleClass → CharacterClass | ModuleClass → CharacterClass | ModuleClass → CharacterClass |

## Current Display Implementation

### Module Pages
- **Module name/header**: Uses `getObjRefData(module)` for display
- **Module classes/tags**: Currently NOT displayed in the UI
- **Ability references**: Displayed via `ModuleAbilityReferences` component (shows raw refs)

### ObjRef Resolution
```typescript
// ModuleClass → CharacterClass
case 'ModuleClass': {
  const moduleClass = obj as ModuleClass;
  const characterClass = getParseObject<CharacterClass>(
    refToId(moduleClass.character_class_ref),
    'Objects/CharacterClass.json'
  );
  return {
    text: characterClass.name,
    iconPath: characterClass.badge.image_path,
    iconColor: characterClass.badge.hex,
  };
}

// ModuleTag → Direct display
case 'ModuleTag': {
  const moduleTag = obj as unknown as ModuleTag;
  return {
    text: moduleTag.name,
    textColor: moduleTag.text_hex,
    textBackgroundColor: moduleTag.background_hex.substring(2) + moduleTag.background_hex.substring(0, 2),
  };
}
```

## Key Differences and Implications

### 1. **Scope of References**
- **Module-level**: Apply to the entire module (shown in module lists, breadcrumbs)
- **Scalar-level**: Apply to the module's stats/behavior (currently not displayed)
- **Ability-level**: Apply to individual abilities (newly implemented)

### 2. **Data Redundancy**
- Many modules have both top-level and scalar-level references
- Scalar-level references may override or supplement top-level ones
- Ability-level references provide granular control per ability

### 3. **Display Gaps**
- Module classes and tags are NOT currently displayed on module detail pages
- Only ability references are displayed (via new ModuleAbilityReferences component)
- Top-level module classes/tags are resolved in `getObjRefData` but only used for display names

### 4. **Tag Classification**
- **Ability modules**: Use `DA_Tag_AbilityType_*` tags
- **Weapon modules**: Use `DA_Tag_WeaponDamage_*` and `DA_Tag_WeaponType_*` tags
- **Ability references**: Use ability-type tags specific to each ability

## Recommendations

1. **Display Module Classes/Tags**: Consider showing module-level classes and tags on detail pages
2. **Resolve Scalar References**: The scalar-level references could be displayed alongside module stats
3. **Consistent Resolution**: Use the same ObjRef resolution for all reference types
4. **UI Integration**: Integrate class/tag display into existing module page layout rather than separate component

## Current Implementation Status

- ✅ **Ability references**: Displayed via `ModuleAbilityReferences` component (raw refs only)
- ❌ **Module classes/tags**: Not displayed on module pages
- ❌ **Scalar references**: Not displayed (only used for stat calculations)
- ✅ **ObjRef resolution**: Available but not used for module-level display

The current implementation focuses on per-ability references as requested, but there are opportunities to display module-level classes and tags for better user understanding of module characteristics.
