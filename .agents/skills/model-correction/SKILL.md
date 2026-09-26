---
name: model-correction
description: Diagnose and fix a WRFrontiers robot model that renders wrong on the /models page (weapon/shoulder position or rotation, oversized hitboxes, stray geometry). Use when a bot's composed model looks incorrect in the live viewer, or when validating a newly-parsed model. The composition lives in src/scripts/model_viewer/.
---

# Correcting WRFrontiers robot models

The `/models` page composes per-module data into a full robot **live in the
browser**. The logic is `src/scripts/model_viewer/`:

- `mount.ts` — mount resolution (`computeModuleWorlds` + socket/adapter helpers).
- `constants.ts` — the runtime correction tables (`MOUNT_ORIENTATION`,
  `WEAPON_ROTATION_OVERRIDE`, `APPLY_ADAPTER_OFFSET`).
- `scene.ts` — three.js geometry construction (meshes, hitbox primitives, skeleton).
- `math.ts` — 4x4 matrix + UE FRotator/quaternion math.
- `mesh.ts` — FX-mesh classification and component-space AABB.

A source edit only takes effect in the browser after a rebuild; use the dev
server (`npm run dev`, or the `run-dev-server` skill) to see changes on `/models`.

Ground-truth reference (a hand-built, in-game-correct Typhon): read-only at
`/mnt/.windows-c/os-shared/dev/wrf-model-analysis/` (`assemble_typhon.py`,
`typhon_full_assembly.obj`). Background: `docs/weapon_mount_findings.md`.

## Data locations

- Parsed models: `/srv/dev/repos/WRFrontiersDB-Data/current/`
  (`Objects/*.json`, `Models/<CharacterModuleId>.json`).
- Site's copy: `public/data/` (synced via `npm run sync:models`; `build` runs it).
  Confirm it matches `current/` before blaming the code.
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

1. `npm run dev`, open `/models`, pick the affected bot preset + shoulder (and
   toggle hitbox/skeleton as needed). Presets live in `Objects/CharacterPreset.json`;
   weapon display names differ from ids (e.g. "Magneto" = StickyGun) — resolve via
   `Module.json` `name.Key`.
2. Get directional feedback from the user against the ground-truth reference.
3. Make the change in the relevant `model_viewer/` module, verify numerically
   (below), and reload.

## Verifying numerically (Node)

The pure math is already isolated: `computeModuleWorlds` is exported from
`mount.ts`, `refToId` from `src/utils/object_reference`, and `init()` (the DOM
entry) lives only in `index.ts` — so a `tsx` script can import `mount.ts`
directly with **no scaffolding edits**. Load the same `Objects/*.json` +
`Models/*.json`, run `computeModuleWorlds`, and print per-module world Z / euler
to check placement.

Euler extraction (matches `eulerMat` = Rz(yaw)Ry(pitch)Rx(roll)):
`x=atan2(m[2][1],m[2][2]) (roll), y=atan2(-m[2][0],sy) (pitch), z=atan2(m[1][0],m[0][0]) (yaw)`.

`npx tsc --noEmit` must stay clean; also run `npm run build`.

## Correction mechanisms (symptom -> cause -> where)

1. **Whole upper body sunk / torso at wrong height** -> the "Root" preset socket
   is the chassis origin bone; the real attach is the chassis `Torso` bone.
   `socketFrame` remaps `'Root' -> 'Torso'` (`mount.ts`).

2. **Shoulders lifted ~2x, weapons ~3x (baked-root skeletons)** -> some skeletons
   bake the mount height into the root bone while the mesh stays root-relative, so
   the full bone world double-counts down the chain. `mountBoneFrame` picks the
   full vs root-identity bone world whose position lands INSIDE the parent mesh
   AABB (`meshAabb`, `dist2ToBox`). No-op when the root isn't baked. Hitbox
   placement uses `boneWorlds(bones, true)` in `scene.ts`.

3. **Left shoulder renders the right mesh (or vice versa)** -> per-side shoulders
   are one module id with separate Left/Right BPs. `computeModuleWorlds` derives
   the side from the `socket_name` suffix and passes it to `modelIdForModule` so
   the correct-side BP is resolved.

4. **Weapon orientation wrong / mirrored** -> runtime mount rotation, not in any
   asset. `MOUNT_ORIENTATION[socketType][mountWay]` (light `Weapon` / `WeaponHeavy`;
   `Left` roll +90 / `Right` -90 / `Standard` for titan-centered). Mount way comes
   from the parent shoulder side + the weapon's adapter set (`adapterMountWay`:
   Left/Right adapters = mirrored light; Standard-only = titan; plus `weaponMountSide`).

5. **Weapon floats off its mount / adapter gap** -> the adapter socket offset
   positions the (unrendered) adapter mesh, NOT the weapon root, for Left/Right
   adapters. Only the `Standard` adapter offset is applied to weapon placement
   (`APPLY_ADAPTER_OFFSET`, gated to Standard). Adapters carry NO rotation — never
   expect them to fix orientation.

6. **Hitbox boxes ~2x too big** -> UE `FKBoxElem` X/Y/Z are FULL dimensions;
   `buildBoxGeometry` passes them straight to `THREE.BoxGeometry` (which wants full
   w/h/d). Capsules use radius+length and are unaffected.

7. **Stray cone/plane geometry off the body** -> a cosmetic FX/effect skeletal
   mesh component (`SK_*_Effect` / `*_FX`) rendered as solid. Filtered by `isFxMesh`
   in `scene.ts` (`addModel`) AND `meshAabb` (`mesh.ts`). Data keeps the FX asset;
   this is a render-side filter.

8. **One weapon oriented inconsistently with its siblings** -> that hardpoint bone
   carries a rotation the game corrects at runtime but the export omits. It is NOT
   fixable by mirroring the other shoulder (a sagittal mirror negates yaw/Z but
   PRESERVES roll/X, so roll anomalies can't be expressed as a mirror). Override
   the weapon's final world rotation, keeping its position:
   `WEAPON_ROTATION_OVERRIDE['${parentShoulderModelId}|${socket}'] = [pitch, yaw, roll]`
   (`withWorldRotation`; `constants.ts`). Set the value from the in-game view.

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

`npx tsc --noEmit` + `npm run build`, then verify the affected preset(s) on
`/models`. Add new one-off corrections to the config tables in `constants.ts`
(with a comment on the in-game evidence), never as inline magic numbers in the
compute code.
