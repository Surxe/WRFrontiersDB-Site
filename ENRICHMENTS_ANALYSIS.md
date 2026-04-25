# WRFrontiersDB-Site End-Level Enrichments Analysis

This document details all end-level enrichments that occur in the WRFrontiersDB-Site (frontend) repository. These enrichments should be moved to WRFrontiersDB-Parser (backend) to improve performance, reduce frontend complexity, and create a cleaner separation of concerns.

## Overview of Enrichment Types

### 1. Module Enrichments

### 2. Pilot Enrichments

### 3. Virtual Bot Creation

### 4. Slug Generation

### 5. Localization Meta Descriptions

---

## 1. Module Enrichments

### 1.1 Module Group Assignment

**Location**: `src/utils/module_group_mapping.ts`
**Function**: `enrichModulesWithGroups()`

**What it does**:

- Maps each module to a logical group (e.g., "titan-shoulder", "non-titan-shoulder", "light-weapon")
- Uses `MODULE_TYPE_TO_GROUP` mapping to determine group from `module_type_ref`
- Adds `module_group` field to `EnrichedModule` interface

**Input**: Raw modules + module types + module categories
**Output**: Modules with `module_group` field populated

**Data added**:

```typescript
interface EnrichedModule extends Module {
  module_group?: string; // e.g., "titan-shoulder", "non-titan-shoulder"
  bot_ref?: string;
  has_distinct_shoulders?: boolean;
}
```

### 1.2 Bot ID Assignment

**Location**: `src/utils/robot.ts`
**Function**: `enrichModulesWithBotIds()`

**What it does**:

- Creates virtual bots from factory presets
- Maps core modules to their associated bot IDs
- Adds `bot_ref` field to modules
- Calculates `has_distinct_shoulders` for shoulder modules

**Input**: Modules + character presets
**Output**: Modules with `bot_ref` and `has_distinct_shoulders` fields

**Data added**:

```typescript
{
  bot_ref: string, // e.g., "alpha", "ares", "grim"
  has_distinct_shoulders?: boolean // true if preset has different left/right shoulders
}
```

### 1.3 Distinct Shoulders Detection

**Location**: `src/utils/robot.ts` (within `enrichModulesWithBotIds()`)

**What it does**:

- For each preset, compares left and right shoulder module references
- Sets `has_distinct_shoulders: true` if `shoulderL.module_ref !== shoulderR.module_ref`
- Used by `getObjRefData()` to determine when to show "Left"/"Right" prefixes

**Logic**:

```typescript
const shoulderL = preset.modules?.find((e) => e.socket_name === 'Shoulder_L');
const shoulderR = preset.modules?.find((e) => e.socket_name === 'Shoulder_R');
presetDistinctShoulders[presetId] = Boolean(
  shoulderL && shoulderR && shoulderL.module_ref !== shoulderR.module_ref
);
```

---

## 2. Pilot Enrichments

### 2.1 Pilot Talent Enrichment

**Location**: `src/utils/pilot.ts`
**Function**: `enrichPilotTalents()`

**What it does**:

- Scans all pilots to find which ones use each talent
- Adds `talent_type_ref` and `level` to talent objects
- Creates `pilots_with_this_talent` array with pilot info
- Sorts pilots: hero pilots first, then by name

**Input**: Raw pilot talents + pilots
**Output**: Enriched pilot talents with pilot associations

**Data added**:

```typescript
interface EnrichedPilotTalent extends PilotTalent {
  talent_type_ref: string;
  level: number;
  pilots_with_this_talent: PilotWithTalentInfo[];
}

interface PilotWithTalentInfo {
  pilot: Pilot;
  level: number; // 1-based
  talentIndex: number;
}
```

**Logic**:

1. Initialize all talents with empty `pilots_with_this_talent` arrays
2. For each pilot, scan through talent levels and references
3. Add pilot info to corresponding talent entries
4. Set `talent_type_ref` and `level` from first occurrence
5. Sort pilots array (hero pilots first)

