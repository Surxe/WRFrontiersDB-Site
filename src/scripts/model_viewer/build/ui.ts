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
  /** A fresh copy of the part's pre-rendered ObjRef (icon + localized name),
   * or null to fall back to its plain-text name. */
  partRef?: (moduleId: string) => Node | null;
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

function pickerIdFor(key: SlotKey): string {
  return `model-slot-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

/** Plain-text qualifiers after a part's name: an id hint when two parts share
 * a name, and whether it is unreleased. */
function optionSuffix(
  id: string,
  duplicate: boolean,
  tables: BuildTables
): string {
  let text = '';
  if (duplicate) text += ` (${id.replace(/^DA_Module_/, '')})`;
  if (!isProdReady(tables.modules[id])) text += ' (unreleased)';
  return text;
}

/** A part as shown in a dropdown: its ObjRef when available, else its name. */
function partContent(
  id: string | null,
  suffix: string,
  opts: BuilderUiOptions
): HTMLElement {
  const content = document.createElement('span');
  content.className = 'part-content';
  if (id === null) {
    content.textContent = 'Empty';
    return content;
  }
  const ref = opts.partRef?.(id) ?? null;
  content.append(ref ?? moduleLabel(id, opts.tables));
  if (suffix) {
    const hint = document.createElement('span');
    hint.className = 'builder-hint';
    hint.textContent = suffix;
    content.append(hint);
  }
  return content;
}

/**
 * A dropdown whose options are rich (icon + localized name), which a native
 * <select> cannot show: a button that opens a listbox. Keyboard: arrows /
 * Home / End move, Enter / Space pick, Escape / Tab close.
 */
function buildPicker(slot: BuildSlot, opts: BuilderUiOptions): HTMLElement {
  const { tables } = opts;
  const id = pickerIdFor(slot.key);
  const wrapper = document.createElement('div');
  wrapper.className = 'part-picker';

  const counts = new Map<string, number>();
  for (const optionId of slot.options) {
    const label = moduleLabel(optionId, tables);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const suffixOf = (optionId: string): string =>
    optionSuffix(
      optionId,
      (counts.get(moduleLabel(optionId, tables)) ?? 0) > 1,
      tables
    );

  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.className = 'part-picker-button';
  button.dataset.slotKey = slot.key;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.append(
    partContent(
      slot.moduleId,
      slot.moduleId ? suffixOf(slot.moduleId) : '',
      opts
    )
  );

  const list = document.createElement('ul');
  list.className = 'part-picker-list';
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  list.hidden = true;
  button.setAttribute('aria-controls', list.id);

  const options: HTMLLIElement[] = [];
  const addOption = (value: string | null): void => {
    const li = document.createElement('li');
    li.id = `${id}-opt-${options.length}`;
    li.className = 'part-picker-option';
    li.setAttribute('role', 'option');
    li.dataset.value = value ?? EMPTY_VALUE;
    const selected = value === slot.moduleId;
    li.setAttribute('aria-selected', String(selected));
    li.append(partContent(value, value ? suffixOf(value) : '', opts));
    li.addEventListener('click', () => choose(li));
    li.addEventListener('pointermove', () => setActive(options.indexOf(li)));
    options.push(li);
    list.append(li);
  };

  if (!slot.required) addOption(null);
  // Group by robot / titan only where a slot mixes both (the chassis list).
  const groups = new Map<string, string[]>();
  for (const optionId of slot.options) {
    const group =
      characterTypeOf(optionId, tables) === 'Titan' ? 'Titans' : 'Robots';
    groups.set(group, [...(groups.get(group) ?? []), optionId]);
  }
  for (const [label, ids] of groups) {
    if (groups.size > 1) {
      const header = document.createElement('li');
      header.className = 'part-picker-group';
      header.setAttribute('role', 'presentation');
      header.textContent = label;
      list.append(header);
    }
    for (const optionId of ids) addOption(optionId);
  }

  let active = -1;
  const setActive = (index: number): void => {
    if (index < 0 || index >= options.length) return;
    options[active]?.classList.remove('is-active');
    active = index;
    options[active].classList.add('is-active');
    list.setAttribute('aria-activedescendant', options[active].id);
    options[active].scrollIntoView({ block: 'nearest' });
  };

  const onOutside = (event: PointerEvent): void => {
    if (!wrapper.contains(event.target as Node)) close(false);
  };
  const open = (): void => {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside);
    list.focus();
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.getAttribute('aria-selected') === 'true')
      )
    );
  };
  const close = (returnFocus: boolean): void => {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside);
    if (returnFocus) button.focus();
  };
  const choose = (li: HTMLLIElement): void => {
    close(true);
    const value =
      li.dataset.value === EMPTY_VALUE ? null : (li.dataset.value ?? null);
    if (value !== slot.moduleId) opts.onSelect(slot.key, value);
  };

  button.addEventListener('click', () => {
    if (list.hidden) open();
    else close(true);
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        setActive(active + 1);
        break;
      case 'ArrowUp':
        setActive(active - 1);
        break;
      case 'Home':
        setActive(0);
        break;
      case 'End':
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (options[active]) choose(options[active]);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  });

  if (slot.fixed && slot.options.length <= 1) {
    button.disabled = true;
    button.title = 'Fixed by the game for this chassis';
  }
  wrapper.append(button, list);
  return wrapper;
}

function buildRow(slot: BuildSlot, opts: BuilderUiOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = `builder-row builder-${slot.kind}`;
  row.style.setProperty('--depth', slot.kind === 'weapon' ? '1' : '0');

  const picker = buildPicker(slot, opts);
  const button = picker.querySelector('button')!;
  const label = document.createElement('label');
  label.htmlFor = button.id;
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
  if (button.disabled) {
    const lock = document.createElement('span');
    lock.className = 'builder-hint';
    lock.textContent = 'fixed';
    label.appendChild(lock);
  }

  row.append(label, picker);
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
    active instanceof HTMLElement && container.contains(active)
      ? active.closest<HTMLElement>('.part-picker')?.querySelector('button')
          ?.dataset.slotKey
      : undefined;

  container.replaceChildren(
    ...displaySlots(build).map((slot) => buildRow(slot, opts))
  );

  if (focusedKey) {
    document.getElementById(pickerIdFor(focusedKey))?.focus();
  }
}
