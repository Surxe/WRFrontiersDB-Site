/**
 * The hitbox-area panel: a card for the whole robot, then one per health pool
 * (each shoulder, torso, pelvis, each leg), with the projected area from every
 * applicable view.
 *
 * Single build: `Alone | With weapons` per view. Comparing (build A vs B):
 * `A | B | Δ` for the chosen metric, pools matched by key, plus a headline of
 * the whole robot's % change per view (smaller is better: easier to miss).
 */
import { VIEW_NAMES, type ViewName } from '../../robot/hitbox_area/views';
import {
  viewApplies,
  type HitboxPool,
  type PoolWeapon,
} from '../../robot/hitbox_area/pools';
import type {
  AreaMetric,
  ComparisonMeasurement,
  HitboxMeasurement,
  PoolArea,
} from '../../robot/hitbox_area/measure';
import { partColor, type BuildColors } from '../colors';
import { h, swatch } from './dom';
import {
  deltaClass,
  formatArea,
  formatDelta,
  formatPercentChange,
  moduleName,
  poolName,
  poolViewName,
  viewName,
} from './format';
import type { ModelText } from '../strings';
import type { BuildTables } from '../../robot/build/types';

interface PanelContext {
  tables: Pick<BuildTables, 'modules'>;
  text: ModelText;
  /** The selected side (null at a custom 3D angle: no row is emphasized). */
  view: ViewName | null;
  onSelectView: (view: ViewName) => void;
}

export interface AreaPanelContext extends PanelContext {
  /** Build colors, as the 3D view uses them. */
  colors: BuildColors;
}

export interface ComparePanelContext extends PanelContext {
  metric: AreaMetric;
}

/** Pools in display order: right, middle, left, as the default 3D camera
 * (front-right of the robot) sees them. Shoulders + torso first, then the
 * chassis (right leg, pelvis, left leg) below them. */
const poolRank = (pool: HitboxPool): number =>
  (pool.kind === 'chassis' ? 3 : 0) +
  (pool.side === 'right' ? 0 : pool.side === 'left' ? 2 : 1);

const mutedCell = (): HTMLElement =>
  h('td', { className: 'is-muted', text: '-' });

interface Column {
  label: string;
  cell: (view: ViewName) => HTMLElement;
}

interface CardSpec {
  title: string;
  /** Swatch color before the title (a pool's 3D-view color). */
  color?: number;
  /** Muted text after the title (the pool's module name). */
  detail: string;
  /** Line under the title (the weapons counted in "With weapons"). */
  weaponsLine: string | HTMLElement;
  /** Views measured for this card, with each row's label. */
  views: { view: ViewName; label: string }[];
  columns: Column[];
  wide?: boolean;
}

function viewButton(
  view: ViewName,
  label: string,
  ctx: PanelContext
): HTMLElement {
  // Only the selected side is emphasized; a custom 3D angle matches no row.
  const active = view === ctx.view;
  const button = h('button', {
    className: 'wrf-link-btn',
    text: label,
    title: ctx.text.t('showView', { view: viewName(view, ctx.text) }),
    attrs: { type: 'button', ...(active ? { 'aria-current': 'true' } : {}) },
  });
  button.addEventListener('click', () => ctx.onSelectView(view));
  const cell = h('th', { className: active ? 'is-active' : '' }, button);
  cell.scope = 'row';
  return cell;
}

function areaCard(spec: CardSpec, ctx: PanelContext): HTMLElement {
  const title = h('h3', {});
  if (spec.color !== undefined) title.append(swatch(spec.color, spec.title));
  title.append(
    ` ${spec.title} `,
    h('span', { className: 'hitbox-pool-module', text: spec.detail })
  );

  const table = h('table', {});
  table
    .createTHead()
    .append(
      h(
        'tr',
        {},
        h('th', { text: ctx.text.t('view') }),
        ...spec.columns.map((column) => h('th', { text: column.label }))
      )
    );
  const body = table.createTBody();
  for (const { view, label } of spec.views) {
    body.append(
      h(
        'tr',
        {},
        viewButton(view, label, ctx),
        ...spec.columns.map((column) => column.cell(view))
      )
    );
  }

  return h(
    'article',
    {
      className: `hitbox-pool wrf-panel wrf-panel--inset${spec.wide ? ' hitbox-pool-total' : ''}`,
    },
    title,
    h('p', { className: 'hitbox-pool-weapons' }, spec.weaponsLine),
    table
  );
}

