# CharacterPreset Modules Logic

This document details the grouping, counting, and labeling logic used for displaying Bot modules based on the `CharacterPreset.json` array structure.

## Core Philosophical Change

By using an ordered array and numeric parent indexes, we can collapse duplicate information while highlighting meaningful differences.

---

## 1. Grouping and Counting Logic

Modules are grouped by their `module_ref`. The count displayed (e.g., `x3`) is the number of times that reference appears in the preset's modules array.

### Weapon Counting

Weapons are grouped purely by their `module_ref` unless multiple groups (Shoulder/Torso) exist and diversity is high (see [Weapon Grouping](#3-weapon-grouping)).

**Example: Ceres Locust (`DA_Preset_BotAdv_CeresLocust.0`)**

- The array contains:
  - 1x `Locust` on `Shoulder_Weapon_0` (Left)
  - 1x `Locust` on `Shoulder_Weapon_0` (Right)
  - 1x `Locust` on `Torso_Weapon_0`
- **Result**: `Locust x3`
- _Why?_ To keep the UI concise, we increment the total count rather than listing them separately per slot.

**Example: Bulwark Quantum (`DA_Preset_BotAdv_BulwarkQuantum.0`)**

- The array contains 4 instances of `Buckshot` distributed across the shoulders.
- **Result**: `Buckshot x4`

---

## 3. Weapon Grouping Labels

We use a helper `hasDifferentWeaponIds` to determine if we should sub-divide the weapon list by their physical location (Shoulder vs. Torso).

- If only **one** type of weapon exists in the preset: **HIDE group info**.
  - _Result_: `Locust x3` (Clean)
- If **multiple** types of weapons exist: **SHOW group info**.
  - _Result_: `Locust (Shoulder) x2`, `Buckshot (Torso) x1` (Helpful context)

---
