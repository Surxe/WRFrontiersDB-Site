/**
 * `Objects/MovementType.json` (WRFrontiersDB-Data `current/`): a movement
 * type and its speed tiers (`movement_properties`). Every tier field is
 * parsed and checked here, so a patch that renames or drops one fails at
 * load instead of silently driving the simulation with a default.
 *
 * Cooked assets store only the properties that differ from their struct's
 * default, so a field can be missing from one movement type and present in
 * another (FourLegs has no VelocityMultiplierOnWallAngleHit). Missing means
 * "the struct's default", whose value is in the game's code, not the data.
 * Fields the simulation applies are required and fail loudly; the rest are
 * null when not exported.
 *
 * Curves are keyed by speed (cm/s) or angle (degrees) as the field names
 * say; what each field means to the game is a reverse-engineering question
 * (the brief's steps 2 to 4), not answered here.
 */
import { parseRichCurve, type RichCurve } from './rich_curve';

/** One entry of `movement_properties`. */
export interface MovementTier {
  accelerationDependenceOnSpeed: RichCurve;
  accelerationDependenceOnPitch: RichCurve | null;
  brakingDecelerationDependenceOnSpeed: RichCurve;
  emergencyDecelerationDependenceOnInputOpposition: RichCurve | null;
  yawRateDependenceOnSpeed: RichCurve | null;
  maxSpeedDependenceOnDesiredYaw: RichCurve | null;
  fallingAcceleration: number | null;
  fallingBrakingDeceleration: number;
  fallingBrakingVelocityThreshold: number | null;
  frictionVector: { x: number; y: number };
  frictionVelocityCompensationMultiplier: number | null;
  maxAngleToMoveForwards: number | null;
  maxAngleToMoveForwardsFalling: number | null;
  maxFallingSpeed: number;
  meshRotationStiffnessDamping: { x: number; y: number } | null;
  movingForcedTurnRate: number | null;
  movingForcedTurnVelocityMaxSpeedRatio: number | null;
  movingForcedTurnVelocityThreshold: number | null;
  standingRotationAngleDegrees: number | null;
  standingRotationThreshold: number | null;
  standingVelocityThreshold: number | null;
  /** Keyed by speed (cm/s), each a curve over the hit angle (degrees). */
  velocityMultiplierOnWallAngleHit:
    | readonly { speed: number; curve: RichCurve }[]
    | null;
}

export interface MovementType {
  id: string;
  chassisType: string | null;
  maxMobility: number | null;
  tiers: readonly MovementTier[];
}

type Raw = Record<string, unknown>;

function num(raw: Raw, field: string, where: string): number {
  const value = raw[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${where}: ${field} missing or not a number`);
  }
  return value;
}

function xy(raw: Raw, field: string, where: string): { x: number; y: number } {
  const value = raw[field] as Raw | undefined;
  if (!value || typeof value !== 'object') {
    throw new Error(`${where}: ${field} missing`);
  }
  return {
    x: num(value, 'X', `${where}.${field}`),
    y: num(value, 'Y', `${where}.${field}`),
  };
}

const curve = (raw: Raw, field: string, where: string): RichCurve =>
  parseRichCurve(raw[field], `${where}.${field}`);

/** An optional field: null when not exported (the struct's default). */
function optional<T>(
  raw: Raw,
  field: string,
  parse: (raw: Raw, field: string, where: string) => T,
  where: string
): T | null {
  return raw[field] === undefined || raw[field] === null
    ? null
    : parse(raw, field, where);
}

function wallHitCurves(
  raw: Raw,
  field: string,
  where: string
): { speed: number; curve: RichCurve }[] {
  const entries = raw[field];
  if (!Array.isArray(entries))
    throw new Error(`${where}: ${field} is not a list`);
  return entries.map((entry: Raw, index) => {
    const speed = Number(entry.Key);
    if (!Number.isFinite(speed)) {
      throw new Error(`${where}: ${field}[${index}] key ${String(entry.Key)}`);
    }
    return {
      speed,
      curve: parseRichCurve(entry.Value, `${where}.${field}[${speed}]`),
    };
  });
}

function parseTier(raw: Raw, where: string): MovementTier {
  const opt = <T>(
    field: string,
    parse: (raw: Raw, field: string, where: string) => T
  ): T | null => optional(raw, field, parse, where);
  return {
    // Applied by the simulation: required.
    accelerationDependenceOnSpeed: curve(
      raw,
      'AccelerationDependenceOnSpeed',
      where
    ),
    brakingDecelerationDependenceOnSpeed: curve(
      raw,
      'BrakingDecelerationDependenceOnSpeed',
      where
    ),
    fallingBrakingDeceleration: num(raw, 'FallingBrakingDeceleration', where),
    frictionVector: xy(raw, 'FrictionVector', where),
    maxFallingSpeed: num(raw, 'MaxFallingSpeed', where),
    // Not applied yet: null when not exported.
    accelerationDependenceOnPitch: opt('AccelerationDependenceOnPitch', curve),
    emergencyDecelerationDependenceOnInputOpposition: opt(
      'EmergencyDecelerationDependenceOnInputOpposition',
      curve
    ),
    yawRateDependenceOnSpeed: opt('YawRateDependenceOnSpeed', curve),
    maxSpeedDependenceOnDesiredYaw: opt(
      'MaxSpeedDependenceOnDesiredYaw',
      curve
    ),
    fallingAcceleration: opt('FallingAcceleration', num),
    fallingBrakingVelocityThreshold: opt(
      'FallingBrakingVelocityThreshold',
      num
    ),
    frictionVelocityCompensationMultiplier: opt(
      'FrictionVelocityCompensationMultiplier',
      num
    ),
    maxAngleToMoveForwards: opt('MaxAngleToMoveForwards', num),
    maxAngleToMoveForwardsFalling: opt('MaxAngleToMoveForwardsFalling', num),
    meshRotationStiffnessDamping: opt('MeshRotationStiffnessDamping', xy),
    movingForcedTurnRate: opt('MovingForcedTurnRate', num),
    movingForcedTurnVelocityMaxSpeedRatio: opt(
      'MovingForcedTurnVelocityMaxSpeedRatio',
      num
    ),
    movingForcedTurnVelocityThreshold: opt(
      'MovingForcedTurnVelocityThreshold',
      num
    ),
    standingRotationAngleDegrees: opt('StandingRotationAngleDegrees', num),
    standingRotationThreshold: opt('StandingRotationThreshold', num),
    standingVelocityThreshold: opt('StandingVelocityThreshold', num),
    velocityMultiplierOnWallAngleHit: opt(
      'VelocityMultiplierOnWallAngleHit',
      wallHitCurves
    ),
  };
}

/** The movement type `id` from the parsed `MovementType.json` table. */
export function parseMovementType(
  table: Readonly<Record<string, unknown>>,
  id: string
): MovementType {
  const raw = table[id] as Raw | undefined;
  if (!raw) throw new Error(`MovementType ${id}: not in MovementType.json`);
  const tiers = raw.movement_properties;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error(`MovementType ${id}: no movement_properties`);
  }
  return {
    id,
    chassisType: typeof raw.chassis_type === 'string' ? raw.chassis_type : null,
    maxMobility: optional(raw, 'max_mobility', num, `MovementType ${id}`),
    tiers: tiers.map((tier: Raw, index) =>
      parseTier(tier, `MovementType ${id} tier ${index}`)
    ),
  };
}
