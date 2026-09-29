# Weapon -> mount relative transform: source investigation (Shocktrain vs Bayonet/Callisto)

> **Note (2026-09):** this investigation predates the consolidation of model
> composition into the Site. References below to the Python precomputer
> (`wrf_models`, `combine.module_worlds`, `config.MOUNT_ORIENTATION`, etc.) describe
> the now-removed `WRFrontiersDB-Models` repo; the live implementation is
> `src/scripts/robot/model/` (`mount.ts` = resolution) with the correction tables
> in `src/utils/constants.ts` (`WEAPON_MOUNT_ROTATION`,
> `WEAPON_ROTATION_OVERRIDES`). The "Recommended pipeline changes" below have
> since been implemented there (mount way driven by the adapter set, a mount
> rotation per mount way, the `Standard` adapter offset applied, light-weapon
> roll restored to -90). The findings themselves are retained as the
> source-of-truth rationale for those constants.

_Goal: determine whether the exported source assets carry a mounted weapon's relative
rotation/position to its shoulder hardpoint, so the combined model can place titan weapons
(Alpha) as well as light weapons (Typhon). Supersedes the open items in
`mount_transform_resolution.md` in the external `wrf-model-analysis` workspace
(`/mnt/.windows-c/os-shared/dev/wrf-model-analysis/`)._

Raw exports read from `/srv/dev/wrf/data/exports/WRFrontiers/Content/Sparrow`.

## TL;DR

- **Light weapons (Punisher, Shocktrain) mount as a mirrored Left/Right pair;
  titan weapons (Callisto, Bayonet) mount as a single `Standard` unit.** The pipeline
  currently forces Left/Right from the socket-name suffix and applies the light-weapon
  roll to everything -> wrong convention for titan weapons.
- **The weapon->shoulder relative ROTATION is still not serialized in any asset** (confirmed
  again for the titan chain). It is applied by compiled runtime attach code.
- **Neither is a usable relative POSITION for titan weapons.** The only serialized position
  hook, the adapter static-mesh `Adapter` socket, is ~zero for titan weapons
  (Callisto `(0,0,0)`, Bayonet `(0,0,30)`), so it cannot account for Alpha's offset.
- => For titan weapons the mount transform must be a **per-mount-way / per-weapon constant
  correction** (rotation AND a position offset), calibrated once against an in-game
  screenshot, exactly like the light-weapon roll but with its own values. The light-weapon
  calibration does not transfer.

## What the mount graph looks like (both Alpha presets)

```
Chassis -> Torso @ "Root" -> ShoulderR @ "Shoulder_R" -> Weapon @ "Shoulder_Weapon_0"
```

`DA_Preset_Titan_Alpha` mounts `DA_Module_Weapon_Callisto`; `DA_Preset_Titan_Alpha_Bayonet`
mounts `DA_Module_Weapon_Bayonet`. Both mount ONE weapon at `Shoulder_Weapon_0` on the right
shoulder (no mirrored pair). Typhon mounts a Punisher/Shocktrain at BOTH `Shoulder_Weapon_0`
and `_1` on each of `Shoulder_L`/`Shoulder_R`.

## The decisive difference: mount way + adapters

| Weapon           | class | `CharacterModules` mount way | Adapters present | `Adapter` socket offset                                       |
| ---------------- | ----- | ---------------------------- | ---------------- | ------------------------------------------------------------- |
| Punisher         | light | Left / Right / Standard      | L, R, Standard   | L `(0,-90.98,-65.39)`, R `(19.3,133.3,-65.2)`, Std `(0,0,15)` |
| Shocktrain       | light | Left / Right / Standard      | L, R, Standard   | L `(0,-90.9,-62.29)`, R `(0,90.9,-62.29)`, Std `(0,0,15)`     |
| Callisto (Alpha) | titan | **Standard only**            | Standard only    | `(0,0,0)`                                                     |
| Bayonet (Alpha)  | titan | **Standard only**            | Standard only    | `(0,0,30)`                                                    |

Light weapons expose a per-side adapter, so the game mirrors them L/R. Titan weapons expose
only `ESCharacterModuleMountWay::Standard` — a single centered mount. The socket suffix
`_R`/`_L` on `Shoulder_Weapon_0` is the _hardpoint_ name, NOT the weapon's mount way.

## Weapon-local geometry convention also differs

Reference-pose `Base` bone (child of `Root`) and imported bounds origin:

| Weapon     | Base bone (local) | bounds origin     | bounds extent X |
| ---------- | ----------------- | ----------------- | --------------- |
| Punisher   | `(0,0,+77.1)`     | `(127,-8,70)`     | 294             |
| Shocktrain | `(0,0,+100.9)`    | `(126,0,87)`      | 281             |
| Bayonet    | `(0,0,-75.2)`     | `(70,21,-229)`    | 498             |
| Callisto   | `(0,0,-100.0)`    | `(153,-1.5,-172)` | 714             |

Light-weapon bodies sit ABOVE the root (+Z); titan-weapon bodies hang BELOW the root (-Z)
and are ~2-3x larger. So even the "root at hardpoint + roll" rule that is correct for light
weapons drops the titan body on the wrong side of the hardpoint.