/** Every view for the whole robot; a pool's outer side only. */
function viewRows(
  pool: HitboxPool | null,
  text: ModelText
): { view: ViewName; label: string }[] {
  return VIEW_NAMES.filter((view) => !pool || viewApplies(pool, view)).map(
    (view) => ({
      view,
      label: pool ? poolViewName(pool, view, text) : viewName(view, text),
    })
  );
}

// ---------------------------------------------------------------------------
// One build
// ---------------------------------------------------------------------------

/** "Weapons: <swatch> Hefty, <swatch> Punisher" (colors as in the 3D view). */
function weaponsLine(
  weapons: readonly PoolWeapon[],
  ctx: AreaPanelContext
): string | HTMLElement {
  if (weapons.length === 0) return ctx.text.t('noWeapons');
  const line = h('span', {}, `${ctx.text.t('weapons')}:`);
  weapons.forEach(({ moduleId, index }, w) => {
    const name = moduleName(moduleId, ctx.tables, ctx.text);
    line.append(
      w === 0 ? ' ' : ', ',
      swatch(partColor(ctx.colors, index, null), name),
      ` ${name}`
    );
  });
  return line;
}

/** Alone / With weapons columns for a single build. */
function singleColumns(
  area: (view: ViewName) => PoolArea,
  armed: boolean,
  text: ModelText
): Column[] {
  return [
    {
      label: text.t('alone'),
      cell: (view) => h('td', { text: formatArea(area(view).alone) }),
    },
    {
      label: text.t('withWeapons'),
      cell: (view) =>
        armed
          ? h('td', { text: formatArea(area(view).withWeapons) })
          : mutedCell(),
    },
  ];
}

export function renderAreaPanel(
  container: HTMLElement,
  measurement: HitboxMeasurement | null,
  ctx: AreaPanelContext
): void {
  const { text } = ctx;
  if (!measurement) {
    container.replaceChildren(
      h('p', { className: 'is-muted', text: text.t('measuring') })
    );
    return;
  }
  if (measurement.pools.length === 0) {
    container.replaceChildren(
      h('p', { className: 'is-muted', text: text.t('noHitboxes') })
    );
    return;
  }
  const allWeapons = measurement.pools.flatMap((pool) => pool.weapons);
  const whole = areaCard(
    {
      title: text.t('wholeRobot'),
      detail: text.t('wholeRobotDetail'),
      weaponsLine: weaponsLine(allWeapons, ctx),
      views: viewRows(null, text),
      columns: singleColumns(
        (view) => measurement.areas[view].total,
        allWeapons.length > 0,
        text
      ),
      wide: true,
    },
    ctx
  );
  const pools = measurement.pools
    .map((pool, i) => ({ pool, i }))
    .sort((x, y) => poolRank(x.pool) - poolRank(y.pool))
    .map(({ pool, i }) =>
      areaCard(
        {
          title: poolName(pool, text),
          color: partColor(ctx.colors, pool.moduleIndex, pool.zone),
          detail: moduleName(pool.moduleId, ctx.tables, text),
          weaponsLine: weaponsLine(pool.weapons, ctx),
          views: viewRows(pool, text),
          columns: singleColumns(
            (view) => measurement.areas[view].pools[i],
            pool.weapons.length > 0,
            text
          ),
        },
        ctx
      )
    );
  container.replaceChildren(whole, ...pools);
}

// ---------------------------------------------------------------------------
// Comparison (build A vs build B)
// ---------------------------------------------------------------------------

/** A's and B's pools matched by key, in display order: indices into
 * `poolsA` / `poolsB` (-1 where that build lacks the pool), and the pool to
 * describe it by (A's, else B's). */
export function matchPools(
  cmp: Pick<ComparisonMeasurement, 'poolsA' | 'poolsB'>
): { a: number; b: number; pool: HitboxPool }[] {
  const keys = new Map<string, { a: number; b: number }>();
  cmp.poolsA.forEach((pool, i) => keys.set(pool.key, { a: i, b: -1 }));
  cmp.poolsB.forEach((pool, i) => {
    const entry = keys.get(pool.key);
    if (entry) entry.b = i;
    else keys.set(pool.key, { a: -1, b: i });
  });
  return [...keys.values()]
    .map(({ a, b }) => ({ a, b, pool: a >= 0 ? cmp.poolsA[a] : cmp.poolsB[b] }))
    .sort((x, y) => poolRank(x.pool) - poolRank(y.pool));
}

/** "Ravana" or "Ravana → Lancelot" (A's name, then B's when it differs). */
function versus(a: string | null, b: string | null, text: ModelText): string {
  if (a === b) return a ?? '-';
  return `${a ?? text.t('none')} → ${b ?? text.t('none')}`;
}

