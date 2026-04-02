# Pilot Components

This directory contains Astro components for rendering pilot data tables and talent information.

## Components Overview

### Tables.astro
**Main container component** that orchestrates all pilot table rendering.
- Groups pilots by type (Legendary, Common)
- Renders three table variants per pilot type:
  - Talent hover table (onHover)
  - Full talent table (full) 
  - Talent type table

### Table.astro
**Generic table renderer** that creates the HTML table structure.
- Renders pilots with levels 1-5 in columns
- Handles rowspan calculations for multi-talent levels
- Dynamically chooses between talent or talent type rendering
- Validates exclusive prop usage (pilotTalents XOR pilotTalentTypes)

### TalentPilotRow.astro
**Row component** for pilot talent data.
- Renders multiple table rows that a single Pilot will have for PilotTalent data
- Receives pre-calculated maxTalents for performance optimization
- Delegates cell rendering to LevelPilotTalenttd components
- Handles pilot name column with rowspan

### TalentTypePilotRow.astro
**Row component** for pilot talent type data.
- Renders multiple table rows that a single Pilot will have for PilotTalentType data
- Receives pre-calculated maxTalents for performance optimization
- Delegates cell rendering to LevelPilotTalentTypetd components
- Handles pilot name column with rowspan

### LevelPilotTalenttd.astro
**Table cell component** for individual pilot talents.
- Renders talent data for levels 1-4 (multiple talents per level)
- Special handling for level 5 (single talent with rowspan)
- Integrates with TalentCell for display logic
- Performs stat value calculations and replacements

### LevelPilotTalentTypetd.astro
**Table cell component** for pilot talent types.
- Renders talent type information with rowspan
- Used for the talent type table variant
- Simpler structure since talent types are singular per level

### TalentCell.astro
**Core display component** for individual talent information.
- Handles both hover and full display modes
- Renders talent object reference and description
- Integrates with StatEmbedLocalizedText for stat replacements
- Supports on-hover stat choices display

## Component Interactions

### Table Structure Representation

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Pilot Name  │ Level 1  │ Level 2  │ Level 3  │ Level 4  │ Level 5  │
├─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                   TalentPilotRow or TalentPilotTypeRow             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘


┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Pilot Name  │ Level 1  │ Level 2  │ Level 3  │ Level 4  │ Level 5  │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
TalentPilotRow or TalentPilotTypeRow represents:
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ {ObjRef}    │LevelPilot│LevelPilot│LevelPilot│LevelPilot│LevelPilot│
│ (rowspan)   │Talenttd  │Talenttd  │Talenttd  │Talenttd  │Talenttd  │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│             │LevelPilot│LevelPilot│LevelPilot│LevelPilot│LevelPilot│
│             │Talenttd  │Talenttd  │Talenttd  │Talenttd  │Talenttd  │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│             │LevelPilot│LevelPilot│LevelPilot│LevelPilot│LevelPilot│
│             │Talenttd  │Talenttd  │Talenttd  │Talenttd  │Talenttd  │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Each LevelPilotTalenttd contains:
┌─────────────────┐
│  TalentCell     │
│  TalentCell     │  ← Multiple talents for Legendary pilots
│  TalentCell     │
└─────────────────┘

OR for Level 5 (single talent):
┌─────────────────┐
│  TalentCell     │  ← Single talent with rowspan
│ (rowspan=3)     │
└─────────────────┘
```

### Component Flow

```
Tables.astro
├── Table.astro (x3 per pilot type)
│   ├── Pre-calculates: maxTalents for each pilot
│   └── Delegates rows to:
│       ├── TalentPilotRow (for talent tables)
│       │   ├── Pilot Name Column: {ObjRef} with rowspan
│       │   └── Level Columns (1-5): LevelPilotTalenttd
│       │       └── TalentCell (multiple per level)
│       └── TalentTypePilotRow (for talent type tables)
│           ├── Pilot Name Column: {ObjRef} with rowspan
│           └── Level Columns (1-5): LevelPilotTalentTypetd
│               └── {ObjRef} for talent type
```

## Data Flow

1. **Tables.astro** loads and processes pilot data
2. Converts talent references and groups by pilot type
3. Passes processed data to **Table.astro** instances
4. **Table.astro** pre-calculates maxTalents and creates table structure
5. **Table.astro** delegates row rendering to TalentPilotRow or TalentTypePilotRow
6. Row components handle cell rendering through LevelPilotTalenttd/LevelPilotTalentTypetd
7. **TalentCell.astro** provides final talent display with stat integration
