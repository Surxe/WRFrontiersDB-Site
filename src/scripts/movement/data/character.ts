/**
 * `Objects/Character.json`: the pawn Blueprint every game mode spawns
 * (`GameMode.json` `default_pawn_ref`, `BP_Character.0`), with its
 * CharacterMovementComponent's Blueprint defaults (`movement_component`,
 * game property names). Cooked data lists only what the Blueprint sets
 * away from the C++ defaults, so the fields the simulation applies are
 * required: a patch that drops or renames one fails loudly here rather
 * than silently falling back to an engine default.
 */

/** The pawn every `GameMode.json` entry links (findings step 1). */
export const DEFAULT_PAWN_ID = 'BP_Character.0';

/** The `movement_component` fields the engine layer applies. */
export interface CharacterMovementDefaults {
  /** The pawn's entry id, for labels. */
  id: string;
  GravityScale: number;
  MaxStepHeight: number;
  WalkableFloorZ: number;
  BrakingFrictionFactor: number;
  AirControl: number;
  AirControlBoostMultiplier: number;
  PerchRadiusThreshold: number;
  PerchAdditionalHeight: number;
  bMaintainHorizontalGroundVelocity: boolean;
  /** RotationRate.Yaw, deg/s (body rotation, findings step 3). */
  RotationRateYaw: number;
  bOrientRotationToMovement: boolean;
}

const NUMBERS = [
  'GravityScale',
  'MaxStepHeight',
  'WalkableFloorZ',
  'BrakingFrictionFactor',
  'AirControl',
  'AirControlBoostMultiplier',
  'PerchRadiusThreshold',
  'PerchAdditionalHeight',
] as const;

/** Read the pawn's movement-component defaults from `Character.json`. */
export function parseCharacterMovement(
  characters: Readonly<Record<string, unknown>>,
  id: string = DEFAULT_PAWN_ID
): CharacterMovementDefaults {
  const entry = characters[id] as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== 'object')
    throw new Error(`Character.json has no ${id}`);
  const raw = entry.movement_component as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object')
    throw new Error(`Character.json ${id}: no movement_component`);
  const out: Record<string, unknown> = { id };
  for (const name of NUMBERS) {
    const value = raw[name];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(
        `Character.json ${id}.movement_component.${name}: missing or not a number`
      );
    out[name] = value;
  }
  const maintain = raw.bMaintainHorizontalGroundVelocity;
  if (typeof maintain !== 'boolean')
    throw new Error(
      `Character.json ${id}.movement_component.bMaintainHorizontalGroundVelocity: missing or not a boolean`
    );
  out.bMaintainHorizontalGroundVelocity = maintain;
  const rate = raw.RotationRate as Record<string, unknown> | undefined;
  if (!rate || typeof rate.Yaw !== 'number' || !Number.isFinite(rate.Yaw))
    throw new Error(
      `Character.json ${id}.movement_component.RotationRate.Yaw: missing or not a number`
    );
  out.RotationRateYaw = rate.Yaw;
  const orient = raw.bOrientRotationToMovement;
  if (typeof orient !== 'boolean')
    throw new Error(
      `Character.json ${id}.movement_component.bOrientRotationToMovement: missing or not a boolean`
    );
  out.bOrientRotationToMovement = orient;
  return out as unknown as CharacterMovementDefaults;
}

/** `gameplay_resources[Type = Fuel]` (`FSGameplayResource`, findings
 * step 5): the fuel maximum and flat regeneration BP_Character sets. */
export interface FuelResourceDefaults {
  id: string;
  MaxValue: number;
  RegenPerSecond: number;
}

/** Read the pawn's fuel resource from `Character.json`. */
export function parseFuelResource(
  characters: Readonly<Record<string, unknown>>,
  id: string = DEFAULT_PAWN_ID
): FuelResourceDefaults {
  const entry = characters[id] as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== 'object')
    throw new Error(`Character.json has no ${id}`);
  const list = entry.gameplay_resources;
  if (!Array.isArray(list))
    throw new Error(`Character.json ${id}: no gameplay_resources`);
  const fuel = (list as Record<string, unknown>[]).filter(
    (r) => r.Type === 'Fuel'
  );
  if (fuel.length !== 1)
    throw new Error(
      `Character.json ${id}.gameplay_resources: ${fuel.length} Fuel entries, expected 1`
    );
  const out: Record<string, unknown> = { id };
  for (const name of ['MaxValue', 'RegenPerSecond'] as const) {
    const value = fuel[0][name];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(
        `Character.json ${id}.gameplay_resources[Fuel].${name}: missing or not a number`
      );
    out[name] = value;
  }
  return out as unknown as FuelResourceDefaults;
}
