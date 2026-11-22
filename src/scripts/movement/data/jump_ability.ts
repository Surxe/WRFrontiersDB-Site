/**
 * The chassis's Jump Jet (`USJetpackAbility`) entry in `Objects/Ability.json`
 * (findings step 5):
 * - the air-control values its setup writes into the movement component
 *   (`0x145325ef0`: when `bOverrideAirControl`, it copies `AirControl`,
 *   `AirControlBoostMultiplier` and `AirControlBoostVelocityThreshold` to the
 *   CMC once, so they apply to all falling);
 * - the jump and Fly values the ability runs on (`parseJetpack`).
 *
 * Cooked data omits a field that equals the C++ default, so an absent field
 * is the `USJetpackAbility` constructor's value (`0x14530da60`, findings step
 * 5), listed in `defaulted`. The 38 two-legged chassis carry every field.
 *
 * The chassis lists its abilities in `CharacterModule.json`
 * `abilities_refs`; the Jump Jet is the one with `JumpTime`, a
 * `USJetpackAbility` member (the dash has `Actions` instead).
 */

import { parseRichCurve, type RichCurve } from './rich_curve';

const ABILITY_PREFIX = 'OBJID_Ability::';

export interface JetpackAirControl {
  /** The ability entry's id, for labels. */
  id: string;
  /** False: the CMC keeps BP_Character's values. */
  overrideAirControl: boolean;
  airControl: number;
  airControlBoostMultiplier: number;
  airControlBoostVelocityThreshold: number;
}

type Raw = Record<string, unknown>;

/** The Jump Jet entry of chassis `chassisId`; fails loudly when there is
 * none, or more than one. */
export function findJetpackEntry(
  abilities: Readonly<Record<string, unknown>>,
  characterModules: Readonly<Record<string, unknown>>,
  chassisId: string
): { id: string; misc: Raw } {
  const chassis = characterModules[chassisId] as Raw | undefined;
  if (!chassis)
    throw new Error(`Chassis ${chassisId}: not in CharacterModule.json`);
  const refs = chassis.abilities_refs;
  if (!Array.isArray(refs))
    throw new Error(`Chassis ${chassisId}: no abilities_refs`);
  const found: { id: string; misc: Raw }[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.startsWith(ABILITY_PREFIX)) continue;
    const id = ref.slice(ABILITY_PREFIX.length);
    const entry = abilities[id] as Raw | undefined;
    if (!entry)
      throw new Error(`Chassis ${chassisId}: ${id} not in Ability.json`);
    const misc = entry.misc as Raw | undefined;
    if (misc && typeof misc === 'object' && 'JumpTime' in misc)
      found.push({ id, misc });
  }
  if (found.length !== 1)
    throw new Error(
      `Chassis ${chassisId}: ${found.length} Jump Jet entries (abilities with JumpTime), expected 1`
    );
  return found[0];
}

/** The air-control override of the chassis's Jump Jet. Every field it
 * copies is required when the override is on. */
export function parseJetpackAirControl(
  abilities: Readonly<Record<string, unknown>>,
  characterModules: Readonly<Record<string, unknown>>,
  chassisId: string
): JetpackAirControl {
  const { id, misc } = findJetpackEntry(abilities, characterModules, chassisId);
  const override = misc.bOverrideAirControl === true;
  const num = (field: string): number => {
    const value = misc[field];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(
        `Ability.json ${id}.misc.${field}: missing or not a number`
      );
    return value;
  };
  return override
    ? {
        id,
        overrideAirControl: true,
        airControl: num('AirControl'),
        airControlBoostMultiplier: num('AirControlBoostMultiplier'),
        airControlBoostVelocityThreshold: num(
          'AirControlBoostVelocityThreshold'
        ),
      }
    : {
        id,
        overrideAirControl: false,
        airControl: 0,
        airControlBoostMultiplier: 0,
        airControlBoostVelocityThreshold: 0,
      };
}

/** `USJetpackAbility` constructor defaults (`0x14530da80` to `0x14530db82`,
 * findings step 5), for fields the cooked entry omits. */
export const JETPACK_CPP_DEFAULTS = {
  JumpFuelCost: 5,
  FuelCostToStartAirborne: 0.3,
  JumpTime: 1.5,
  FuelUsagePerSecond: 1,
  JetpackMaxVerticalSpeed: 1000,
  JetpackStartVerticalImpulse: 300,
  JetpackJumpAccelerationForce: 100000,
  JumpMovementMode: 'MOVE_Flying',
} as const;

