/**
 * Health pools: which hitboxes of a placed build take damage together.
 *
 * The torso and each shoulder are their own pools, and the chassis splits into
 * three (pelvis, left leg, right leg: the armor zones its components link, see
 * the parser's model export). A weapon's hits go to the pool of the part it is
 * mounted on; anything else (gear) is in no pool.
 */
import { hitboxPrimitives, type HitboxPrimitive } from '../model/hitbox';
import {
  socketSide,
  type ModelLookup,
  type ModulePlacement,
  type Side,
} from '../model/mount';
import { kindOfModule } from '../build/classify';
import {
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_PELVIS,
  ARMOR_ZONE_RIGHT_LEG,
} from '../../../utils/constants';
import type { BuildTables, ModuleKind } from '../build/types';
import type { ViewName } from './views';
import type { ArmorZoneId } from '../../../types/model';

export type PoolKind = 'chassis' | 'torso' | 'shoulder';

/** A weapon whose hits go to a pool. */
export interface PoolWeapon {
  moduleId: string;
  /** Its index in the placement list. */
  index: number;
}

/** One health pool: a chassis zone (pelvis / leg), the torso or a shoulder,
 * with the weapons mounted on it. */
export interface HitboxPool {
  /** Stable identity across builds (`torso`, `shoulder:left`,
   * `chassis:<zone>`, ...), for matching pools between two builds. */
  key: string;
  kind: PoolKind;
  /** Which side a shoulder or leg sits on; its inner side is not measured. */
  side: Side | null;
  /** Armor zone of a chassis pool split by zone, else null. */
  zone: ArmorZoneId | null;
  /** Index (in the placement list) of the pool's own module. */
  moduleIndex: number;
  moduleId: string;
  weapons: PoolWeapon[];
}

/** A placed module's hitboxes (or one armor zone's share of them) and the
 * pool its hits go to. */
export interface HitboxBody {
  primitives: HitboxPrimitive[];
  /** Index (in the placement list) of the module these hitboxes belong to. */
  moduleIndex: number;
  /** Armor zone of these hitboxes, when the module splits by zone. */
  zone: ArmorZoneId | null;
  /** Pool index, or null for modules outside any pool (gear), which are not
   * measured. */
  pool: number | null;
  /** True for a weapon counted toward its mount's pool. */
  weapon: boolean;
}

/** A build's pools and the hitbox bodies that feed them. */
export interface HitboxSet {
  pools: HitboxPool[];
  bodies: HitboxBody[];
}

/** A pool's outer side is measured; the side facing the torso is not. */
export function viewApplies(
  pool: Pick<HitboxPool, 'side'>,
  view: ViewName
): boolean {
  if (pool.side === 'left') return view !== 'right';
  if (pool.side === 'right') return view !== 'left';
  return true;
}

const isPoolKind = (kind: ModuleKind): kind is PoolKind =>
  kind === 'chassis' || kind === 'torso' || kind === 'shoulder';

/** The part of a placement pool assignment needs. */
type PoolEntry = Pick<
  ModulePlacement,
  'moduleId' | 'socketName' | 'parentIndex'
>;

export interface PoolAssignment {
  /** One pool per chassis, torso and shoulder (chassis not yet split by
   * zone). */
  pools: HitboxPool[];
  /** Per entry: the pool its hits go to, or null. */
  poolOf: (number | null)[];
  /** Per entry: whether it is a weapon. */
  weapon: boolean[];
}

/**
 * Health pools of a placement list (parents first), and which pool each
 * entry's hits go to: the chassis, torso and shoulders are pools; a weapon
 * joins the nearest pool part above it (its mount); everything else (gear) is
 * in no pool.
 */
