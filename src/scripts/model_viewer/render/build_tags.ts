/**
 * Name tags over the 3D view while comparing side by side: one card per
 * build, centered above it, so which robot is A and which is B reads at a
 * glance. The viewer projects each tag's anchor to canvas pixels every frame;
 * this just moves the cards. Cards never take pointer events, so orbiting
 * still works through them.
 */
import { cssHex } from '../colors';
import type { ScreenPoint } from './label_overlay';

export interface BuildTag {
  text: string;
  /** Swatch color, 0xRRGGBB. */
  color: number;
}

export class BuildTags {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement[];
  /** Last layout's input, to skip unchanged frames. */
  private lastKey = '';

  constructor(container: HTMLElement, tags: readonly BuildTag[]) {
    this.root = document.createElement('div');
    this.root.className = 'model-build-tags';
    this.root.hidden = true;
    this.cards = tags.map(({ text, color }) => {
      const card = document.createElement('div');
      card.className = 'model-build-tag';
      const swatch = document.createElement('span');
      swatch.className = 'model-swatch';
      swatch.style.background = cssHex(color);
      card.append(swatch, text);
      return card;
    });
    this.root.append(...this.cards);
    container.append(this.root);
  }

  set visible(on: boolean) {
    this.root.hidden = !on;
  }

  /** Center each card just above its anchor's canvas position (`points`
   * parallel to the tags; null hides that card). */
  layout(points: readonly ScreenPoint[]): void {
    const key = points
      .map((p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)}` : '-'))
      .join(';');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cards.forEach((card, i) => {
      const point = points[i] ?? null;
      card.hidden = point === null;
      if (!point) return;
      card.style.left = `${point.x}px`;
      card.style.top = `${point.y}px`;
    });
  }
}
