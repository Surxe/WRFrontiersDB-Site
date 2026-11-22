/**
 * A chassis module from `Objects/CharacterModule.json`: which movement type
 * it uses and its default scalars (`module_scaler.default_scalars`).
 */

export interface Chassis {
  id: string;
  /** The movement type id, e.g. `DA_MovementType_TwoLegs_Agile.6`. */
  movementTypeId: string;
  /** `module_scaler.default_scalars`, e.g. MaxSpeed, FuelCapacity. */
  scalars: Readonly<Record<string, number>>;
}

const MOVEMENT_TYPE_PREFIX = 'OBJID_MovementType::';

/** The chassis module `id` from the parsed `CharacterModule.json` table. */
export function parseChassis(
  table: Readonly<Record<string, unknown>>,
  id: string
): Chassis {
  const raw = table[id] as
    | {
        movement_type_ref?: unknown;
        module_scaler?: { default_scalars?: Record<string, unknown> };
      }
    | undefined;
  if (!raw) throw new Error(`Chassis ${id}: not in CharacterModule.json`);
  const ref = raw.movement_type_ref;
  if (typeof ref !== 'string' || !ref.startsWith(MOVEMENT_TYPE_PREFIX)) {
    throw new Error(`Chassis ${id}: no movement_type_ref`);
  }
  const scalars: Record<string, number> = {};
  for (const [name, value] of Object.entries(
    raw.module_scaler?.default_scalars ?? {}
  )) {
    if (typeof value === 'number') scalars[name] = value;
  }
  return {
    id,
    movementTypeId: ref.slice(MOVEMENT_TYPE_PREFIX.length),
    scalars,
  };
}

/** A scalar the simulation needs; fails loudly when the chassis lacks it. */
export function requireScalar(chassis: Chassis, name: string): number {
  const value = chassis.scalars[name];
  if (value === undefined) {
    throw new Error(`Chassis ${chassis.id}: default_scalars.${name} missing`);
  }
  return value;
}