---

## 3. Virtual Bot Creation

### 3.1 Virtual Bot Generation

**Location**: `src/utils/robot.ts`
**Function**: `getVirtualBots()`

**What it does**:

- Creates synthetic "VirtualBot" objects from factory presets
- Groups factory presets by bot name (e.g., Alpha, Ares, Grim)
- Aggregates core modules and factory presets for each bot
- Generates slugified bot IDs for URLs

**Input**: Modules + character presets
**Output**: Virtual bot objects

**Data structure**:

```typescript
interface VirtualBot {
  parseObjectClass: 'VirtualBot';
  parseObjectUrl: 'robots';
  id: string; // slugified bot ID (e.g., "alpha")
  name: LocalizationKey; // localized name (e.g., "Ares")
  character_type: string;
  core_modules: string[]; // module IDs
  factory_presets: string[]; // preset IDs
  iconPath?: string;
}
```

**Logic**:

1. Filter factory presets (`is_factory_preset: true`)
2. For each core module, find first factory preset that uses it
3. Create bot from preset name (slugified)
4. Aggregate all core modules and factory presets for each bot
5. Set icon from preset

---

## 4. Slug Generation

### 4.1 Object Slug Generation

**Location**: `src/utils/slug_generator.ts`
**Function**: `generateSlugMap()`

**What it does**:

- Generates URL-friendly slugs for all objects
- Handles special cases for different object types
- Creates mapping from object ID to slug
- Writes to `public/slug_map.json`

**Build script**: `scripts/build-slugs.ts`

**Slug generation rules**:

#### Pilots

- Format: `{firstname.en}-{lastname.en}`
- Example: "john-doe"

#### Pilot Talents

- Format: `{talent_name.en}`
- Example: "shield-bash"

#### Modules

- Standard: `{module_group_singular.en}-{module_name.en}`
- Titan shoulders: `titan-shoulder-{side}-{bot_ref}`
- Example: "titan-shoulder-left-alpha"

#### Character Presets

- Factory presets: `{preset_name.en}` (slugified)
- AI presets: `{preset_id}` (camelCase to kebab-case and id-prefix removed)
- Example: "kates-bulgasari", "ai-pilot-001"

#### Module Groups

- Format: `{group_name.en}` (lowercase, hyphens)
- Example: "titan-shoulders", "light-weapons"

#### Others

- Default: `{object_name.en}` (slugified)
- Fallback: `{object_name.en}`

### 4.2 Build Process Integration

**Location**: `scripts/build-slugs.ts`

**What it does**:

- Loads all object types from WRFrontiersDB-Data
- Filters modules by production status (`production_status === 'Ready'`)
- Generates slug map using enrichment context
- Adds module group slugs
- Writes to `public/slug_map.json`

**Production filtering**:

- Modules: Only include if `production_status === 'Ready'`
- Other objects: Always include (no production status field)

---

## 6. Shoulder Module Display Logic

### 6.1 Enhanced ObjRef Data

**Location**: `src/utils/obj_ref.ts`
**Function**: `getObjRefData()` (Module case)

**What it does**:

- Checks if module is a shoulder module with distinct shoulders
- Determines left/right side from module ID/type
- Prepends "Socket_Left"/"Socket_Right" localization keys
- Returns enhanced text array with side prefix

**Logic**:

```typescript
if (enrichedModule.has_distinct_shoulders && enrichedModule.bot_ref) {
  const groupId = getModuleGroupId(module.module_type_ref);
  if (groupId === 'titan-shoulder' || groupId === 'non-titan-shoulder') {
    const isLeftShoulder =
      module.module_type_ref.includes('ShoulderL') ||
      module.id.includes('ShoulderL') ||
      module.id.includes('left-alpha');

    const sideLocaleKey = getSocketSideLocaleKey(
      isLeftShoulder ? 'Shoulder_L' : 'Shoulder_R'
    );
    return {
      text: [sideLocaleKey, module.name],
      // ...
    };
  }
}
```

