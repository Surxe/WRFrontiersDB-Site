/**
 * Localized names and number formatting shared by the area panel and the 2D
 * view labels.
 */
import {
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_PELVIS,
  ARMOR_ZONE_RIGHT_LEG,
} from '../../../utils/constants';
import type { HitboxPool } from '../../robot/hitbox_area/pools';
import type { ViewName } from '../../robot/hitbox_area/views';
import type { ModelStringId, ModelText } from '../strings';
import type { BuildTables } from '../../robot/build/types';

const VIEW_STRINGS: Readonly<Record<ViewName, ModelStringId>> = {
  front: 'viewFront',
  back: 'viewBack',
  left: 'viewLeft',
  right: 'viewRight',
  top: 'viewTop',
};

export function viewName(view: ViewName, text: ModelText): string {
  return text.t(VIEW_STRINGS[view]);
}

const ZONE_STRINGS: ReadonlyMap<string, ModelStringId> = new Map([
  [ARMOR_ZONE_PELVIS, 'poolPelvis'],
  [ARMOR_ZONE_LEFT_LEG, 'poolLeftLeg'],
  [ARMOR_ZONE_RIGHT_LEG, 'poolRightLeg'],
]);

function poolStringId(pool: HitboxPool): ModelStringId {
  switch (pool.kind) {
    case 'chassis':
      return (
        (pool.zone !== null ? ZONE_STRINGS.get(pool.zone) : undefined) ??
        'chassis'
      );
    case 'torso':
      return 'poolTorso';
    case 'shoulder':
      return pool.side === 'left'
        ? 'poolLeftShoulder'
        : pool.side === 'right'
          ? 'poolRightShoulder'
          : 'poolShoulder';
  }
}

/** A health pool's name: `Left Shoulder`, `Pelvis`, ... */
export function poolName(pool: HitboxPool, text: ModelText): string {
  return text.t(poolStringId(pool));
}

/** A module's name in the reader's language, falling back to its id. */
export function moduleName(
  moduleId: string,
  tables: Pick<BuildTables, 'modules'>,
  text: ModelText
): string {
  const name = tables.modules[moduleId]?.name;
  return (name && text.text(name)) || moduleId;
}

/** Row label of a pool's view: a shoulder's or leg's only measured side is
 * its outer one, shown as "Side". */
export function poolViewName(
  pool: HitboxPool,
  view: ViewName,
  text: ModelText
): string {
  if (pool.side && (view === 'left' || view === 'right')) {
    return text.t('viewSide');
  }
  return viewName(view, text);
}

/** cm² -> m², 2 decimals. */
export const formatArea = (cm2: number): string => (cm2 / 1e4).toFixed(2);

/** Relative changes smaller than this read as "no change". */
const SAME_EPSILON = 0.0005;

/** How a change from A to B reads: smaller is better (harder to hit). */
export type DeltaClass = 'is-better' | 'is-worse' | 'is-same';

export function deltaClass(a: number, b: number): DeltaClass {
  const rel = relativeChange(a, b);
  if (Math.abs(rel) < SAME_EPSILON) return 'is-same';
  return b < a ? 'is-better' : 'is-worse';
}

/** (b - a) / a; Infinity when growing from nothing. */
function relativeChange(a: number, b: number): number {
  if (a > 0) return (b - a) / a;
  return b > 0 ? Infinity : 0;
}

const signOf = (x: number): string => (x > 0 ? '+' : x < 0 ? '-' : '');

/** `+6.1%` (or `0.0%` for no change); empty when growing from nothing. */
export function formatPercentChange(a: number, b: number): string {
  const rel = relativeChange(a, b);
  if (!Number.isFinite(rel)) return '';
  if (Math.abs(rel) < SAME_EPSILON) return '0.0%';
  return `${signOf(rel)}${Math.abs(rel * 100).toFixed(1)}%`;
}

/** `+0.42 (+6.1%)` from A to B, in m², with how it reads. */
export function formatDelta(
  a: number,
  b: number
): { text: string; className: DeltaClass } {
  const className = deltaClass(a, b);
  if (className === 'is-same') return { text: '0.00', className };
  const pct = formatPercentChange(a, b);
  const diff = b - a;
  return {
    text: `${signOf(diff)}${formatArea(Math.abs(diff))}${pct ? ` (${pct})` : ''}`,
    className,
  };
}
