/**
 * Renders the hitbox-area panel: a card for the whole robot, then one per
 * health pool (each shoulder, torso, pelvis, each leg), with the projected
 * area from every applicable view.
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
import type { HitboxMeasurement } from './viewer';
import type { BuildTables } from './build/types';

export interface AreaPanelOptions {
  tables: Pick<BuildTables, 'modules'>;
  /** Build colors (toPresetModules order), as the 3D view uses them. */
  colors: number[];
  /** Health pools (armor zones) with their own color, as the 3D view uses
   * them. */
  zoneColors: Record<string, number>;
  view: ViewName | null;
  onSelectView: (view: ViewName) => void;
}

const m2 = (cm2: number): string => (cm2 / 1e4).toFixed(2);

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

interface CardSpec {
  title: string;
  /** Swatch color before the title (a pool's 3D-view color). */
  color?: number;
  /** Muted text after the title (the pool's module name). */
  detail?: string;
  /** Module-list indices + ids of the weapons counted in "With weapons". */
  weapons: { id: string; index: number }[];
  /** Views measured for this card, with each row's label. */
  views: { view: ViewName; label: string }[];
  area: (view: ViewName) => PoolArea;
  className?: string;
}

function areaCard(spec: CardSpec, opts: AreaPanelOptions): HTMLElement {
  const card = document.createElement('article');
  card.className = ['hitbox-pool', spec.className].filter(Boolean).join(' ');

  const head = document.createElement('h3');
  if (spec.color !== undefined) head.append(swatch(spec.color, spec.title));
  head.append(` ${spec.title} `);
  if (spec.detail) {
    head.append(textEl('span', spec.detail, 'hitbox-pool-module'));
  }
  card.append(head);

  const sub = document.createElement('p');
  sub.className = 'hitbox-pool-weapons';
  if (spec.weapons.length === 0) {
    sub.textContent = 'No weapons mounted';
  } else {
    sub.append('Weapons:');
    spec.weapons.forEach(({ id, index }, w) => {
      const name = moduleLabel(id, opts.tables);
      const weaponColor = opts.colors[index];
      sub.append(w === 0 ? ' ' : ', ');
      if (weaponColor !== undefined) sub.append(swatch(weaponColor, name), ' ');
      sub.append(name);
    });
  }
  card.append(sub);

  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  for (const label of ['View', 'Alone', 'With weapons']) {
    headRow.append(textEl('th', label));
  }
  table.createTHead().append(headRow);
  const body = table.createTBody();
  const armed = spec.weapons.length > 0;

  for (const { view, label } of spec.views) {
    const area = spec.area(view);
    const row = document.createElement('tr');

    const viewCell = document.createElement('th');
    viewCell.scope = 'row';
    // Only the selected axis view is emphasized; the 3D view matches no row.
    const active = view === opts.view;
    if (active) viewCell.className = 'is-active';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = `Show the ${VIEWS[view].label.toLowerCase()} view`;
    if (active) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => opts.onSelectView(view));
    viewCell.append(button);
    row.append(viewCell, textEl('td', m2(area.alone)));

    row.append(
      armed ? textEl('td', m2(area.withWeapons)) : textEl('td', '-', 'is-muted')
    );
    body.append(row);
  }
  card.append(table);
  return card;
}

function poolCard(
  pool: HitboxPool,
  index: number,
  measurement: HitboxMeasurement,
  opts: AreaPanelOptions
): HTMLElement {
  return areaCard(
    {
      title: pool.label,
      color:
        (pool.zone ? opts.zoneColors[pool.zone] : undefined) ??
        opts.colors[pool.moduleIndex],
      detail: moduleLabel(pool.moduleId, opts.tables),
      weapons: pool.weaponIds.map((id, w) => ({
        id,
        index: pool.weaponIndices[w],
      })),
      views: VIEW_ORDER.filter((view) => viewApplies(pool, view)).map(
        (view) => ({ view, label: viewRowLabel(pool, view) })
      ),
      area: (view) => measurement.areas[view].pools[index],
    },
    opts
  );
}

/** Every health pool combined: the robot's whole silhouette, from every
 * side. */
function wholeRobotCard(
  measurement: HitboxMeasurement,
  opts: AreaPanelOptions
): HTMLElement {
  return areaCard(
    {
      title: 'Whole robot',
      detail: 'all health pools combined',
      weapons: measurement.pools.flatMap((pool) =>
        pool.weaponIds.map((id, w) => ({ id, index: pool.weaponIndices[w] }))
      ),
      views: VIEW_ORDER.map((view) => ({ view, label: VIEWS[view].label })),
      area: (view) => measurement.areas[view].total,
      className: 'hitbox-pool-total',
    },
    opts
  );
}

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
  // Right, middle, left: as the default 3D camera (front-right of the robot)
  // sees them. Shoulders + torso first, then the chassis (right leg, pelvis,
  // left leg) below them.
  const rank = (pool: HitboxPool): number =>
    (pool.kind === 'chassis' ? 3 : 0) +
    (pool.side === 'right' ? 0 : pool.side === 'left' ? 2 : 1);
  container.append(wholeRobotCard(measurement, opts));
  measurement.pools
    .map((pool, i) => ({ pool, i }))
    .sort((a, b) => rank(a.pool) - rank(b.pool))
    .forEach(({ pool, i }) => {
      container.append(poolCard(pool, i, measurement, opts));
    });
}
