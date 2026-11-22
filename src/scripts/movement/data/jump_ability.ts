/**
 * The chassis's Jump Jet (`USJetpackAbility`) entry in `Objects/Ability.json`,
 * for the air-control values its setup writes into the movement component
 * (`0x145325ef0`: when `bOverrideAirControl`, it copies `AirControl`,
 * `AirControlBoostMultiplier` and `AirControlBoostVelocityThreshold` to the
 * CMC once, so they apply to all falling; findings step 5). The rest of the
 * entry (thrust, fuel) is MVP session 4's.
 *
 * The chassis lists its abilities in `CharacterModule.json`
 * `abilities_refs`; the Jump Jet is the one with `JumpTime`, a
 * `USJetpackAbility` member (the dash has `Actions` instead).
 */

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
