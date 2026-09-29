---
name: model-correction
description: Diagnose and fix a WRFrontiers robot model that renders wrong on the /models page (weapon/shoulder position or rotation, oversized hitboxes, stray geometry). Use when a bot's composed model looks incorrect in the live viewer, or when validating a newly-parsed model. The composition lives in src/scripts/robot/model/.
---

# Correcting WRFrontiers robot models

The `/models` page composes per-module data into a full robot **live in the
browser**. The composition is the headless core in `src/scripts/robot/` (no DOM
or WebGL, so it also runs in Node):

- `model/mount.ts` — mount resolution (`placeModules`, `requiredModelIds`, and
  the socket / adapter helpers).
- `src/utils/constants.ts` — the runtime correction tables
  (`WEAPON_MOUNT_ROTATION`, `WEAPON_ROTATION_OVERRIDES`) and the socket / bone
  ids (`TORSO_SOCKET`, `TORSO_MOUNT_BONE`).
- `model/math.ts` — UE FRotator / quaternion helpers on three.js `Matrix4`.
- `model/hitbox.ts` — world-space hitbox primitives, shared by rendering and
  area measurement.
- `model/mesh.ts` — FX-mesh classification and component-space bounds.
- `assembly.ts` — `assemble()`: load the needed models, place them, collect
  hitboxes.

Drawing lives in `src/scripts/model_viewer/render/` (`scene.ts` geometry,
`viewer.ts` the three.js scene).

A source edit only takes effect in the browser after a rebuild; use the dev
server (`npm run dev`, or the `run-dev-server` skill) to see changes on `/models`.

Ground-truth reference (a hand-built, in-game-correct Typhon): read-only at
`/mnt/.windows-c/os-shared/dev/wrf-model-analysis/` (`assemble_typhon.py`,
`typhon_full_assembly.obj`). Background: `docs/weapon_mount_findings.md`.

## Data locations

- Parsed models: `/srv/dev/repos/WRFrontiersDB-Data/current/`
  (`Objects/*.json`, `Models/<CharacterModuleId>.json`).
- The site serves these live via the `public/WRFrontiersDB-Data` symlink (data
  repo root), so `/models` fetches `/WRFrontiersDB-Data/current/...` directly.
  Confirm `current/` is populated before blaming the code.
- Raw CUE4Parse/FModel exports (source of truth for asset data): `/srv/dev/wrf/data/exports/WRFrontiers/Content/Sparrow/`
  (weapon/adapter BPs, `SKEL_*`/`SK_*`/`PHYS_*`). Use these to confirm whether a
  problem is in the asset or the parser.

## Conventions and gotchas

- UE units: cm, X forward / Y right / Z up. Robot-right = +Y, robot-left = -Y.
  The scene sets `root.rotation.x = -PI/2` (data is Z-up, three.js is Y-up).
- `Weapon_0`/`Weapon_1` are NOT consistently top/bottom across sides — identify a
  weapon by its parent socket (`Shoulder_L`/`Shoulder_R`) plus world Z, not by its
  socket number.

## Iteration loop

1. `npm run dev` and load the affected build in `/models`: open the preset's
   page (`/character_presets/<slug>`) and follow its "View this loadout" link,
   or build it part by part on `/models` (and toggle mesh/hitbox as needed). Presets live in `Objects/CharacterPreset.json`;
   weapon display names differ from ids (e.g. "Magneto" = StickyGun) — resolve via
   `Module.json` `name.Key`.
2. Get directional feedback from the user against the ground-truth reference.
3. Make the change in the relevant `robot/model/` module, verify numerically
   (below), and reload.

## Verifying numerically (Node)

The core is headless, so a `tsx` script can use it with **no scaffolding
edits**: load the `Objects/*.json` tables into a `RobotTables`, then either run
`assemble()` with a `ModelCache` that reads `Models/<id>.json` from disk (as
`tests/robot/assembly.ts` does), or call `placeModules` (`model/mount.ts`) with a
`Map` of loaded models, and print each placement's world position / rotation.

World matrices are three.js `Matrix4`s (column-major `elements`; the position is
`elements[12..14]`). `rotatorMatrix` builds Rz(yaw)Ry(pitch)Rx(roll), i.e.
`Euler(roll, pitch, yaw, 'ZYX')`, so read a rotation back with
`new Euler().setFromRotationMatrix(m, 'ZYX')` (x = roll, y = pitch, z = yaw, in
radians).

`npx tsc --noEmit` must stay clean; also run `npm run build`.

## Correction mechanisms (symptom -> cause -> where)

1. **Whole upper body sunk / torso at wrong height** -> the "Root" preset socket
   is the chassis origin bone; the real attach is the chassis `Torso` bone.
   `socketFrame` remaps `TORSO_SOCKET` -> `TORSO_MOUNT_BONE` (`mount.ts`).

