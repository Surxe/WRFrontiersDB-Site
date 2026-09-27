/**
 * A group of `aria-pressed` toggle buttons (a `.wrf-toggle`) standing for one
 * choice: each button's `data-<key>` value is an option.
 */
import { queryAll } from './dom';

export class ToggleGroup<T extends string> {
  private readonly buttons: { button: HTMLButtonElement; value: T }[];

  /**
   * @param root the group element
   * @param key the data attribute holding each button's value (`mode` for
   *   `data-mode`)
   * @param isValue accepts the valid values (buttons with others are
   *   ignored)
   */
  constructor(
    root: HTMLElement,
    key: string,
    isValue: (value: unknown) => value is T
  ) {
    this.buttons = queryAll(root, 'button', HTMLButtonElement).flatMap(
      (button) => {
        const value = button.dataset[key];
        return isValue(value) ? [{ button, value }] : [];
      }
    );
  }

  /** Call `listener` with a button's value when it is clicked. */
  onSelect(listener: (value: T) => void): void {
    for (const { button, value } of this.buttons) {
      button.addEventListener('click', () => listener(value));
    }
  }

  /** Press the button for `value` (none for null). */
  setPressed(value: T | null): void {
    for (const { button, value: own } of this.buttons) {
      button.setAttribute('aria-pressed', String(own === value));
    }
  }
}
