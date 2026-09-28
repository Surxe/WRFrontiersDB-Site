/**
 * A dropdown whose options have rich content (icon + localized name), which a
 * native <select> cannot show: a `.wrf-select` button that opens a
 * `.wrf-listbox` (WRFrontiersDB-Design). Keyboard: arrows / Home / End move,
 * Enter / Space pick, Escape / Tab close.
 *
 * With `search`, the popup is a `.wrf-listbox--searchable`: a filter box above
 * the options (matched on their rendered text, see search/element_filter.ts)
 * that takes focus on open. Typing on the closed button opens it with that
 * text; Escape clears the query before closing.
 */
import { h } from './dom';
import {
  ElementFilter,
  type FilterGroup,
  type FilterItem,
} from '../../search/element_filter';

export interface PickerGroup<V> {
  /** Group header, or null for an ungrouped run of options. */
  label: string | null;
  options: readonly V[];
}

export interface PickerSearch {
  /** The filter box's placeholder and accessible name. */
  placeholder: string;
  /** Shown when no option matches. */
  noMatches: string;
}

export interface PickerConfig<V> {
  /** Element id of the button; the list and options derive theirs from it. */
  id: string;
  groups: readonly PickerGroup<V>[];
  selected: V;
  /** Fresh content for an option (and for the button, when selected). */
  render: (value: V) => Node;
  onChange: (value: V) => void;
  disabled?: boolean;
  title?: string;
  /** Adds a filter box to the popup. */
  search?: PickerSearch;
  /** Removes the picker's document listeners when aborted (on re-render). */
  signal: AbortSignal;
}

export interface Picker {
  root: HTMLElement;
  button: HTMLButtonElement;
}

export function createPicker<V>(config: PickerConfig<V>): Picker {
  const { id, selected, render, search, signal } = config;
  const button = h(
    'button',
    {
      className: 'wrf-select',
      title: config.title,
      attrs: {
        type: 'button',
        id,
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        'aria-controls': `${id}-list`,
      },
    },
    render(selected)
  );
  button.disabled = config.disabled ?? false;

  const list = h('ul', {
    className: search ? 'wrf-listbox__list' : 'wrf-listbox',
    attrs: { id: `${id}-list`, role: 'listbox', tabindex: '-1' },
  });
  const input = search
    ? h('input', {
        className: 'wrf-listbox__search',
        attrs: {
          type: 'search',
          id: `${id}-search`,
          role: 'combobox',
          placeholder: search.placeholder,
          'aria-label': search.placeholder,
          'aria-controls': list.id,
          'aria-expanded': 'true',
          'aria-autocomplete': 'list',
          autocomplete: 'off',
          spellcheck: 'false',
        },
      })
    : null;
  const popup = input
    ? h(
        'div',
        { className: 'wrf-listbox wrf-listbox--searchable' },
        input,
        list
      )
    : list;
  popup.hidden = true;
  /** Holds keyboard focus while open; the listbox itself without search. */
  const focusTarget: HTMLElement = input ?? list;
  const root = h('div', { className: 'model-picker' }, button, popup);

  const options: { li: HTMLLIElement; value: V }[] = [];
  /** Indices into `options` of those the query shows, in list order. */
  let shown: number[] = [];
  let active = -1;

  const setActive = (index: number): void => {
    options[active]?.li.classList.remove('is-active');
    const next = options[index];
    active = next ? index : -1;
    if (!next) {
      focusTarget.removeAttribute('aria-activedescendant');
      return;
    }
    next.li.classList.add('is-active');
    focusTarget.setAttribute('aria-activedescendant', next.li.id);
    next.li.scrollIntoView({ block: 'nearest' });
  };

  /** Move the highlight `step` shown options on, stopping at either end. */
  const move = (step: number): void => {
    const at = shown.indexOf(active);
    const to =
      at === -1 ? 0 : Math.min(shown.length - 1, Math.max(0, at + step));
    const index = shown[to];
    if (index !== undefined) setActive(index);
  };

  const selectedIndex = (): number =>
    options.findIndex((o) => o.value === selected);

  const onOutside = (event: PointerEvent): void => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) {
      close(false);
    }
  };
  let outsideListener: AbortController | null = null;

  function open(query = ''): void {
    popup.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    outsideListener = new AbortController();
    document.addEventListener('pointerdown', onOutside, {
      signal: AbortSignal.any([signal, outsideListener.signal]),
    });
    focusTarget.focus();
    if (input) input.value = query;
    applyQuery(query);
  }

  function close(returnFocus: boolean): void {
    popup.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    outsideListener?.abort();
    outsideListener = null;
    if (returnFocus) button.focus();
  }

  function choose(index: number): void {
    const option = options[index];
    if (!option) return;
    close(true);
    if (option.value !== selected) config.onChange(option.value);
  }

  const filterGroups: FilterGroup[] = [];
  for (const group of config.groups) {
    let header: HTMLLIElement | null = null;
    if (group.label !== null) {
      header = h('li', {
        className: 'wrf-listbox__group',
        text: group.label,
        attrs: { role: 'presentation' },
      });
      list.append(header);
    }
    const items: FilterItem[] = [];
    for (const value of group.options) {
      const index = options.length;
      const li = h(
        'li',
        {
          className: 'wrf-listbox__option',
          attrs: {
            id: `${id}-opt-${index}`,
            role: 'option',
            'aria-selected': String(value === selected),
          },
        },
        render(value)
      );
      li.addEventListener('click', () => choose(index));
      li.addEventListener('pointermove', () => setActive(index));
      options.push({ li, value });
      items.push({ element: li, text: li.textContent ?? '' });
      list.append(li);
    }
    filterGroups.push({ header, items });
  }

  const filter = search ? new ElementFilter(filterGroups) : null;
  const empty = search
    ? h('li', {
        className: 'wrf-listbox__empty',
        text: search.noMatches,
        attrs: { role: 'presentation' },
      })
    : null;
  if (empty) list.append(empty);

  /** Filter the options by `query`, highlighting the selected one if it is
   * still shown, else the first match. */
  function applyQuery(query: string): void {
    if (filter && empty) empty.hidden = filter.apply(query) > 0;
    shown = options.flatMap((o, i) => (o.li.hidden ? [] : [i]));
    const current = selectedIndex();
    setActive(shown.includes(current) ? current : (shown[0] ?? -1));
  }

  button.addEventListener('click', () => {
    if (popup.hidden) open();
    else close(true);
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    } else if (
      input &&
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // Start typing on the closed dropdown to search it.
      event.preventDefault();
      open(event.key);
    }
  });
  input?.addEventListener('input', () => applyQuery(input.value));
  focusTarget.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      // In the filter box, Home / End / Space edit the query.
      case 'Home':
        if (input) return;
        setActive(shown[0] ?? -1);
        break;
      case 'End':
        if (input) return;
        setActive(shown.at(-1) ?? -1);
        break;
      case ' ':
        if (input) return;
        choose(active);
        break;
      case 'Enter':
        choose(active);
        break;
      case 'Escape':
        if (input && input.value !== '') {
          input.value = '';
          applyQuery('');
        } else {
          close(true);
        }
        break;
      case 'Tab':
        close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  });

  return { root, button };
}
