/**
 * Renders the hitbox-area panel: a card for the whole robot, then one per
 * health pool (each shoulder, torso, pelvis, each leg), with the projected
 * area from every applicable view.
 *
 * Single build: `Alone | With weapons` per view. Comparing (build A vs B):
 * `A | B | Δ` for the chosen metric, pools matched by key, plus a headline of
 * the whole robot's % change per view (smaller is better: easier to miss).
 */
import {
  VIEW_ORDER,
  VIEWS,
  viewApplies,
  type HitboxPool,
  type PoolArea,
  type ViewName,
} from './hitbox_area';
import { cssHex } from './colors';
import { moduleLabel } from './build/classify';
import type { ComparisonMeasurement, HitboxMeasurement } from './viewer';
import type { BuildTables } from './build/types';

interface PanelBaseOptions {
  tables: Pick<BuildTables, 'modules'>;
  view: ViewName | null;
  onSelectView: (view: ViewName) => void;
}

export interface AreaPanelOptions extends PanelBaseOptions {
  /** Build colors (toPresetModules order), as the 3D view uses them. */
  colors: number[];
  /** Health pools (armor zones) with their own color, as the 3D view uses
   * them. */
  zoneColors: Record<string, number>;
}

/** Which area a comparison diffs. */
export type CompareMetric = 'alone' | 'withWeapons';

export interface ComparePanelOptions extends PanelBaseOptions {
  metric: CompareMetric;
}

const m2 = (cm2: number): string => (cm2 / 1e4).toFixed(2);

/** Changes smaller than this (relative) read as "no change". */
const SAME_EPSILON = 0.0005;

function viewRowLabel(pool: HitboxPool, view: ViewName): string {
  // A shoulder's or leg's only measured side is its outer one.
  if (pool.side && (view === 'left' || view === 'right')) return 'Side';
  return VIEWS[view].label;
}

function textEl(
  tag: keyof HTMLElementTagNameMap,
  text: string,
  className?: string
): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function swatch(color: number, title: string): HTMLElement {
  const node = document.createElement('span');
  node.className = 'hitbox-swatch';
  node.style.background = cssHex(color);
  node.title = title;
  return node;
}

/** `+0.42 (+6.1%)`, classed better (smaller) / worse (bigger) / same. */
function deltaCell(a: number | null, b: number | null): HTMLElement {
  if (a === null || b === null) return textEl('td', '-', 'is-muted');
  const diff = b - a;
  const rel = a > 0 ? diff / a : b > 0 ? Infinity : 0;
  const same = Math.abs(rel) < SAME_EPSILON;
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const pct = Number.isFinite(rel)
    ? ` (${sign}${Math.abs(rel * 100).toFixed(1)}%)`
    : '';
  return textEl(
    'td',
    same ? '0.00' : `${sign}${m2(Math.abs(diff))}${pct}`,
    same ? 'is-same' : diff < 0 ? 'is-better' : 'is-worse'
  );
}

interface Column {
  label: string;
  cell: (view: ViewName) => HTMLElement;
}

interface CardSpec {
  title: string;
  /** Swatch color before the title (a pool's 3D-view color). */
  color?: number;
  /** Muted text after the title (the pool's module name). */
  detail?: string;
  /** Line under the title (the weapons counted in "With weapons"). */
  sub: HTMLElement;
  /** Views measured for this card, with each row's label. */
  views: { view: ViewName; label: string }[];
  columns: Column[];
  className?: string;
}

function areaCard(spec: CardSpec, opts: PanelBaseOptions): HTMLElement {
  const card = document.createElement('article');
  card.className = ['hitbox-pool', spec.className].filter(Boolean).join(' ');

  const head = document.createElement('h3');
  if (spec.color !== undefined) head.append(swatch(spec.color, spec.title));
  head.append(` ${spec.title} `);
  if (spec.detail) {
    head.append(textEl('span', spec.detail, 'hitbox-pool-module'));
  }
  card.append(head, spec.sub);

  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  headRow.append(textEl('th', 'View'));
  for (const column of spec.columns) headRow.append(textEl('th', column.label));
  table.createTHead().append(headRow);
  const body = table.createTBody();

  for (const { view, label } of spec.views) {
    const row = document.createElement('tr');
    const viewCell = document.createElement('th');
    viewCell.scope = 'row';
    // Only the selected side is emphasized; a custom 3D angle matches no row.
    const active = view === opts.view;
    if (active) viewCell.className = 'is-active';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = `Show the ${VIEWS[view].label.toLowerCase()} view`;
    if (active) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => opts.onSelectView(view));
    viewCell.append(button);
    row.append(viewCell);
    for (const column of spec.columns) row.append(column.cell(view));
    body.append(row);
  }
  card.append(table);
  return card;
}

