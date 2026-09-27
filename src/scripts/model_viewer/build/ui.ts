/**
 * Cascading build dropdowns.
 *
 * Renders one row per resolved slot, so a part's own sockets only appear once
 * it is placed. Structural parts (chassis, torso, shoulders) sit flat; each
 * part's weapon slots follow it, indented one level. Stateless: call
 * {@link renderBuilder} again with the new build after every change.
 */
import {
  characterTypeOf,
  isProdReady,
  moduleLabel,
  slotLabel,
} from './classify';
import type { BuildSlot, BuildTables, ResolvedBuild, SlotKey } from './types';

export interface BuilderUiOptions {
  tables: BuildTables;
  onSelect: (key: SlotKey, moduleId: string | null) => void;
}

const EMPTY_VALUE = '';

/** Slot kinds not shown as dropdowns (supply / cycle gear, for now). */
const HIDDEN_KINDS: ReadonlySet<BuildSlot['kind']> = new Set(['ability']);

/** Display order: each visible non-weapon slot (in tree order) followed by its
 * own weapon slots, so a torso's weapons sit under the torso rather than after
 * the shoulders that also hang off it. */
export function displaySlots(build: ResolvedBuild): BuildSlot[] {
  const visible = build.slots.filter((s) => !HIDDEN_KINDS.has(s.kind));
  return visible
    .filter((s) => s.kind !== 'weapon')
    .flatMap((part) => [
      part,
      ...visible.filter((s) => s.kind === 'weapon' && s.parentKey === part.key),
    ]);
}

function selectIdFor(key: SlotKey): string {
  return `model-slot-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

function optionText(
  id: string,
  duplicate: boolean,
  tables: BuildTables
): string {
  let text = moduleLabel(id, tables);
  if (duplicate) text += ` (${id.replace(/^DA_Module_/, '')})`;
  if (!isProdReady(tables.modules[id])) text += ' (unreleased)';
  return text;
}

function buildSelect(
  slot: BuildSlot,
  opts: BuilderUiOptions
): HTMLSelectElement {
  const { tables } = opts;
  const select = document.createElement('select');
  select.id = selectIdFor(slot.key);
  select.dataset.slotKey = slot.key;

  if (!slot.required) {
    const empty = document.createElement('option');
    empty.value = EMPTY_VALUE;
    empty.textContent = 'Empty';
    select.appendChild(empty);
  }

  const counts = new Map<string, number>();
  for (const id of slot.options) {
    const label = moduleLabel(id, tables);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const makeOption = (id: string): HTMLOptionElement => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = optionText(
      id,
      (counts.get(moduleLabel(id, tables)) ?? 0) > 1,
      tables
    );
    return o;
  };

  // Group by robot / titan only where a slot mixes both (the chassis list).
  const groups = new Map<string, string[]>();
  for (const id of slot.options) {
    const group = characterTypeOf(id, tables) === 'Titan' ? 'Titans' : 'Robots';
    groups.set(group, [...(groups.get(group) ?? []), id]);
  }
  if (groups.size > 1) {
    for (const [label, ids] of groups) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const id of ids) group.appendChild(makeOption(id));
      select.appendChild(group);
    }
  } else {
    for (const id of slot.options) select.appendChild(makeOption(id));
  }

  select.value = slot.moduleId ?? EMPTY_VALUE;
  if (slot.fixed && slot.options.length <= 1) {
    select.disabled = true;
    select.title = 'Fixed by the game for this chassis';
  }
  select.addEventListener('change', () => {
    opts.onSelect(slot.key, select.value === EMPTY_VALUE ? null : select.value);
  });
  return select;
}

function buildRow(slot: BuildSlot, opts: BuilderUiOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = `builder-row builder-${slot.kind}`;
  row.style.setProperty('--depth', slot.kind === 'weapon' ? '1' : '0');

  const select = buildSelect(slot, opts);
  const label = document.createElement('label');
  label.htmlFor = select.id;
  const { label: text, hint } = slotLabel(slot, opts.tables);
  const name = document.createElement('span');
  name.className = 'builder-label';
  name.textContent = text;
  label.appendChild(name);
  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.className = 'builder-hint';
    hintEl.textContent = hint;
    label.appendChild(hintEl);
  }
  if (select.disabled) {
    const lock = document.createElement('span');
    lock.className = 'builder-hint';
    lock.textContent = 'fixed';
    label.appendChild(lock);
  }

  row.append(label, select);
  return row;
}

/** (Re)render the dropdowns for `build` into `container`, keeping keyboard
 * focus on the same slot across re-renders. */
export function renderBuilder(
  container: HTMLElement,
  build: ResolvedBuild,
  opts: BuilderUiOptions
): void {
  const active = document.activeElement;
  const focusedKey =
    active instanceof HTMLSelectElement && container.contains(active)
      ? active.dataset.slotKey
      : undefined;

  container.replaceChildren(
    ...displaySlots(build).map((slot) => buildRow(slot, opts))
  );

  if (focusedKey) {
    document.getElementById(selectIdFor(focusedKey))?.focus();
  }
}