**Input**: `EnrichedModule` (instead of raw `Module`)
**Output**: Enhanced `ObjRefData` with side prefixes

---

## 7. Data Dependencies and Flow

### 7.1 Enrichment Dependencies

```
Raw Data (WRFrontiersDB-Data)
├── Module.json
├── CharacterPreset.json
├── Pilot.json
├── PilotTalent.json
└── [other object types]

↓ Frontend Enrichments

Enriched Data
├── Modules with module_group, virtual_bot_ref, has_distinct_shoulders
├── Pilot talents with pilots_with_this_talent, level, talent_type_ref
├── Virtual bots aggregated from presets
├── Slug mappings (ID → slug)
```

### 7.2 Build-time vs Runtime

- **Build-time**: All enrichments happen during build
- **Runtime**: Only uses pre-enriched data and slug maps
- **No runtime enrichment**: Frontend only consumes enriched data

---

## 8. Recommended Backend Migration

### 8.1 What to Move to WRFrontiersDB-Parser

#### High Priority (Core Enrichments)

1. **Module group assignment** - Static mapping, easy to compute
2. **Bot ID assignment** - Requires preset analysis
3. **Distinct shoulders detection** - Simple comparison logic
4. **Virtual bot creation** - Aggregates factory presets
5. **Slug generation** - Build-time URL mapping

#### Medium Priority (Display Enhancements)

6. **Pilot talent enrichment** - Requires pilot scanning
7. **Shoulder display logic** - Side detection for prefixes

## 9. Implementation Notes

### 9.1 Current Frontend Dependencies

- **Build scripts**: `scripts/build-slugs.ts` requires slug generation
- **Pages**: Many pages import enrichment utilities
- **Components**: `ObjRef.astro` uses enriched module data
- **Utilities**: Multiple files depend on enrichment functions

### 9.2 Migration Strategy

1. **Phase 1**: Move core enrichments (module groups, bot IDs, slugs)
2. **Phase 2**: Move virtual bot creation and pilot talent enrichment
3. **Phase 3**: Move display logic and meta descriptions
4. **Phase 4**: Update frontend to consume enriched data
5. **Phase 5**: Remove frontend enrichment code

### 9.3 Backward Compatibility

- Frontend should fall back to current enrichment logic if enriched data missing
- Gradual migration allows testing of individual enrichments
- Slug map format should remain compatible during transition

---

## 10. File Inventory

### 10.1 Enrichment Files to Move

- `src/utils/module_group_mapping.ts` - Module group assignment
- `src/utils/robot.ts` - Virtual bot creation and bot ID assignment
- `src/utils/pilot.ts` - Pilot talent enrichment
- `src/utils/slug_generator.ts` - Slug generation logic
- `scripts/build-slugs.ts` - Build script integration

### 10.2 Files to Update

- `src/utils/obj_ref.ts` - Use enriched module data
- `src/components/obj_ref/ObjRef.astro` - Consume enriched data
- Various pages and components - Import enriched data instead of raw

### 10.3 Files to Remove (Post-Migration)

- All enrichment utilities from `src/utils/`
- Build scripts for slug generation
- Complex enrichment logic from components

---

## Summary

The WRFrontiersDB-Site frontend currently performs significant data enrichment that should be moved to the WRFrontiersDB-Parser backend. This includes:

1. **Module enrichments** (group assignment, bot ID, distinct shoulders)
2. **Pilot enrichments** (talent-pilot relationships)
3. **Virtual bot creation** (factory preset aggregation)
4. **Slug generation** (URL-friendly identifiers)

Moving these enrichments will improve performance, simplify the frontend codebase, and create a cleaner architecture where the parser handles data preparation and the frontend handles display.
