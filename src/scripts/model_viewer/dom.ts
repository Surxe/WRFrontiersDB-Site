/**
 * Tiny DOM helpers for the /models page controls.
 */

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}
