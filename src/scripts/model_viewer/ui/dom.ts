/**
 * Small typed DOM helpers for the /models page's runtime-built UI.
 */
import { cssHex } from '../colors';

type ElementClass<T extends Element> = abstract new () => T;

/** The page element with `id`, checked to be a `type` (e.g. HTMLInputElement). */
export function requireElement<T extends Element>(
  id: string,
  type: ElementClass<T>
): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) {
    throw new Error(`#${id}: missing, or not a ${type.name}`);
  }
  return node;
}

/** Every `selector` match under `root`, checked to be a `type`. */
export function queryAll<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementClass<T>
): T[] {
  return [...root.querySelectorAll(selector)].filter(
    (node): node is T => node instanceof type
  );
}

export interface ElementOptions {
  className?: string;
  text?: string;
  title?: string;
  attrs?: Readonly<Record<string, string>>;
}

/** Create an element: `h('td', { className: 'is-muted', text: '-' })`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title) node.title = options.title;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/** A small color square (legend / pool marker). */
export function swatch(color: number, title: string): HTMLElement {
  const node = h('span', { className: 'model-swatch', title });
  node.style.background = cssHex(color);
  return node;
}
