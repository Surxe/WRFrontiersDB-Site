/**
 * Constants for WRFrontiersDB-Site
 * Contains object references and other constant values used throughout the application
 */
import type { AdapterMountWay, Rotator } from '../types/model';

// Pilot type references
export const PILOT_TYPE_LEGENDARY_REF =
  'OBJID_PilotType::DA_PilotType_Legendary.0';

// Template limits
export const PILOT_TALENT_TEMPLATE_LIMIT = 5;

// Core module category IDs
export const CORE_MODULE_CATEGORIES = [
  'DA_ModuleCategory_Chassis.0',
  'DA_ModuleCategory_Torso.0',
  'DA_ModuleCategory_Shoulder.0',
] as const;

// ---------------------------------------------------------------------------
// Robot builds and 3D models (src/scripts/robot, the /models page)
// ---------------------------------------------------------------------------

/** ModuleCategory id of each broad module kind a build distinguishes. */
export const MODULE_CATEGORY_IDS = {
  chassis: 'DA_ModuleCategory_Chassis.0',
  torso: 'DA_ModuleCategory_Torso.0',
  shoulder: 'DA_ModuleCategory_Shoulder.0',
  weapon: 'DA_ModuleCategory_Weapon.0',
  ability: 'DA_ModuleCategory_Ability.0',
} as const;

/** Chassis armor zones (health pools). The chassis splits into the pelvis
 * and one pool per leg side (a spider's two left legs share one). */
export const ARMOR_ZONE_PELVIS = 'DA_ArmorZone_Pelvis.0';
export const ARMOR_ZONE_LEFT_LEG = 'DA_ArmorZone_LeftLeg.0';
export const ARMOR_ZONE_RIGHT_LEG = 'DA_ArmorZone_RightLeg.0';

/** `socket_name` of the chassis entry in a preset's module list. */
export const CHASSIS_SOCKET = 'None';
/** Chassis socket the torso mounts into. */
export const TORSO_SOCKET = 'Root';
/** Chassis bone the torso actually attaches to: the `Root` socket names the
 * chassis origin bone, which would sink the whole upper body (see
 * docs/weapon_mount_findings.md). */
export const TORSO_MOUNT_BONE = 'Torso';
/** Socket name suffixes of per-side mounts (`Shoulder_L` / `Shoulder_R`). */
export const LEFT_SOCKET_SUFFIX = '_L';
export const RIGHT_SOCKET_SUFFIX = '_R';

/**
 * Runtime mount rotation of a weapon, by the adapter mount way it uses. The
 * game applies this at runtime and does not serialize it (see
 * docs/weapon_mount_findings.md). Mirrored LIGHT weapons (Left/Right adapters)
 * sit on the hardpoint bone rolled about the weapon's long axis (-90 right /
 * +90 left); single TITAN weapons (Standard adapter only) mount centered.
 */
export const WEAPON_MOUNT_ROTATION: Readonly<Record<AdapterMountWay, Rotator>> =
  {
    Left: [0, 0, 90],
    Right: [0, 0, -90],
    Standard: [0, 0, 0],
  };

/**
 * A few bots have a weapon whose shoulder hardpoint bone carries a rotation the
 * game corrects at runtime but the export does not, so the weapon ends up
 * oriented inconsistently with its siblings. A sagittal mirror of the other
 * shoulder only negates yaw (Z), not roll (X), so it can't express these
 * uniformly; instead the weapon's final world ROTATION is overridden (position
 * kept). Values are FRotators in robot space, verified in-view. Keyed by
 * `${parentShoulderModelId}|${weaponSocket}`.
 */
export const WEAPON_ROTATION_OVERRIDES: Readonly<Record<string, Rotator>> = {
  'BP_Module_Garuda_ShoulderL.0|Shoulder_Weapon_1': [0, 0, 90],
  'BP_Module_Norna_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
  'BP_Module_Spire_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
};
