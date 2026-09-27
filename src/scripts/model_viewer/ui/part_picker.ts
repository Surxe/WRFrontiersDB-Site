/**
 * A dropdown whose options have rich content (icon + localized name), which a
 * native <select> cannot show: a `.wrf-select` button that opens a
 * `.wrf-listbox` (WRFrontiersDB-Design). Keyboard: arrows / Home / End move,
 * Enter / Space pick, Escape / Tab close.
 */
import { h } from './dom';

export interface PickerGroup<V> {
  /** Group header, or null for an ungrouped run of options. */
  label: string | null;
  options: readonly V[];
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
  /** Removes the picker's document listeners when aborted (on re-render). */
  signal: AbortSignal;
}

export interface Picker {
  root: HTMLElement;
  button: HTMLButtonElement;
}

export function createPicker<V>(config: PickerConfig<V>): Picker {
  const { id, selected, render, signal } = config;
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
    className: 'wrf-listbox',
    attrs: { id: `${id}-list`, role: 'listbox', tabindex: '-1' },
  });
  list.hidden = true;
  const root = h('div', { className: 'model-picker' }, button, list);

  const options: { li: HTMLLIElement; value: V }[] = [];
  let active = -1;

  const setActive = (index: number): void => {
    const next = options[index];
    if (!next) return;
    options[active]?.li.classList.remove('is-active');
    active = index;
    next.li.classList.add('is-active');
    list.setAttribute('aria-activedescendant', next.li.id);
    next.li.scrollIntoView({ block: 'nearest' });
  };

  const onOutside = (event: PointerEvent): void => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) {
      close(false);
    }
  };
  let outsideListener: AbortController | null = null;

  function open(): void {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    outsideListener = new AbortController();
    document.addEventListener('pointerdown', onOutside, {
      signal: AbortSignal.any([signal, outsideListener.signal]),
    });
    list.focus();
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === selected)
      )
    );
  }

  function close(returnFocus: boolean): void {
    list.hidden = true;
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

  for (const group of config.groups) {
    if (group.label !== null) {
      list.append(
        h('li', {
          className: 'wrf-listbox__group',
          text: group.label,
          attrs: { role: 'presentation' },
        })
      );
    }
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
      list.append(li);
    }
  }

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
        choose(active);
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

  return { root, button };
}
