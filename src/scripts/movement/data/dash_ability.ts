/**
 * The chassis's Dash Thrusters (`USDashAbility`, findings step 6) entry in
 * `Objects/Ability.json`: the ability's values and its merged actions.
 *
 * - The chassis lists its abilities in `CharacterModule.json`
 *   `abilities_refs`; the dash is the one with `Actions` (the Jump Jet has
 *   `JumpTime`).
 * - The actions are already merged over `BP_Ability_DashDefault`'s by the
 *   Parser (PR #138). A field still absent is the `USDashAction`
 *   constructor's value: every field 0 / false (`0x1450c9be0`).
 * - An absent ability field is the C++ constructor's value:
 *   `USDashAbility` (`0x1452cdc80`) for the dash's own, `USAbility`
 *   (`0x1452cd2f0`) for the base's. `BP_Ability_DashDefault` sets none of
 *   them except `InitialDuration` (1.6) and `Cooldown` (8), which every
 *   chassis overrides; both are required here.
 * - Base-ability features the dash does not use in the data (a cast time,
 *   ramp-up or ramp-down, charges, an initial cooldown, cancelling while
 *   active, activation on grant, a cooldown policy other than "on
 *   activation") fail loudly: they are not ported (MVP session 5).
 */

const ABILITY_PREFIX = 'OBJID_Ability::';

type Raw = Record<string, unknown>;

/** A plain vector (data/ imports nothing else from movement/). */
export interface DataVector {
  x: number;
  y: number;
  z: number;
}

/** `USSimpleFloatChannelModifier` on the movement component's
 * `MaxSpeedChannel`. Only `Add` is in the data (all 38 chassis). */
export interface FloatChannelModifier {
  value: number;
  type: 'Add';
}

/** One `USDashAction` (findings step 6, fields `+0x38` to `+0x84`). */
export interface DashAction {
  index: number;
  canStartOnGround: boolean;
  canStartMidair: boolean;
  /** s after the dash starts. */
  startDelay: number;
  hasDuration: boolean;
  /** s after the start delay and any wait for MinSpeedToStartAction. */
  duration: number;
  blocksAirControl: boolean;
  /** Added to the velocity at start, in the dash direction's frame, cm/s. */
  startImpulse: DataVector;
  /** cm/s^2 upwards while running. */
  verticalAcceleration: number;
  /** cm/s^2 along the dash direction while running. */
  requestedDirectionAcceleration: number;
  hasVelocityThreshold: boolean;
  /** cm/s, horizontal speed along the dash direction. */
  velocityThreshold: number;
  maxSpeedModifier: FloatChannelModifier | null;
  playVisualFX: boolean;
  /** cm/s; 0: no minimum. */
  minSpeedToStartAction: number;
}

export interface DashData {
  /** The ability entry's id, for labels. */
  id: string;
  usageFuelCost: number;
  fuelConsumptionDuration: number;
  minInterruptionAngle: number;
  minimumDuration: number;
  lateralFrictionMultiplier: number;
  /** The active state's length, s (`USAbility::InitialDuration`). */
  initialDuration: number;
  /** s, started when the dash activates (CooldownPolicy 0). */
  cooldown: number;
  actions: DashAction[];
  /** Ability fields absent from the entry, from the C++ constructors. */
  defaulted: string[];
}

/** `USDashAbility` constructor (`0x1452cdc80`, findings step 6). */
export const DASH_CPP_DEFAULTS = {
  LateralFrictionMultiplier: 100,
  UsageFuelCost: 2,
  FuelConsumptionDuration: 0.6,
  MinInterruptionAngle: 180,
  MinimumDuration: 0.2,
} as const;

/** `USAbility` fields that would change the state machine the dash runs
 * on; the constructor (`0x1452cd2f0`) sets each to the value listed, and
 * only that value is ported. */
const BASE_ABILITY_FIXED: Readonly<Record<string, unknown>> = {
  CastDuration: 0,
  RampUpDuration: 0,
  RampDownDuration: 0,
  MaxCharges: 0,
  InitialCooldown: 0,
  bCanBeCanceledWhileActive: false,
  ActivateAbilityOnGranted: false,
  DashDuration: 0,
};

/** Ability-level fields with no movement effect. */
const IGNORED_FIELDS = new Set(['EffectType', 'bAllowStatsReporting']);

const ACTION_FIELDS = new Set([
  'CanStartOnGround',
  'CanStartMidair',
  'StartDelay',
  'bHasDuration',
  'Duration',
  'bBlocksAirControl',
  'StartImpulse',
  'VerticalAcceleration',
  'RequestedDirectionAcceleration',
  'bHasVelocityThreshold',
  'VelocityThreshold',
  'MaxSpeedModifier',
  'bPlayVisualFX',
  'MinSpeedToStartAction',
]);

/** The dash entry of chassis `chassisId`; fails loudly when there is none,
 * or more than one. */
export function findDashEntry(
  abilities: Readonly<Record<string, unknown>>,
  characterModules: Readonly<Record<string, unknown>>,
  chassisId: string
): { id: string; entry: Raw; misc: Raw } {
  const chassis = characterModules[chassisId] as Raw | undefined;
  if (!chassis)
    throw new Error(`Chassis ${chassisId}: not in CharacterModule.json`);
  const refs = chassis.abilities_refs;
  if (!Array.isArray(refs))
    throw new Error(`Chassis ${chassisId}: no abilities_refs`);
  const found: { id: string; entry: Raw; misc: Raw }[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.startsWith(ABILITY_PREFIX)) continue;
    const id = ref.slice(ABILITY_PREFIX.length);
    const entry = abilities[id] as Raw | undefined;
    if (!entry)
      throw new Error(`Chassis ${chassisId}: ${id} not in Ability.json`);
    const misc = entry.misc as Raw | undefined;
    if (misc && typeof misc === 'object' && 'Actions' in misc)
      found.push({ id, entry, misc });
  }
  if (found.length !== 1)
    throw new Error(
      `Chassis ${chassisId}: ${found.length} dash entries (abilities with Actions), expected 1`
    );
  return found[0];
}