export interface JetpackData {
  /** The ability entry's id, for labels. */
  id: string;
  /** Paid once when a ground jump starts; also the minimum to start one. */
  jumpFuelCost: number;
  /** The minimum fuel to start Fly; not deducted. */
  fuelCostToStartAirborne: number;
  /** Length of the Jump phase, s. */
  jumpTime: number;
  /** Fly drain, fuel/s. */
  fuelUsagePerSecond: number;
  /** Fly thrust (UE force units) over vertical speed (cm/s); null: none,
   * and then neither state thrusts (`0x145310d00`). */
  verticalAccelerationForceCurve: RichCurve | null;
  jetpackMaxVerticalSpeed: number;
  /** The impulse on Jump entry (UE impulse units, divided by Mass). */
  jetpackStartVerticalImpulse: number;
  /** Jump thrust, UE force units (divided by Mass). */
  jetpackJumpAccelerationForce: number;
  /** The mode Jump entry sets. Only MOVE_Falling is ported (every
   * two-legged chassis). */
  jumpMovementMode: 'falling';
  /** The data's cooldown; not applied: jumping has no cooldown in game
   * (Ethan, D16). */
  cooldown: { seconds: number; policy: string } | null;
  airControl: JetpackAirControl;
  /** Fields absent from the entry, taken from the C++ constructor. */
  defaulted: string[];
}

/** The chassis's Jump Jet: every value its states run on. */
export function parseJetpack(
  abilities: Readonly<Record<string, unknown>>,
  characterModules: Readonly<Record<string, unknown>>,
  chassisId: string
): JetpackData {
  const { id, misc } = findJetpackEntry(abilities, characterModules, chassisId);
  const defaulted: string[] = [];
  const num = (field: keyof typeof JETPACK_CPP_DEFAULTS): number => {
    const value = misc[field];
    if (value === undefined) {
      defaulted.push(field);
      return JETPACK_CPP_DEFAULTS[field] as number;
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`Ability.json ${id}.misc.${field}: not a number`);
    return value;
  };
  const rawMode = misc.JumpMovementMode;
  if (rawMode === undefined) defaulted.push('JumpMovementMode');
  const mode = String(rawMode ?? JETPACK_CPP_DEFAULTS.JumpMovementMode);
  if (mode !== 'MOVE_Falling')
    throw new Error(
      `Ability.json ${id}.misc.JumpMovementMode: ${mode} is not ported (only MOVE_Falling)`
    );
  const rawCurve = misc.VerticalAccelerationForceCurve as
    | { FloatCurve?: unknown }
    | undefined;
  let curve: RichCurve | null = null;
  if (rawCurve === undefined) {
    defaulted.push('VerticalAccelerationForceCurve');
  } else {
    if (!rawCurve || typeof rawCurve !== 'object' || !rawCurve.FloatCurve)
      throw new Error(
        `Ability.json ${id}.misc.VerticalAccelerationForceCurve: no FloatCurve`
      );
    curve = parseRichCurve(
      { EditorCurveData: rawCurve.FloatCurve },
      `Ability.json ${id}.misc.VerticalAccelerationForceCurve`
    );
  }
  const entry = abilities[id] as Raw;
  const rawCooldown = entry.cooldown as Raw | undefined;
  const cooldown =
    rawCooldown && typeof rawCooldown.Cooldown === 'number'
      ? {
          seconds: rawCooldown.Cooldown,
          policy: String(rawCooldown.CooldownPolicy ?? ''),
        }
      : null;
  return {
    id,
    jumpFuelCost: num('JumpFuelCost'),
    fuelCostToStartAirborne: num('FuelCostToStartAirborne'),
    jumpTime: num('JumpTime'),
    fuelUsagePerSecond: num('FuelUsagePerSecond'),
    verticalAccelerationForceCurve: curve,
    jetpackMaxVerticalSpeed: num('JetpackMaxVerticalSpeed'),
    jetpackStartVerticalImpulse: num('JetpackStartVerticalImpulse'),
    jetpackJumpAccelerationForce: num('JetpackJumpAccelerationForce'),
    jumpMovementMode: 'falling',
    cooldown,
    airControl: parseJetpackAirControl(abilities, characterModules, chassisId),
    defaulted,
  };
}
