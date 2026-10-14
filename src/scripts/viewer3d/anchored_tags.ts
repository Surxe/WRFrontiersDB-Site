/**
 * Cards that follow points in the 3D scene: the viewer projects each card's
 * anchor to canvas pixels every frame (Stage.toScreen) and hands the points to
 * `layout`, which only moves the cards. How a card looks and where it sits
 * relative to its point is the page's CSS (e.g. centered just above it).
 */

/** A canvas position in CSS pixels, or null when off camera. */
export type ScreenPoint = { x: number; y: number } | null;

export class AnchoredTags {
  private readonly root: HTMLElement;
  private cards: HTMLElement[] = [];
  /** Last layout's input, to skip unchanged frames. */
  private lastKey = '';

  /** @param className the overlay's class, laid over `container` by CSS */
  constructor(container: HTMLElement, className: string) {
    this.root = document.createElement('div');
    this.root.className = className;
    this.root.hidden = true;
    container.append(this.root);
  }

  /** Replace the cards (in anchor order). */
  setCards(cards: readonly HTMLElement[]): void {
    this.cards = [...cards];
    this.root.replaceChildren(...this.cards);
    this.lastKey = '';
  }

  set visible(on: boolean) {
    this.root.hidden = !on;
  }

  /** Place each card at its anchor's canvas position (`points` parallel to
   * the cards; null hides that card). */
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