function parseAction(raw: unknown, index: number, label: string): DashAction {
  if (!raw || typeof raw !== 'object')
    throw new Error(`${label}: not an object`);
  const a = raw as Raw;
  for (const key of Object.keys(a))
    if (!ACTION_FIELDS.has(key))
      throw new Error(`${label}.${key}: unknown USDashAction field`);
  const num = (field: string): number => {
    const value = a[field];
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`${label}.${field}: not a number`);
    return value;
  };
  const bool = (field: string): boolean => {
    const value = a[field];
    if (value === undefined) return false;
    if (typeof value !== 'boolean')
      throw new Error(`${label}.${field}: not a boolean`);
    return value;
  };
  let startImpulse: DataVector = { x: 0, y: 0, z: 0 };
  if (a.StartImpulse !== undefined) {
    const v = a.StartImpulse as Raw;
    const axis = (k: 'X' | 'Y' | 'Z'): number => {
      const value = v?.[k];
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new Error(`${label}.StartImpulse.${k}: missing or not a number`);
      return value;
    };
    startImpulse = { x: axis('X'), y: axis('Y'), z: axis('Z') };
  }
  let maxSpeedModifier: FloatChannelModifier | null = null;
  if (a.MaxSpeedModifier !== undefined && a.MaxSpeedModifier !== null) {
    const m = a.MaxSpeedModifier as Raw;
    if (typeof m.Value !== 'number' || !Number.isFinite(m.Value))
      throw new Error(`${label}.MaxSpeedModifier.Value: not a number`);
    if (m.Type !== 'Add')
      throw new Error(
        `${label}.MaxSpeedModifier.Type: ${String(m.Type)} is not ported (only Add)`
      );
    maxSpeedModifier = { value: m.Value, type: 'Add' };
  }
  return {
    index,
    canStartOnGround: bool('CanStartOnGround'),
    canStartMidair: bool('CanStartMidair'),
    startDelay: num('StartDelay'),
    hasDuration: bool('bHasDuration'),
    duration: num('Duration'),
    blocksAirControl: bool('bBlocksAirControl'),
    startImpulse,
    verticalAcceleration: num('VerticalAcceleration'),
    requestedDirectionAcceleration: num('RequestedDirectionAcceleration'),
    hasVelocityThreshold: bool('bHasVelocityThreshold'),
    velocityThreshold: num('VelocityThreshold'),
    maxSpeedModifier,
    playVisualFX: bool('bPlayVisualFX'),
    minSpeedToStartAction: num('MinSpeedToStartAction'),
  };
}

/** The chassis's Dash Thrusters: every value the ability runs on. */
export function parseDash(
  abilities: Readonly<Record<string, unknown>>,
  characterModules: Readonly<Record<string, unknown>>,
  chassisId: string
): DashData {
  const { id, entry, misc } = findDashEntry(
    abilities,
    characterModules,
    chassisId
  );
  const label = `Ability.json ${id}`;
  const defaulted: string[] = [];
  for (const key of Object.keys(misc)) {
    if (
      key === 'Actions' ||
      key === 'InitialDuration' ||
      key in DASH_CPP_DEFAULTS ||
      IGNORED_FIELDS.has(key)
    )
      continue;
    if (key in BASE_ABILITY_FIXED) {
      if (misc[key] !== BASE_ABILITY_FIXED[key])
        throw new Error(
          `${label}.misc.${key}: ${JSON.stringify(misc[key])} is not ported (only ${JSON.stringify(BASE_ABILITY_FIXED[key])})`
        );
      continue;
    }
    throw new Error(`${label}.misc.${key}: unknown dash field`);
  }
  const num = (field: keyof typeof DASH_CPP_DEFAULTS): number => {
    const value = misc[field];
    if (value === undefined) {
      defaulted.push(field);
      return DASH_CPP_DEFAULTS[field];
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`${label}.misc.${field}: not a number`);
    return value;
  };
  const initialDuration = misc.InitialDuration;
  if (typeof initialDuration !== 'number' || !Number.isFinite(initialDuration))
    throw new Error(`${label}.misc.InitialDuration: missing or not a number`);
  const rawCooldown = entry.cooldown as Raw | undefined;
  if (!rawCooldown || typeof rawCooldown.Cooldown !== 'number')
    throw new Error(`${label}.cooldown.Cooldown: missing or not a number`);
  for (const key of Object.keys(rawCooldown))
    if (key !== 'Cooldown')
      throw new Error(
        `${label}.cooldown.${key}: not ported (the C++ default CooldownPolicy 0, cooldown from activation, is)`
      );
  const rawActions = misc.Actions;
  if (!Array.isArray(rawActions) || rawActions.length === 0)
    throw new Error(`${label}.misc.Actions: missing or empty`);
  return {
    id,
    usageFuelCost: num('UsageFuelCost'),
    fuelConsumptionDuration: num('FuelConsumptionDuration'),
    minInterruptionAngle: num('MinInterruptionAngle'),
    minimumDuration: num('MinimumDuration'),
    lateralFrictionMultiplier: num('LateralFrictionMultiplier'),
    initialDuration,
    cooldown: rawCooldown.Cooldown,
    actions: rawActions.map((a, i) =>
      parseAction(a, i, `${label}.misc.Actions[${i}]`)
    ),
    defaulted,
  };
}
