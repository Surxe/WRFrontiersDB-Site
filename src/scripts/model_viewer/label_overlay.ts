/**
 * Part labels over the 2D (axis) views: one card per health pool, stacked in
 * a column down the canvas's left or right edge (whichever side its part is
 * on), with a thin line to a point on the part. The viewer projects each
 * label's anchor to canvas pixels every frame; this lays the cards out and
 * draws the lines. Cards never take pointer events, so zoom/pan still work
 * through them.
 */
import { cssHex } from './colors';

export interface ViewLabel {
  /** Card content (built by view_labels.ts). */
  content: HTMLElement;
  /** Line color, 0xRRGGBB. */
  color: number;
}

/** Canvas pixels; null when the anchor is off camera. */
export type ScreenPoint = { x: number; y: number } | null;

/** Width of each label column; the 2D views keep the robot clear of it. */
export const LABEL_GUTTER_PX = 190;
const EDGE_PX = 8;
const GAP_PX = 6;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Placed {
  card: HTMLElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

export class LabelOverlay {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private placed: Placed[] = [];
  /** Last layout's input, to skip unchanged frames. */
  private lastKey = '';

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'model-view-labels';
    this.root.hidden = true;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.root.append(this.svg);
    container.append(this.root);
  }

  set visible(on: boolean) {
    this.root.hidden = !on;
  }

  get isEmpty(): boolean {
    return this.placed.length === 0;
  }

  set(labels: readonly ViewLabel[]): void {
    for (const { card } of this.placed) card.remove();
    this.svg.replaceChildren();
    this.placed = labels.map(({ content, color }) => {
      const card = document.createElement('div');
      card.className = 'model-view-label';
      card.append(content);
      this.root.append(card);
      const line = document.createElementNS(SVG_NS, 'line');
      const dot = document.createElementNS(SVG_NS, 'circle');
      line.setAttribute('stroke', cssHex(color));
      dot.setAttribute('fill', cssHex(color));
      dot.setAttribute('r', '2.5');
      this.svg.append(line, dot);
      return { card, line, dot };
    });
    this.lastKey = '';
  }

  /** Lay the cards out for their anchors' current canvas positions
   * (`points` parallel to the labels). */
  layout(points: readonly ScreenPoint[], width: number, height: number): void {
    const key =
      `${width}x${height}:` +
      points
        .map((p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)}` : '-'))
        .join(';');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.svg.setAttribute('width', String(width));
    this.svg.setAttribute('height', String(height));

    const columns: {
      left: boolean;
      items: { placed: Placed; point: { x: number; y: number } }[];
    }[] = [
      { left: true, items: [] },
      { left: false, items: [] },
    ];
    this.placed.forEach((placed, i) => {
      const point = points[i];
      const hidden = point === null;
      placed.card.hidden = hidden;
      placed.line.style.display = hidden ? 'none' : '';
      placed.dot.style.display = hidden ? 'none' : '';
      if (point)
        columns[point.x < width / 2 ? 0 : 1].items.push({ placed, point });
    });

    for (const { left, items } of columns) {
      // Top to bottom by anchor, each card centered on its anchor where it
      // fits, pushed down past the one above, then back up off the bottom.
      items.sort((a, b) => a.point.y - b.point.y);
      const heights = items.map(({ placed }) => placed.card.offsetHeight);
      const tops = items.map(({ point }, k) => point.y - heights[k] / 2);
      for (let k = 0; k < tops.length; k++) {
        const min = k === 0 ? EDGE_PX : tops[k - 1] + heights[k - 1] + GAP_PX;
        tops[k] = Math.max(tops[k], min);
      }
      for (let k = tops.length - 1; k >= 0; k--) {
        const max =
          k === tops.length - 1
            ? height - EDGE_PX - heights[k]
            : tops[k + 1] - GAP_PX - heights[k];
        tops[k] = Math.max(EDGE_PX, Math.min(tops[k], max));
      }
      items.forEach(({ placed, point }, k) => {
        const { card, line, dot } = placed;
        const cardWidth = card.offsetWidth;
        const x = left ? EDGE_PX : width - EDGE_PX - cardWidth;
        card.style.left = `${x}px`;
        card.style.top = `${tops[k]}px`;
        const endX = left ? x + cardWidth : x;
        const endY = Math.min(
          Math.max(point.y, tops[k] + 4),
          tops[k] + heights[k] - 4
        );
        line.setAttribute('x1', String(endX));
        line.setAttribute('y1', String(endY));
        line.setAttribute('x2', String(point.x));
        line.setAttribute('y2', String(point.y));
        dot.setAttribute('cx', String(point.x));
        dot.setAttribute('cy', String(point.y));
      });
    }
  }
}