2. **Shoulders lifted ~2x, weapons ~3x (baked-root skeletons)** -> some skeletons
   bake the mount height into the root bone while the mesh stays root-relative, so
   the full bone world double-counts down the chain. `mountBoneFrame` picks the
   full vs root-at-origin bone world whose position lands INSIDE the parent mesh
   bounds (`meshBounds`). No-op when the root isn't baked. Hitbox placement uses
   `boneWorlds(bones, true)` in `model/hitbox.ts`.

3. **Left shoulder renders the right mesh (or vice versa)** -> per-side shoulders
   are one module id with separate Left/Right BPs. `placeModules` derives
   the side from the `socket_name` suffix and passes it to `modelIdForModule` so
   the correct-side BP is resolved. Per-side WEAPONS (Hive, Scrubber) are the
   exception: their adapter labels are reversed, so `weaponModelId` picks the
   model whose side adapter points toward the parent shoulder (robot-left = -Y),
   i.e. `_R` on the left shoulder, `_L` on the right (verified in game).

4. **Weapon orientation wrong / mirrored** -> runtime mount rotation, not in any
   asset. `WEAPON_MOUNT_ROTATION[mountWay]` (`Left` roll +90 / `Right` -90 /
   `Standard` for titan-centered). Mount way comes from the parent shoulder side
   - the weapon's adapter set (`adapterMountWay`: Left/Right adapters = mirrored
     light; Standard-only = titan). A weapon with per-side models (Hive,
     Scrubber) has no Standard adapter and rolls by its shoulder's side even
     though its rendered model's adapter is labeled for the other side.

5. **Weapon floats off its mount / adapter gap** -> the adapter socket offset
   positions the (unrendered) adapter mesh, NOT the weapon root, for Left/Right
   adapters. Only the `Standard` adapter offset is applied to weapon placement
   (`weaponMount`). Adapters carry NO rotation — never
   expect them to fix orientation.

6. **Hitbox boxes ~2x too big** -> UE `FKBoxElem` X/Y/Z are FULL dimensions;
   `primitiveGeometry` (`render/scene.ts`) passes them straight to
   `THREE.BoxGeometry` (which wants full w/h/d); the area raycaster halves them.
   Capsules use radius+length and are unaffected.

7. **Stray cone/plane geometry off the body** -> a cosmetic FX/effect skeletal
   mesh component (`SK_*_Effect` / `*_FX`) rendered as solid. Filtered by `isFxMesh`
   when rendering (`render/scene.ts`) AND in `meshBounds` (`model/mesh.ts`). Data
   keeps the FX asset;
   this is a render-side filter.

8. **One weapon oriented inconsistently with its siblings** -> that hardpoint bone
   carries a rotation the game corrects at runtime but the export omits. It is NOT
   fixable by mirroring the other shoulder (a sagittal mirror negates yaw/Z but
   PRESERVES roll/X, so roll anomalies can't be expressed as a mirror). Override
   the weapon's final world rotation, keeping its position:
   `WEAPON_ROTATION_OVERRIDES['${parentShoulderModelId}|${socket}'] = [pitch, yaw, roll]`
   (`withRotation`; `src/utils/constants.ts`). Set the value from the in-game view.

## Diagnostic notes

- Find every bot with non-uniform weapon hardpoint rotations (the class that needs
  mechanism 8): walk `CharacterPreset.json`, for each weapon resolve the parent
  shoulder model, look up its `socket_name` bone in `boneWorlds(bones)`, and flag
  non-identity rotation (compare Left vs Right for asymmetry). As of last audit only
  Garuda / Norna / Spire were asymmetric; Hitcher is non-identity but symmetric.
- Confirm an asset detail in the raw export: adapter socket rotation lives in
  `SM_*_Adapter_*.json` -> `StaticMeshSocket` `SocketName:"Adapter"`; reference-pose
  bone rotations in `SKEL_*.json` `Skeleton.ReferenceSkeleton.FinalRefBonePose`.
- **Some asymmetry is REAL in-game and must NOT be "fixed".** Physics capsules are
  used as-authored (unlike weapon rotations, which the game symmetrizes at runtime),
  so genuinely asymmetric left/right hitboxes — e.g. Garuda's leg capsules, whose
  `PHYS_*_ChassisLegL` / `LegR` assets have different radii, lengths and centers —
  are faithful and should be left alone. Confirm against the raw `PHYS_*` first.

## Known limitations

- Runtime mount rotations (and rare per-slot corrections) are compiled into the
  game, not serialized — hence the constant tables in mechanisms 4 and 8.

## After a fix

`npx tsc --noEmit` + `npm run build` + `npm run vitest` (tests/robot checks
placement and areas against the real data), then verify the affected preset(s) on
`/models`. Add new one-off corrections to the config tables in
`src/utils/constants.ts`
(with a comment on the in-game evidence), never as inline magic numbers in the
compute code.
