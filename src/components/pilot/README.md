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

```
Tables.astro
├── Table.astro (x3 per pilot type)
    ├── LevelPilotTalenttd.astro (for talent tables)
    │   └── TalentCell.astro
    └── LevelPilotTalentTypetd.astro (for talent type tables)
```

## Data Flow

1. **Tables.astro** loads and processes pilot data
2. Converts talent references and groups by pilot type
3. Passes processed data to **Table.astro** instances
4. **Table.astro** creates table structure and delegates cell rendering
5. Cell components (**LevelPilotTalenttd** or **LevelPilotTalentTypetd**) handle specific data
6. **TalentCell.astro** provides final talent display with stat integration
