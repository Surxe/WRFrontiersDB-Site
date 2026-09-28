/**
 * Cascading build dropdowns.
 *
 * Renders one row per resolved slot, so a part's own sockets only appear once
 * it is placed. Structural parts (chassis, torso, shoulders) sit flat; each
 * part's weapon slots follow it, indented one level. Stateless: call
 * {@link renderBuilder} again with the new build after every change.
 */
import { isProdReady, isTitanModule } from '../../robot/build/classify';
import { createPicker, type PickerGroup } from './part_picker';
import { h } from './dom';
import { moduleName } from './format';
import type { PartRefs } from './part_refs';
import type { ModelText } from '../strings';
import type {
  BuildSlot,
  BuildTables,
  ResolvedBuild,
  SlotKey,
} from '../../robot/build/types';

export interface BuilderContext {
  tables: BuildTables;
  text: ModelText;
  partRefs: PartRefs;
  onSelect: (key: SlotKey, moduleId: string | null) => void;
  /** Element id prefix, unique per builder on the page. */
  idPrefix: string;
  /** Slots whose module differs from the build compared against: marked, and
   * given a revert button where `canRevert` allows (slots the user chose, as
   * opposed to ones that changed as a consequence). */
  changed?: ReadonlySet<SlotKey>;
  canRevert?: (key: SlotKey) => boolean;
  onRevert?: (key: SlotKey) => void;
}

/** Dropdowns with at least this many options get a search box. */
const SEARCH_MIN_OPTIONS = 8;

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

const pickerId = (key: SlotKey, prefix: string): string =>
  `${prefix}-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;

/** Row label (and an optional hint) for a slot, e.g. `Left Shoulder`, or
 * `Weapon 2` + `Light Weapon`. */
export function slotLabel(
  slot: BuildSlot,
  tables: Pick<BuildTables, 'socketTypes'>,
  text: ModelText
): { label: string; hint: string | null } {
  if (slot.socketTypeId === null) {
    return { label: text.t('chassis'), hint: null };
  }
  const typeName = tables.socketTypes[slot.socketTypeId]?.name;
  const typeText = typeName ? text.text(typeName) : null;
  if (slot.kind === 'weapon') {
    const n = /(\d+)$/.exec(slot.socketName);
    return {
      label: text.t('weaponSlot', { number: n ? Number(n[1]) + 1 : '' }).trim(),
      hint: typeText,
    };
  }
  return { label: typeText || slot.socketName, hint: null };
}

/** The picker's options, grouped by robot / titan where a slot mixes both
 * (the chassis list); an optional slot starts with "Empty". */
function optionGroups(
  slot: BuildSlot,
  ctx: BuilderContext
): PickerGroup<string | null>[] {
  const robots = slot.options.filter((id) => !isTitanModule(id, ctx.tables));
  const titans = slot.options.filter((id) => isTitanModule(id, ctx.tables));
  const groups: PickerGroup<string | null>[] =
    robots.length > 0 && titans.length > 0
      ? [
          { label: ctx.text.t('robots'), options: robots },
          { label: ctx.text.t('titans'), options: titans },
        ]
      : [{ label: null, options: slot.options }];
  return slot.required ? groups : [{ label: null, options: [null] }, ...groups];
}

/** Renders a part as the dropdowns show it: its ObjRef (else its name), plus
 * an id hint when two options share a name, and whether it is unreleased. */
function partRenderer(
  slot: BuildSlot,
  ctx: BuilderContext
): (moduleId: string | null) => Node {
  const nameCounts = new Map<string, number>();
  for (const id of slot.options) {
    const name = moduleName(id, ctx.tables, ctx.text);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return (moduleId) => {
    const content = h('span', { className: 'model-part' });
    if (moduleId === null) {
      content.textContent = ctx.text.t('empty');
      return content;
    }
    const name = moduleName(moduleId, ctx.tables, ctx.text);
    content.append(ctx.partRefs.clone(moduleId) ?? name);
    const hints: string[] = [];
    if ((nameCounts.get(name) ?? 0) > 1) {
      hints.push(moduleId.replace(/^DA_Module_/, ''));
    }
    if (!isProdReady(ctx.tables.modules[moduleId])) {
      hints.push(ctx.text.t('unreleased'));
    }
    if (hints.length > 0) {
      content.append(
        h('span', {
          className: 'model-hint',
          text: hints.map((hint) => `(${hint})`).join(' '),
        })
      );
    }
    return content;
  };
}

function buildRow(
  slot: BuildSlot,
  ctx: BuilderContext,
  signal: AbortSignal
): HTMLElement {
  const fixed = slot.fixed && slot.options.length <= 1;
  const picker = createPicker<string | null>({
    id: pickerId(slot.key, ctx.idPrefix),
    groups: optionGroups(slot, ctx),
    selected: slot.moduleId,
    render: partRenderer(slot, ctx),
    onChange: (moduleId) => ctx.onSelect(slot.key, moduleId),
    disabled: fixed,
    title: fixed ? ctx.text.t('fixedTitle') : undefined,
    search:
      slot.options.length >= SEARCH_MIN_OPTIONS
        ? {
            placeholder: ctx.text.t('searchParts'),
            noMatches: ctx.text.t('noMatchingParts'),
          }
        : undefined,
    signal,
  });
  picker.button.dataset.slotKey = slot.key;

  const { label: text, hint } = slotLabel(slot, ctx.tables, ctx.text);
  const label = h(
    'label',
    { attrs: { for: picker.button.id } },
    h('span', { className: 'builder-label', text })
  );
  if (hint) label.append(h('span', { className: 'model-hint', text: hint }));
  if (fixed) {
    label.append(
      h('span', { className: 'model-hint', text: ctx.text.t('fixed') })
    );
  }

  const row = h('div', { className: `builder-row builder-${slot.kind}` });
  if (slot.kind === 'weapon') row.classList.add('is-nested');
  if (ctx.changed?.has(slot.key)) {
    row.classList.add('is-changed');
    label.append(
      h('span', { className: 'builder-changed', text: ctx.text.t('changed') })
    );
    if (ctx.onRevert && ctx.canRevert?.(slot.key)) {
      const revert = h('button', {
        className: 'wrf-link-btn builder-revert',
        text: ctx.text.t('useA'),
        title: ctx.text.t('useATitle'),
        attrs: { type: 'button' },
      });
      const onRevert = ctx.onRevert;
      revert.addEventListener('click', (event) => {
        // Inside the <label>: keep the click from also opening the picker.
        event.preventDefault();
        onRevert(slot.key);
      });
      label.append(revert);
    }
  }
  row.append(label, picker.root);
  return row;
}

/** Aborts the previous render's document listeners, per container. */
const renders = new WeakMap<HTMLElement, AbortController>();

/** (Re)render the dropdowns for `build` into `container`, keeping keyboard
 * focus on the same slot across re-renders. */
export function renderBuilder(
  container: HTMLElement,
  build: ResolvedBuild,
  ctx: BuilderContext
): void {
  const focused = document.activeElement;
  const focusedKey =
    focused instanceof HTMLElement && container.contains(focused)
      ? focused.closest('.model-picker')?.querySelector('button')?.dataset
          .slotKey
      : undefined;

  renders.get(container)?.abort();
  const render = new AbortController();
  renders.set(container, render);
  container.replaceChildren(
    ...displaySlots(build).map((slot) => buildRow(slot, ctx, render.signal))
  );

  if (focusedKey) {
    document.getElementById(pickerId(focusedKey, ctx.idPrefix))?.focus();
  }
}
