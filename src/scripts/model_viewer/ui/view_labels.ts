/**
 * Content of the part labels the 2D (axis) views show (see
 * render/label_overlay.ts): per health pool measured from that side, its name,
 * its part (icon + name, as the builder shows it) and its projected area from
 * the hitbox-area panel.
 *
 * The area always counts the part's mounted weapons (none is fine); comparing,
 * it reads A → B with the change.
 */
import { viewApplies, type HitboxPool } from '../../robot/hitbox_area/pools';
import type {
  ComparisonMeasurement,
  HitboxMeasurement,
} from '../../robot/hitbox_area/measure';
import type { ViewName } from '../../robot/hitbox_area/views';
import { DIFF_COLORS, partColor, type BuildColors } from '../colors';
import { matchPools } from './area_panel';
import { h, swatch } from './dom';
import { formatArea, formatDelta, moduleName, poolName } from './format';
import type { AnchoredLabel } from '../render/viewer';
import type { PartRefs } from './part_refs';
import type { ModelText } from '../strings';
import type { BuildTables } from '../../robot/build/types';

interface LabelContext {
  tables: Pick<BuildTables, 'modules'>;
  text: ModelText;
  partRefs: PartRefs;
}

export interface SingleLabelContext extends LabelContext {
  colors: BuildColors;
}

/** A part as the builder shows it: its ObjRef, else its name. */
function part(moduleId: string, ctx: LabelContext): Node {
  return (
    ctx.partRefs.clone(moduleId) ??
    document.createTextNode(moduleName(moduleId, ctx.tables, ctx.text))
  );
}

function card(
  pool: HitboxPool,
  color: number | null,
  parts: (Node | string)[],
  area: HTMLElement,
  text: ModelText
): HTMLElement {
  const name = poolName(pool, text);
  const head = h('div', { className: 'model-view-label-head' });
  if (color !== null) head.append(swatch(color, name), ' ');
  head.append(name);
  return h(
    'div',
    {},
    head,
    h('div', { className: 'model-view-label-part' }, ...parts),
    area
  );
}

/** Labels for one build's pools in `view`. */
export function singleViewLabels(
  measurement: HitboxMeasurement | null,
  view: ViewName,
  ctx: SingleLabelContext
): AnchoredLabel[] {
  if (!measurement) return [];
  const areas = measurement.areas[view];
  return measurement.pools.flatMap((pool, i): AnchoredLabel[] => {
    const anchor = areas.anchors[i];
    if (!anchor || !viewApplies(pool, view)) return [];
    const color = partColor(ctx.colors, pool.moduleIndex, pool.zone);
    const area = h('div', {
      className: 'model-view-label-area',
      text: `${formatArea(areas.pools[i].withWeapons)} m²`,
    });
    return [
      {
        anchor,
        color,
        content: card(pool, color, [part(pool.moduleId, ctx)], area, ctx.text),
      },
    ];
  });
}

/** Labels for A's and B's pools in `view`, matched by key; each points at
 * B's part (A's where B lacks the pool). */
export function compareViewLabels(
  cmp: ComparisonMeasurement | null,
  view: ViewName,
  ctx: LabelContext
): AnchoredLabel[] {
  if (!cmp) return [];
  const { a: areasA, b: areasB } = cmp.views[view];
  return matchPools(cmp).flatMap(({ a, b, pool }): AnchoredLabel[] => {
    const anchor =
      (b >= 0 ? areasB.anchors[b] : null) ??
      (a >= 0 ? areasA.anchors[a] : null);
    if (!anchor || !viewApplies(pool, view)) return [];
    const idA = a >= 0 ? cmp.poolsA[a].moduleId : null;
    const idB = b >= 0 ? cmp.poolsB[b].moduleId : null;

    const parts: (Node | string)[] = [];
    if (idA === null) parts.push(`${ctx.text.t('bOnly')}: `);
    if (idB === null) parts.push(`${ctx.text.t('aOnly')}: `);
    if (idA !== null && idB !== null && idA !== idB) {
      parts.push(part(idA, ctx), ' → ', part(idB, ctx));
    } else {
      const only = idB ?? idA;
      if (only !== null) parts.push(part(only, ctx));
    }

    const valueA = a >= 0 ? areasA.pools[a].withWeapons : null;
    const valueB = b >= 0 ? areasB.pools[b].withWeapons : null;
    const shown = (value: number | null): string =>
      value === null ? '-' : formatArea(value);
    const area = h('div', {
      className: 'model-view-label-area',
      text: `${shown(valueA)} → ${shown(valueB)} m² `,
    });
    if (valueA !== null && valueB !== null) {
      const { text, className } = formatDelta(valueA, valueB);
      area.append(h('span', { className, text }));
    }

    const color =
      idA === idB
        ? DIFF_COLORS.shared
        : idB === null
          ? DIFF_COLORS.aOnly
          : DIFF_COLORS.bOnly;
    return [
      { anchor, color, content: card(pool, null, parts, area, ctx.text) },
    ];
  });
}
