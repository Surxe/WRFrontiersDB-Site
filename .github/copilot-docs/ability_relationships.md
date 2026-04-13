# Module, Character Module, and Ability Object Relationships Documentation

This document describes the relationships and mapping logic between Modules, Character Modules, and Abilities to retrieve a given ability's description and stats.

## Module & Ability Relationship Logic

* **Torso/Chassis (Core Modules)**: Uses `abilities_scalars` for stats. Name and description are often in `Ability.json`.
* **Non-Core Gear/Weapons**: Uses `module_scalars` for stats. Name and description are directly in `Module.json`, and are therefore not covered in the rest of this guide.

### Traversal Flow
1. **Module** (`Module.json`)
   * `character_module_mounts[0].character_module_ref` -> Links to **CharacterModule.id**.
   * `module_scalars`: Contains stats for the module itself.
   * `abilities_scalars`: A list of stat data configurations for associated abilities.
2. **CharacterModule** (`CharacterModule.json`)
   * `abilities_refs`: A list of strings linking to **Ability.id**.
   * **Index-Based Mapping**: The element at `CharacterModule.abilities_refs[i]` corresponds exactly to the stat definitions found at `Module.abilities_scalars[i]`.
3. **Ability** (`Ability.json`)
   * Contains the `name` and `description` (with placeholders for stats).

### Examples

#### Example 1: Multiple Abilities without Stat Embeds
* **Module**: `DA_Module_ChassisAres.2`
* **Character Module**: `BP_Module_Ares_Chassis.0`
* **Abilities**: `BP_Module_Ares_Chassis.1` (Dash Thrusters) and `BP_Module_Ares_Chassis.2` (Jump Jet).
* **Result**: Neither ability has `levels.variables` in `abilities_scalars`. Both descriptions are listed on the module page without dynamic stat embedding.

#### Example 2: Ability with Rendered Linked Stats
* **Module**: `DA_Module_TorsoBulgasari.1`
* **Character Module**: `BP_Module_Bulgasari_Torso.0`
* **Ability**: `BP_Module_Bulgasari_Torso.1`
  * Description: *"Bombards an area, dealing {Dmg} damage per rocket to all modules within a {ActRadius} blast radius."*
* **Result**: `Module.abilities_scalars[0]` provides the dynamic values for `{Dmg}` and `{ActRadius}` based on the selected level.