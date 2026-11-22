/**
 * A chassis's per-level movement stats, `Mobility` and `MaxSpeed`, from
 * `Objects/Module.json`: the module that mounts the chassis
 * (`character_module_mounts`), `module_scalars.levels.variables[Level - 1]`.
 * Outside the level table the scaler's `default_scalars` apply, where no
 * chassis has a `Mobility` (so 0). The game's lookup order is in the
 * reverse-engineering findings, step 2.
 */

export interface ChassisLevel {
  /** The module that mounts the chassis, e.g. `DA_Module_ChassisLoki.2`. */
  moduleId: string;
  level: number;
  /** The highest level in the module's table. */
  maxLevel: number;
  mobility: number;
  /** cm/s. */
  maxSpeed: number;
  /** The chassis's `FuelCapacity` at this level (`SModuleChassis::
   * GetFuelCapacity`: the level, else the scaler's default); null when
   * neither has one. Not applied: the fuel maximum is BP_Character's
   * (D21) until firing-range F1. */
  fuelCapacity: number | null;
  /** Where the numbers came from. */
  source: 'levels' | 'default_scalars';
}

type Raw = Record<string, unknown>;

const CHARACTER_MODULE_PREFIX = 'OBJID_CharacterModule::';

/** The module in the parsed `Module.json` table that mounts `chassisId`. */
function findMountingModule(
  table: Readonly<Record<string, unknown>>,
  chassisId: string
): [string, Raw] {
  const ref = `${CHARACTER_MODULE_PREFIX}${chassisId}`;
  for (const [id, raw] of Object.entries(table)) {
    const mounts = (raw as Raw).character_module_mounts;
    if (
      Array.isArray(mounts) &&
      mounts.some((m: Raw) => m.character_module_ref === ref)
    ) {
      return [id, raw as Raw];
    }
  }
  throw new Error(`Module.json: no module mounts ${chassisId}`);
}

/** `chassisId`'s stats at `level` (null: its highest level). */
export function parseChassisLevel(
  table: Readonly<Record<string, unknown>>,
  chassisId: string,
  level: number | null
): ChassisLevel {
  const [moduleId, raw] = findMountingModule(table, chassisId);
  const scalars = raw.module_scalars as Raw | undefined;
  const levels = (scalars?.levels as Raw | undefined)?.variables;
  const levelTable = Array.isArray(levels) ? (levels as Raw[]) : [];
  const maxLevel = levelTable.length;
  const at = level ?? maxLevel;
  const entry = levelTable[at - 1];
  const defaults = (scalars?.default_scalars ?? {}) as Raw;
  const source = entry ? 'levels' : 'default_scalars';
  const from = entry ?? defaults;
  const maxSpeed = from.MaxSpeed;
  if (typeof maxSpeed !== 'number') {
    throw new Error(`${moduleId}: no MaxSpeed at level ${at} (${source})`);
  }
  const mobility = typeof from.Mobility === 'number' ? from.Mobility : 0;
  const capacity = from.FuelCapacity ?? defaults.FuelCapacity;
  const fuelCapacity = typeof capacity === 'number' ? capacity : null;
  return {
    moduleId,
    level: at,
    maxLevel,
    mobility,
    maxSpeed,
    fuelCapacity,
    source,
  };
}