## Hardpoint world (reference pose), right shoulder

- Typhon `Shoulder_Weapon_0` = `(93, 229, 216)`, `_1` = `(163, 207, -96)`
- Alpha `Shoulder_Weapon_0` = `(61, 236, -93)`

Comparable outboard Y (~230). The weapon root is dropped here in both cases; light weapons
land correctly, titan weapons do not, which localizes the error to the weapon-side
convention + the (unserialized) runtime attach transform, not the hardpoint.

## What was ruled out for titan weapons (nothing carries the transform)

- `BP_Weapon_Callisto` / `BP_Weapon_Bayonet`: RootComponent is the skeletal-mesh component
  with DEFAULT (identity) transform; no `RelativeLocation`/`RelativeRotation` anywhere. The
  adapter is NOT a child component in the BP default object -> it is spawned and attached by
  runtime code.
- `BP_TitanAlpha_Adapter` / `BP_Bayonet_Adapter`: only a `StaticMesh` ref, no transform.
- Adapter static-mesh `Adapter` socket: location only (~0), no rotation.
- Weapon skeleton sockets: `Widget`/`Muzzle`/`BatteryPos`/`ArmorCenter_Weapon` (UI/FX/muzzle),
  no attach socket.
- `SWeaponModuleScaler`/`STitanWeaponModuleScaler`: gameplay stats only (damage, spread, reload).
- grep for `RelativeLocation|RelativeRotation|RelativeScale3D|Offset*|MountTransform|
AttachSocketName|SocketOverride` across all four BPs: **zero hits.**

## Recommended pipeline changes

_(All implemented in `src/scripts/robot/model/mount.ts` — retained as rationale.)_

1. **Drive mount way from the weapon's `CharacterModules` key, not the hardpoint suffix.**
   Standard-only weapons are titan/centered; L/R weapons are light/mirrored. Store the mount
   way the parser already sees on `DA_Module_Weapon_*.CharacterModules` and use it in mount
   resolution / adapter-offset lookup (a lookup by `Left`/`Right` alone silently misses titan
   `Standard` adapters). Now `adapterMountWay` in `mount.ts`.
2. **Make `MOUNT_ORIENTATION` keyed by (socket type, mount way)** — light `Weapon`+L/R keeps
   the calibrated `-90` roll (+90 left mirror); titan `Standard` gets its own rotation AND a
   position offset, both calibrated against an in-game screenshot (the transform is not in the
   assets, so this is unavoidable). Now `WEAPON_MOUNT_ROTATION` in
   `src/utils/constants.ts`, keyed by mount way alone: the calibrated values
   turned out identical for light and heavy sockets.
3. Apply the serialized `Standard` adapter socket offset for titan weapons (small but real:
   Bayonet `(0,0,30)`). Now `weaponMount` in `mount.ts`, for `Standard` only.
4. Revert the experimental global `roll_deg=180` back to the light-weapon `-90` before
   shipping; it un-calibrates Typhon. Done — see `WEAPON_MOUNT_ROTATION`.

## Per-side titan weapons: Hive and Scrubber (2026-09)

The only weapons with a separate model per side (`BP_Weapon_Hive_L`/`_R`,
`BP_Weapon_Scrubber_L`/`_R`), both mounted only on Matriarch. Each model carries
one side adapter (no `Standard`), and the L/R meshes are Y-mirrors of each other.

- **The adapter labels are reversed.** Of the 100 Left/Right weapon adapters, the
  other 96 put a `Left` adapter's `Adapter` socket at -Y (robot-left) and a `Right`
  one's at +Y. These four do the opposite: `Hive_R`'s `Right` adapter sits at
  `(4.561, -34.911, 120)`, `Hive_L`'s `Left` at `(4.561, 34.911, 120)` (same for
  Scrubber; the raw `SM_*_Adapter_*` meshes agree, so not a parser bug). The
  `DA_Module_Weapon_*` `CharacterModules` table and the Matriarch shoulders'
  `MountWay` are not swapped.
- **In game, the geometry wins:** the robot's left shoulder shows the `_R` model,
  the right shoulder the `_L` one, as exact mirrors across the robot's center
  (verified in game on the Hive and Scrubber Matriarch presets). So
  `weaponModelId` (`mount.ts`) renders the per-side model whose side adapter points
  toward the shoulder, not the one labeled for it.
- **Rotation and offset are the light-weapon ones:** the usual `Left` +90 /
  `Right` -90 roll by shoulder side, and no adapter offset (applying the +120 Z
  offset lifts the weapon well off the hardpoint, which does not match the game).
  The Matriarch weapon hardpoints are unrotated and symmetric, so no
  `WEAPON_ROTATION_OVERRIDES` entry is needed.

## Only exhaustive alternative to a constant

Decompile the weapon/adapter Blueprint construction-script + the `SWeaponModule` attach
logic (Kismet/C++), which the current CUE4Parse JSON export does not include. Heavy; only
worth it if per-weapon exceptions multiply beyond a small constant table.