/** "Weapons: <swatch> Hefty, <swatch> Punisher" (colors as in the 3D view). */
function weaponsLine(
  weapons: { id: string; index: number }[],
  opts: AreaPanelOptions
): HTMLElement {
  const sub = document.createElement('p');
  sub.className = 'hitbox-pool-weapons';
  if (weapons.length === 0) {
    sub.textContent = 'No weapons mounted';
    return sub;
  }
  sub.append('Weapons:');
  weapons.forEach(({ id, index }, w) => {
    const name = moduleLabel(id, opts.tables);
    const weaponColor = opts.colors[index];
    sub.append(w === 0 ? ' ' : ', ');
    if (weaponColor !== undefined) sub.append(swatch(weaponColor, name), ' ');
    sub.append(name);
  });
  return sub;
}

const poolWeapons = (pool: HitboxPool): { id: string; index: number }[] =>
  pool.weaponIds.map((id, w) => ({ id, index: pool.weaponIndices[w] }));

/** Alone / With weapons columns for a single build. */
function singleColumns(
  area: (view: ViewName) => PoolArea,
  armed: boolean
): Column[] {
  return [
    { label: 'Alone', cell: (view) => textEl('td', m2(area(view).alone)) },
    {
      label: 'With weapons',
      cell: (view) =>
        armed
          ? textEl('td', m2(area(view).withWeapons))
          : textEl('td', '-', 'is-muted'),
    },
  ];
}

/** Right, middle, left: as the default 3D camera (front-right of the robot)
 * sees them. Shoulders + torso first, then the chassis (right leg, pelvis,
 * left leg) below them. */
const poolRank = (pool: HitboxPool): number =>
  (pool.kind === 'chassis' ? 3 : 0) +
  (pool.side === 'right' ? 0 : pool.side === 'left' ? 2 : 1);

export function renderAreaPanel(
  container: HTMLElement,
  measurement: HitboxMeasurement | null,
  opts: AreaPanelOptions
): void {
  container.replaceChildren();
  if (!measurement || measurement.pools.length === 0) {
    container.append(textEl('p', 'No hitboxes in this build.', 'is-muted'));
    return;
  }
  const allWeapons = measurement.pools.flatMap(poolWeapons);
  container.append(
    areaCard(
      {
        title: 'Whole robot',
        detail: 'all health pools combined',
        sub: weaponsLine(allWeapons, opts),
        views: VIEW_ORDER.map((view) => ({ view, label: VIEWS[view].label })),
        columns: singleColumns(
          (view) => measurement.areas[view].total,
          allWeapons.length > 0
        ),
        className: 'hitbox-pool-total',
      },
      opts
    )
  );
  measurement.pools
    .map((pool, i) => ({ pool, i }))
    .sort((a, b) => poolRank(a.pool) - poolRank(b.pool))
    .forEach(({ pool, i }) => {
      container.append(
        areaCard(
          {
            title: pool.label,
            color:
              (pool.zone ? opts.zoneColors[pool.zone] : undefined) ??
              opts.colors[pool.moduleIndex],
            detail: moduleLabel(pool.moduleId, opts.tables),
            sub: weaponsLine(poolWeapons(pool), opts),
            views: VIEW_ORDER.filter((view) => viewApplies(pool, view)).map(
              (view) => ({ view, label: viewRowLabel(pool, view) })
            ),
            columns: singleColumns(
              (view) => measurement.areas[view].pools[i],
              pool.weaponIds.length > 0
            ),
          },
          opts
        )
      );
    });
}

// ---------------------------------------------------------------------------
// Comparison (build A vs build B)
// ---------------------------------------------------------------------------

/** "Ravana" or "Ravana -> Lancelot" (A's name, then B's when it differs). */
function versus(a: string | null, b: string | null): string {
  if (a === b) return a ?? '-';
  return `${a ?? 'none'} → ${b ?? 'none'}`;
}

function names(ids: string[], opts: ComparePanelOptions): string | null {
  return ids.length > 0
    ? ids.map((id) => moduleLabel(id, opts.tables)).join(', ')
    : null;
}

function compareWeaponsLine(
  a: string[],
  b: string[],
  opts: ComparePanelOptions
): HTMLElement {
  const sub = document.createElement('p');
  sub.className = 'hitbox-pool-weapons';
  const na = names(a, opts);
  const nb = names(b, opts);
  sub.textContent =
    na === null && nb === null
      ? 'No weapons mounted'
      : `Weapons: ${versus(na, nb)}`;
  return sub;
}

/** A | B | Δ columns for the chosen metric; a side without the pool shows
 * "-". */
