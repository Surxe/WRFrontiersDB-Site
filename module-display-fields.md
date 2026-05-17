# Module Display Fields by ModuleGroup

## All Module Groups
**Fields to display for all modules:**
- Name
- Class  
- Faction
- ModuleRarity->Rarity

## Module Groups and Specific Fields

### cycle-gear
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain

### heavy-weapon  
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Weapon-specific fields:**
- Text tags list
- ModuleGroup.name
- TimeBetweenShots (accounting for burst delay)
- Damage components (see Weapon Damage section below)

### light-weapon
**Base fields:** Name, Class, Faction, Rarity  
**Additional fields:** WeightDrain, EnergyDrain
**Weapon-specific fields:**
- Text tags list
- ModuleGroup.name
- TimeBetweenShots (accounting for burst delay)
- Damage components (see Weapon Damage section below)

### non-titan-chassis
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Chassis-specific fields:**
- LegsArmor per level
- Armor per level (TODO rename to PelvicArmor in backend)
- NumLegs
- MaxSpeed per level (convert from cm/s to km/h)
- FuelCapacity per level
- LoadCapacity
- EnergyCapacity
- Mobility per level (TODO add this back in backend, it's Acceleration)

### non-titan-shoulder
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Shoulder-specific fields:**
- ShieldAmount per level
- ShieldRegeneration per level
- ShieldDelayReduction per level
- Armor per level
- ShieldDelay (enriched) per level
- ShieldTimeToRecharge (enriched) per level
- ShieldFullDelayRecharge (enriched) per level
- NumLightHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing light-weapon category)
- NumHeavyHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing heavy-weapon category)

### non-titan-torsos
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Torso-specific fields:**
- Cooldown per level
- Armor per level
- NumLightHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing light-weapon category)
- NumHeavyHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing heavy-weapon category)

### supply-gear
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain

### titan-chassis
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Chassis-specific fields:**
- LegsArmor per level
- Armor per level (TODO rename to PelvicArmor in backend)
- NumLegs
- MaxSpeed per level (convert from cm/s to km/h)
- FuelCapacity per level
- LoadCapacity
- EnergyCapacity
- Mobility per level (TODO add this back in backend, it's Acceleration)

### titan-shoulder
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Shoulder-specific fields:**
- ShieldAmount per level
- ShieldRegeneration per level
- ShieldDelayReduction per level
- Armor per level
- ShieldDelay (enriched) per level
- ShieldTimeToRecharge (enriched) per level
- ShieldFullDelayRecharge (enriched) per level
- NumTitanHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing titan-shoulder category)

### titan-torsos
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Torso-specific fields:**
- Cooldown per level
- Armor per level
- NumTitanHardpoints (# of module_socket_type_ref with compatible_module_types_refs containing titan-torso category)

### titan-weapon
**Base fields:** Name, Class, Faction, Rarity
**Additional fields:** WeightDrain, EnergyDrain
**Weapon-specific fields:**
- Text tags list
- ModuleGroup.name
- TimeBetweenShots (accounting for burst delay)
- Damage components (see Weapon Damage section below)

## Weapon Damage Display Strategy

### Challenge
Many weapons have multiple damage components (e.g., direct hit + delayed explosion), making tabular comparison difficult.

### Proposed Solutions

#### Option 1: Component Breakdown Columns
- **Direct Damage**: DamageArmor + DamageShield
- **AoE Damage**: AoeArmor + AoeNoArmor  
- **DoT Damage**: DirectDamagePerSecond (if present)
- **Total DPS**: Calculated effective DPS

#### Option 2: Damage Profile Summary
Single column showing:
- Primary damage type and amount
- Secondary components in parentheses (e.g., "4742 (+ AoE: 1644)")
- Use tooltips for detailed breakdown

#### Option 3: Normalized DPS Comparison
Calculate effective DPS accounting for:
- Direct damage / TimeBetweenShots
- AoE damage × average hit count / TimeBetweenShots
- DoT damage × duration / TimeBetweenShots

#### Option 4: Component-Based Tables
Separate table sections for:
- **Direct Hit Weapons**: Single damage value
- **Explosive Weapons**: Direct + AoE columns  
- **DoT Weapons**: Initial + Per-second columns

## Backend TODO / Changes Required

### Data Structure Changes
1. **Armor field rename**: Change `Armor` to `PelvicArmor` in chassis modules
2. **Add Mobility field**: Add `Mobility` field to chassis modules (represents Acceleration)
3. **TimeBetweenShots burst delay**: Add logic to account for burst delay in TimeBetweenShots calculation
4. **Weapon damage normalization**: Standardize damage component structure across all weapon types

### Enrichment Needed
1. **ShieldDelay enriched**: Calculate ShieldDelay from base values
2. **ShieldTimeToRecharge enriched**: Calculate from base values  
3. **ShieldFullDelayRecharge enriched**: Calculate from base values
4. **Hardpoint counts**: Calculate NumLightHardpoints, NumHeavyHardpoints, NumTitanHardpoints from module_socket_type_refs and compatible_module_types_refs

### Unit Conversions
1. **MaxSpeed**: Convert from cm/s to km/h (divide by 100, then multiply by 3.6)
2. **Damage aggregation**: Sum DamageArmor + DamageShield for total damage values
3. **DPS calculations**: Damage / TimeBetweenShots for rate comparisons

### Localization
1. **Field names**: Ensure all displayed field names have localization keys
2. **Unit labels**: Add localized unit labels (km/h, DPS, etc.)
3. **Damage type labels**: Localize damage component types (Direct, AoE, DoT)
