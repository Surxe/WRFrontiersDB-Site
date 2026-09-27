/**
 * Content of the part labels the 2D (axis) views show (see label_overlay.ts):
 * per health pool measured from that side, its name, its part (icon + name,
 * as the builder shows it) and its projected area from the hitbox-area panel.
 *
 * The area always counts the part's mounted weapons (none is fine); comparing,
 * it reads A -> B with the change.
 */
import { formatDelta, m2, matchPools, swatch, textEl } from './area_panel';
import { viewApplies, type HitboxPool, type ViewName } from './hitbox_area';
import { moduleLabel } from './build/classify';
import { DIFF_COLORS } from './colors';
import type {
  AnchoredLabel,
  ComparisonMeasurement,
  HitboxMeasurement,
} from './viewer';
import type { BuildTables } from './build/types';

interface LabelBaseOptions {
  tables: Pick<BuildTables, 'modules'>;
  /** A fresh copy of a part's pre-rendered ObjRef (icon + localized name). */
  partRef: (moduleId: string) => Node | null;
}

export interface SingleLabelOptions extends LabelBaseOptions {
  /** Build colors and per-zone colors, as the panel and 3D view use them. */
  colors: number[];
  zoneColors: Record<string, number>;
}

const FALLBACK_COLOR = 0x9aa0a6;

function part(moduleId: string, opts: LabelBaseOptions): Node {
  return (
    opts.partRef(moduleId) ??
    document.createTextNode(moduleLabel(moduleId, opts.tables))
  );
}

function card(
  pool: HitboxPool,
  color: number | null,
  parts: Node[],
  area: HTMLElement
): HTMLElement {
  const root = document.createElement('div');
  const head = textEl('div', '', 'model-view-label-head');
  if (color !== null) head.append(swatch(color, pool.label), ' ');
  head.append(pool.label);
  const partLine = document.createElement('div');
  partLine.className = 'model-view-label-part';
  partLine.append(...parts);
  root.append(head, partLine, area);
  return root;
}

/** Labels for one build's pools in `view`. */
export function singleViewLabels(
  measurement: HitboxMeasurement | null,
  view: ViewName,
  opts: SingleLabelOptions
): AnchoredLabel[] {
  if (!measurement) return [];
  const areas = measurement.areas[view];
  const labels: AnchoredLabel[] = [];
  measurement.pools.forEach((pool, i) => {
    const anchor = areas.anchors[i];
    if (!anchor || !viewApplies(pool, view)) return;
    const color =
      (pool.zone ? opts.zoneColors[pool.zone] : undefined) ??
      opts.colors[pool.moduleIndex] ??
      FALLBACK_COLOR;
    const area = textEl(
      'div',
      `${m2(areas.pools[i].withWeapons)} m²`,
      'model-view-label-area'
    );
    labels.push({
      anchor,
      color,
      content: card(pool, color, [part(pool.moduleId, opts)], area),
    });
  });
  return labels;
}

/** Labels for A's and B's pools in `view`, matched by key; each points at
 * B's part (A's where B lacks the pool). */
export function compareViewLabels(
  cmp: ComparisonMeasurement | null,
  view: ViewName,
  opts: LabelBaseOptions
): AnchoredLabel[] {
  if (!cmp) return [];
  const { a: areasA, b: areasB } = cmp.views[view];
  const labels: AnchoredLabel[] = [];
  for (const { a, b, pool } of matchPools(cmp)) {
    const anchor =
      (b >= 0 ? areasB.anchors[b] : null) ??
      (a >= 0 ? areasA.anchors[a] : null);
    if (!anchor || !viewApplies(pool, view)) continue;
    const idA = a >= 0 ? cmp.poolsA[a].moduleId : null;
    const idB = b >= 0 ? cmp.poolsB[b].moduleId : null;
    const parts: Node[] =
      idA === idB || idA === null || idB === null
        ? [part((idB ?? idA)!, opts)]
        : [part(idA, opts), document.createTextNode(' → '), part(idB, opts)];
    if (idA === null) parts.unshift(document.createTextNode('B only: '));
    if (idB === null) parts.unshift(document.createTextNode('A only: '));

    const valueA = a >= 0 ? areasA.pools[a].withWeapons : null;
    const valueB = b >= 0 ? areasB.pools[b].withWeapons : null;
    const area = textEl(
      'div',
      `${valueA === null ? '-' : m2(valueA)} → ${valueB === null ? '-' : m2(valueB)} m² `,
      'model-view-label-area'
    );
    if (valueA !== null && valueB !== null) {
      const { text, className } = formatDelta(valueA, valueB);
      area.append(textEl('span', text, className));
    }

    labels.push({
      anchor,
      color:
        idA === idB
          ? DIFF_COLORS.shared
          : idB === null
            ? DIFF_COLORS.aOnly
            : DIFF_COLORS.bOnly,
      content: card(pool, null, parts, area),
    });
  }
  return labels;
}