function compareColumns(
  a: (view: ViewName) => PoolArea | null,
  b: (view: ViewName) => PoolArea | null,
  metric: CompareMetric
): Column[] {
  const value = (area: PoolArea | null): number | null =>
    area ? area[metric] : null;
  const areaCell = (area: PoolArea | null): HTMLElement =>
    area ? textEl('td', m2(area[metric])) : textEl('td', '-', 'is-muted');
  return [
    { label: 'A', cell: (view) => areaCell(a(view)) },
    { label: 'B', cell: (view) => areaCell(b(view)) },
    {
      label: 'Δ',
      cell: (view) => deltaCell(value(a(view)), value(b(view))),
    },
  ];
}

/** The headline: the whole robot's % change per view, A to B. */
function renderHeadline(
  headline: HTMLElement,
  cmp: ComparisonMeasurement,
  opts: ComparePanelOptions
): void {
  headline.replaceChildren();
  for (const view of VIEW_ORDER) {
    const a = cmp.views[view].a.total[opts.metric];
    const b = cmp.views[view].b.total[opts.metric];
    const rel = a > 0 ? (b - a) / a : 0;
    const same = Math.abs(rel) < SAME_EPSILON;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = [
      'hitbox-headline-item',
      same ? 'is-same' : rel < 0 ? 'is-better' : 'is-worse',
      view === opts.view ? 'is-active' : '',
    ]
      .filter(Boolean)
      .join(' ');
    item.title = `Show the ${VIEWS[view].label.toLowerCase()} view`;
    item.addEventListener('click', () => opts.onSelectView(view));
    const sign = rel > 0 ? '+' : rel < 0 ? '-' : '';
    item.append(
      textEl('span', VIEWS[view].label, 'hitbox-headline-view'),
      textEl(
        'span',
        same ? '0.0%' : `${sign}${Math.abs(rel * 100).toFixed(1)}%`,
        'hitbox-headline-value'
      )
    );
    headline.append(item);
  }
}

export function renderComparePanel(
  container: HTMLElement,
  headline: HTMLElement,
  cmp: ComparisonMeasurement | null,
  opts: ComparePanelOptions
): void {
  container.replaceChildren();
  headline.replaceChildren();
  if (!cmp) {
    container.append(textEl('p', 'Measuring...', 'is-muted'));
    return;
  }
  renderHeadline(headline, cmp, opts);

  const weaponIds = (pools: HitboxPool[]): string[] =>
    pools.flatMap((pool) => pool.weaponIds);
  container.append(
    areaCard(
      {
        title: 'Whole robot',
        detail: 'all health pools combined',
        sub: compareWeaponsLine(
          weaponIds(cmp.poolsA),
          weaponIds(cmp.poolsB),
          opts
        ),
        views: VIEW_ORDER.map((view) => ({ view, label: VIEWS[view].label })),
        columns: compareColumns(
          (view) => cmp.views[view].a.total,
          (view) => cmp.views[view].b.total,
          opts.metric
        ),
        className: 'hitbox-pool-total',
      },
      opts
    )
  );

  // Pools matched by key; a pool only one build has still gets a card.
  const keys = new Map<string, { a: number; b: number }>();
  cmp.poolsA.forEach((pool, i) => keys.set(pool.key, { a: i, b: -1 }));
  cmp.poolsB.forEach((pool, i) => {
    const entry = keys.get(pool.key);
    if (entry) entry.b = i;
    else keys.set(pool.key, { a: -1, b: i });
  });
  [...keys.values()]
    .map(({ a, b }) => ({
      a,
      b,
      pool: a >= 0 ? cmp.poolsA[a] : cmp.poolsB[b],
    }))
    .sort((x, y) => poolRank(x.pool) - poolRank(y.pool))
    .forEach(({ a, b, pool }) => {
      const poolA = a >= 0 ? cmp.poolsA[a] : null;
      const poolB = b >= 0 ? cmp.poolsB[b] : null;
      container.append(
        areaCard(
          {
            title: pool.label,
            detail: versus(
              poolA && moduleLabel(poolA.moduleId, opts.tables),
              poolB && moduleLabel(poolB.moduleId, opts.tables)
            ),
            sub: compareWeaponsLine(
              poolA?.weaponIds ?? [],
              poolB?.weaponIds ?? [],
              opts
            ),
            views: VIEW_ORDER.filter((view) => viewApplies(pool, view)).map(
              (view) => ({ view, label: viewRowLabel(pool, view) })
            ),
            columns: compareColumns(
              (view) => (a >= 0 ? cmp.views[view].a.pools[a] : null),
              (view) => (b >= 0 ? cmp.views[view].b.pools[b] : null),
              opts.metric
            ),
          },
          opts
        )
      );
    });
}