function compareWeaponsLine(
  a: readonly PoolWeapon[],
  b: readonly PoolWeapon[],
  ctx: ComparePanelContext
): string {
  const names = (weapons: readonly PoolWeapon[]): string | null =>
    weapons.length > 0
      ? weapons
          .map((w) => moduleName(w.moduleId, ctx.tables, ctx.text))
          .join(', ')
      : null;
  const na = names(a);
  const nb = names(b);
  if (na === null && nb === null) return ctx.text.t('noWeapons');
  return `${ctx.text.t('weapons')}: ${versus(na, nb, ctx.text)}`;
}

/** A | B | Δ columns for the chosen metric; a side without the pool shows
 * "-". */
function compareColumns(
  a: (view: ViewName) => PoolArea | null,
  b: (view: ViewName) => PoolArea | null,
  metric: AreaMetric
): Column[] {
  const areaCell = (area: PoolArea | null): HTMLElement =>
    area ? h('td', { text: formatArea(area[metric]) }) : mutedCell();
  return [
    { label: 'A', cell: (view) => areaCell(a(view)) },
    { label: 'B', cell: (view) => areaCell(b(view)) },
    {
      label: 'Δ',
      cell: (view) => {
        const areaA = a(view);
        const areaB = b(view);
        if (!areaA || !areaB) return mutedCell();
        const { text, className } = formatDelta(areaA[metric], areaB[metric]);
        return h('td', { className, text });
      },
    },
  ];
}

/** The headline: the whole robot's % change per view, A to B. */
function renderHeadline(
  headline: HTMLElement,
  cmp: ComparisonMeasurement,
  ctx: ComparePanelContext
): void {
  headline.replaceChildren(
    ...VIEW_NAMES.map((view) => {
      const a = cmp.views[view].a.total[ctx.metric];
      const b = cmp.views[view].b.total[ctx.metric];
      const name = viewName(view, ctx.text);
      const item = h(
        'button',
        {
          className: [
            'hitbox-headline-item',
            'wrf-panel',
            'wrf-panel--inset',
            deltaClass(a, b),
            view === ctx.view ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' '),
          title: ctx.text.t('showView', { view: name }),
          attrs: { type: 'button' },
        },
        h('span', { className: 'hitbox-headline-view', text: name }),
        h('span', {
          className: 'hitbox-headline-value',
          text: formatPercentChange(a, b),
        })
      );
      item.addEventListener('click', () => ctx.onSelectView(view));
      return item;
    })
  );
}

export function renderComparePanel(
  container: HTMLElement,
  headline: HTMLElement,
  cmp: ComparisonMeasurement | null,
  ctx: ComparePanelContext
): void {
  const { text } = ctx;
  if (!cmp) {
    headline.replaceChildren();
    container.replaceChildren(
      h('p', { className: 'is-muted', text: text.t('measuring') })
    );
    return;
  }
  renderHeadline(headline, cmp, ctx);

  const weaponsOf = (pools: readonly HitboxPool[]): PoolWeapon[] =>
    pools.flatMap((pool) => pool.weapons);
  const whole = areaCard(
    {
      title: text.t('wholeRobot'),
      detail: text.t('wholeRobotDetail'),
      weaponsLine: compareWeaponsLine(
        weaponsOf(cmp.poolsA),
        weaponsOf(cmp.poolsB),
        ctx
      ),
      views: viewRows(null, text),
      columns: compareColumns(
        (view) => cmp.views[view].a.total,
        (view) => cmp.views[view].b.total,
        ctx.metric
      ),
      wide: true,
    },
    ctx
  );

  // A pool only one build has still gets a card.
  const pools = matchPools(cmp).map(({ a, b, pool }) => {
    const poolA = a >= 0 ? cmp.poolsA[a] : null;
    const poolB = b >= 0 ? cmp.poolsB[b] : null;
    const nameOf = (p: HitboxPool | null): string | null =>
      p && moduleName(p.moduleId, ctx.tables, text);
    return areaCard(
      {
        title: poolName(pool, text),
        detail: versus(nameOf(poolA), nameOf(poolB), text),
        weaponsLine: compareWeaponsLine(
          poolA?.weapons ?? [],
          poolB?.weapons ?? [],
          ctx
        ),
        views: viewRows(pool, text),
        columns: compareColumns(
          (view) => (a >= 0 ? cmp.views[view].a.pools[a] : null),
          (view) => (b >= 0 ? cmp.views[view].b.pools[b] : null),
          ctx.metric
        ),
      },
      ctx
    );
  });
  container.replaceChildren(whole, ...pools);
}
