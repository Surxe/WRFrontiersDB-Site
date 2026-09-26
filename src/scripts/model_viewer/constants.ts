/**
 * Runtime mount corrections and render constants.
 *
 * The mount tables encode corrections the game applies at runtime but the export
 * does not serialize (see the WRFrontiersDB-Models repo, docs/weapon_mount_findings.md).
 */
import type { Vec3 } from './types';

/** Runtime mount correction applied to a mounted weapon, keyed by socket type
 * ("Weapon" / "WeaponHeavy") then mount way ("Left" / "Right" / "Standard").
 * The game applies this at runtime and does not serialize it. Mirrored LIGHT
 * weapons (Left/Right adapters) sit on the hardpoint bone with a roll about the
 * weapon long axis (-90 right / +90 left mirror); single TITAN weapons (Standard
 * adapter only) mount centered and are dialled in under "Standard". */
export interface MountConv {
  pitch_deg?: number;
  yaw_deg?: number;
  roll_deg?: number;
  offset?: Vec3;
}

export const MOUNT_ORIENTATION: Record<string, Record<string, MountConv>> = {
  Weapon: {
    Right: { roll_deg: -90 },
    Left: { roll_deg: 90 },
    Standard: { roll_deg: 0, offset: [0, 0, 0] },
  },
  WeaponHeavy: {
    Right: { roll_deg: -90 },
    Left: { roll_deg: 90 },
    Standard: { roll_deg: 0, offset: [0, 0, 0] },
  },
};

/** Only the Standard adapter offset belongs to the weapon root (titan/centered);
 * Left/Right offsets belong to the unrendered adapter mesh. */
export const APPLY_ADAPTER_OFFSET = true;

/** A few bots have a weapon whose shoulder hardpoint bone carries a rotation the
 * game corrects at runtime but the export does not -- the weapon ends up oriented
 * inconsistently with its siblings. A sagittal mirror of the other shoulder only
 * negates yaw (Z), not roll (X), so it can't express these uniformly; instead we
 * override the weapon's final world ROTATION (position kept). Values are FRotator
 * [pitch, yaw, roll] in robot space, verified in-view. Keyed by
 * `${parentShoulderModelId}|${weaponSocket}`. */
export const WEAPON_ROTATION_OVERRIDE: Record<string, Vec3> = {
  'BP_Module_Garuda_ShoulderL.0|Shoulder_Weapon_1': [0, 0, 90],
  'BP_Module_Norna_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
  'BP_Module_Spire_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
};

/** Per-module base colors cycled across the loaded models in a build. */
export const MODEL_COLORS = [
  0x9aa0a6, 0x4c8fd6, 0xd68a3c, 0x8a6bd6, 0x4cb08a, 0xd64c6b,
];