export function assignPools(
  entries: readonly PoolEntry[],
  kindOf: (index: number) => ModuleKind
): PoolAssignment {
  const pools: HitboxPool[] = [];
  const poolOf: (number | null)[] = entries.map(() => null);
  const weapon: boolean[] = entries.map(() => false);
  entries.forEach((entry, i) => {
    const kind = kindOf(i);
    if (isPoolKind(kind)) {
      const side = kind === 'shoulder' ? socketSide(entry.socketName) : null;
      poolOf[i] = pools.length;
      pools.push({
        key: kind === 'shoulder' ? `shoulder:${side ?? i}` : kind,
        kind,
        side,
        zone: null,
        moduleIndex: i,
        moduleId: entry.moduleId,
        weapons: [],
      });
      return;
    }
    if (kind !== 'weapon') return;
    weapon[i] = true;
    for (let p = entry.parentIndex; p >= 0; p = entries[p].parentIndex) {
      const pool = poolOf[p];
      if (pool !== null) {
        poolOf[i] = pool;
        pools[pool].weapons.push({ moduleId: entry.moduleId, index: i });
        break;
      }
    }
  });
  return { pools, poolOf, weapon };
}

/** The chassis's armor zones, in display order, with the side each is on. */
const CHASSIS_ZONES: ReadonlyMap<ArmorZoneId, Side | null> = new Map([
  [ARMOR_ZONE_PELVIS, null],
  [ARMOR_ZONE_LEFT_LEG, 'left'],
  [ARMOR_ZONE_RIGHT_LEG, 'right'],
]);

const ZONE_ORDER = [...CHASSIS_ZONES.keys()];

const zoneRank = (zone: ArmorZoneId | null): number => {
  const rank = zone === null ? -1 : ZONE_ORDER.indexOf(zone);
  return rank < 0 ? Infinity : rank;
};

/** A pool per armor zone of a chassis whose hitboxes span several zones
 * (pelvis first; the first pool also takes any weapon mounted on the
 * chassis). Hitboxes with no zone get a plain chassis pool. */
function splitChassis(
  pool: HitboxPool,
  zones: readonly (ArmorZoneId | null)[]
): HitboxPool[] {
  return [...zones]
    .sort((a, b) => zoneRank(a) - zoneRank(b))
    .map((zone, n) => ({
      ...pool,
      key: `chassis:${zone ?? 'other'}`,
      side: (zone !== null ? CHASSIS_ZONES.get(zone) : undefined) ?? null,
      zone,
      weapons: n === 0 ? pool.weapons : [],
    }));
}

/**
 * Pools and hitbox bodies of a placed build; modules whose model is not
 * loaded contribute no hitboxes.
 */
export function collectHitboxes(
  placements: readonly ModulePlacement[],
  models: ModelLookup,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): HitboxSet {
  const assignment = assignPools(placements, (i) =>
    kindOfModule(placements[i].moduleId, tables)
  );
  const primitives = placements.map(({ modelId, world }) => {
    const model = modelId ? models.get(modelId) : undefined;
    return model ? hitboxPrimitives(model, world) : [];
  });

  // Module pools -> final pools, splitting each chassis by armor zone.
  const pools: HitboxPool[] = [];
  const firstPool: number[] = []; // module pool -> its (first) final pool
  // chassis module pool -> zone -> final pool
  const zonePools = new Map<number, Map<ArmorZoneId | null, number>>();
  assignment.pools.forEach((pool, p) => {
    firstPool[p] = pools.length;
    const zones = new Set(
      primitives[pool.moduleIndex].map((prim) => prim.zone)
    );
    if (pool.kind !== 'chassis' || zones.size < 2) {
      pools.push(pool);
      return;
    }
    const byZone = new Map<ArmorZoneId | null, number>();
    for (const split of splitChassis(pool, [...zones])) {
      byZone.set(split.zone, pools.length);
      pools.push(split);
    }
    zonePools.set(p, byZone);
  });

  const bodies = placements.flatMap((_, i): HitboxBody[] => {
    const p = assignment.poolOf[i];
    const weapon = assignment.weapon[i];
    const byZone = p === null ? undefined : zonePools.get(p);
    if (p === null || !byZone || weapon) {
      return [
        {
          primitives: primitives[i],
          moduleIndex: i,
          zone: null,
          pool: p === null ? null : firstPool[p],
          weapon,
        },
      ];
    }
    return [...byZone].map(([zone, pool]) => ({
      primitives: primitives[i].filter((prim) => prim.zone === zone),
      moduleIndex: i,
      zone,
      pool,
      weapon: false,
    }));
  });
  return { pools, bodies };
}
