/**
 * Renders the hitbox-area panel: one card per health pool (torso, each
 * shoulder) with its projected area from every applicable view.
 */
import {
  VIEW_ORDER,
  VIEWS,
  viewApplies,
  type HitboxPool,
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
  view: ViewName | null;
  onSelectView: (view: ViewName) => void;
}

const m2 = (cm2: number): string => (cm2 / 1e4).toFixed(2);

function viewRowLabel(pool: HitboxPool, view: ViewName): string {
  // A shoulder's only measured side is its outer one.
  if (pool.kind === 'shoulder' && (view === 'left' || view === 'right'))
    return 'Side';
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

function poolCard(
  pool: HitboxPool,
  index: number,
  measurement: HitboxMeasurement,
  opts: AreaPanelOptions
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'hitbox-pool';

  const head = document.createElement('h3');
  const color = opts.colors[pool.moduleIndex];
  if (color !== undefined) head.append(swatch(color, pool.label));
  head.append(
    ` ${pool.label} `,
    textEl(
      'span',
      moduleLabel(pool.moduleId, opts.tables),
      'hitbox-pool-module'
    )
  );
  card.append(head);

  const sub = document.createElement('p');
  sub.className = 'hitbox-pool-weapons';
  if (pool.weaponIds.length === 0) {
    sub.textContent = 'No weapons mounted';
  } else {
    sub.append('Weapons:');
    pool.weaponIds.forEach((id, w) => {
      const name = moduleLabel(id, opts.tables);
      const weaponColor = opts.colors[pool.weaponIndices[w]];
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
  const armed = pool.weaponIds.length > 0;

  for (const view of VIEW_ORDER) {
    if (!viewApplies(pool, view)) continue;
    const area = measurement.areas[view][index];
    const row = document.createElement('tr');
    if (view === opts.view) row.className = 'is-active';

    const viewCell = document.createElement('th');
    viewCell.scope = 'row';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = viewRowLabel(pool, view);
    button.title = `Show the ${VIEWS[view].label.toLowerCase()} view`;
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

export function renderAreaPanel(
  container: HTMLElement,
  measurement: HitboxMeasurement | null,
  opts: AreaPanelOptions
): void {
  container.replaceChildren();
  if (!measurement || measurement.pools.length === 0) {
    container.append(
      textEl('p', 'No torso or shoulder hitboxes in this build.', 'is-muted')
    );
    return;
  }
  measurement.pools.forEach((pool, i) => {
    container.append(poolCard(pool, i, measurement, opts));
  });
}
