/**
 * Part labels over the 2D (axis) views: one card per health pool, with a thin
 * line to a point on the part. On a wide canvas the cards stack in a column
 * down its left or right edge (whichever side its part is on). On a narrow one
 * (a phone), side columns would squeeze the robot to a sliver, so they go in a
 * grid of rows above and below it instead (the highest parts' cards above),
 * compacted to the pool and its area, and the viewer frames the robot between
 * the two bands (`bands`).
 *
 * The viewer projects each label's anchor to canvas pixels every frame; this
 * lays the cards out and draws the lines. Cards never take pointer events, so
 * zoom/pan still work through them, and they keep clear of the controls
 * floating over the canvas (`avoid`).
 */
import { cssHex } from '../colors';

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
/** Margin between the cards and the canvas edge. */
export const EDGE_PX = 8;
const GAP_PX = 6;
/** Canvases narrower than this lay the cards out in rows, not columns. */
const ROWS_BELOW_PX = 640;
/** Narrowest card in the rows layout; the grid fits as many as it can. */
const ROW_CARD_MIN_PX = 112;

/** The rows layout's grid at one canvas width. */
interface RowGrid {
  columns: number;
  cardWidth: number;
  /** The tallest card's height: every row gets this much. */
  rowHeight: number;
  /** How many cards (those of the highest anchors) go in the top band. */
  above: number;
}

/** Bands (canvas pixels from the top and bottom edges) the rows layout fills,
 * which the robot keeps clear of. */
export interface LabelBands {
  top: number;
  bottom: number;
}
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Placed {
  card: HTMLElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

export class LabelOverlay {
  private readonly root: HTMLElement;
  private readonly svg: SVGSVGElement;
  private placed: Placed[] = [];
  /** Last layout's input, to skip unchanged frames. */
  private lastKey = '';
  /** Controls over the canvas the cards stay above or below. */
  avoid: readonly HTMLElement[] = [];

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

  /** Rows on a narrow canvas, columns on a wide one. */
  private rows(width: number): boolean {
    return width < ROWS_BELOW_PX;
  }

  /** Size every card for the rows layout at `width` and measure the grid.
   * Hidden cards measure 0, so the overlay shows for the measurement. */
  private rowGrid(width: number): RowGrid {
    const inner = width - 2 * EDGE_PX;
    const columns = Math.max(
      1,
      Math.floor((inner + GAP_PX) / (ROW_CARD_MIN_PX + GAP_PX))
    );
    const cardWidth = (inner - (columns - 1) * GAP_PX) / columns;
    // Compact cards (styled in ModelViewport.astro): no part line, which the
    // build panels show anyway.
    this.root.classList.add('is-rows');
    const wasHidden = this.root.hidden;
    this.root.hidden = false;
    let rowHeight = 0;
    for (const { card } of this.placed) {
      card.style.width = `${cardWidth}px`;
      card.style.maxWidth = 'none';
      const shown = !card.hidden;
      card.hidden = false;
      rowHeight = Math.max(rowHeight, card.offsetHeight);
      card.hidden = !shown;
    }
    this.root.hidden = wasHidden;
    // Fill the top band's rows first: the bottom one shares its edge with
    // the camera bar.
    const rowCount = Math.ceil(this.placed.length / columns);
    const above = Math.min(
      this.placed.length,
      Math.ceil(rowCount / 2) * columns
    );
    return { columns, cardWidth, rowHeight, above };
  }

  /** Height of a band of `count` cards. */
  private static bandHeight(count: number, grid: RowGrid): number {
    const rows = Math.ceil(count / grid.columns);
    return rows === 0 ? 0 : rows * (grid.rowHeight + GAP_PX);
  }

  /** In the rows layout, how far from the top and bottom edges the cards
   * reach (controls included); null for the columns layout or no labels. */
  bands(width: number, height: number): LabelBands | null {
    if (this.isEmpty || !this.rows(width)) return null;
    const grid = this.rowGrid(width);
    const edge = this.reserved(0, width, height);
    return {
      top: edge.top + LabelOverlay.bandHeight(grid.above, grid),
      bottom:
        edge.bottom +
        LabelOverlay.bandHeight(this.placed.length - grid.above, grid),
    };
  }

  /** The top and bottom bands (canvas pixels from each edge) the cards in the
   * strip `from`..`from + span` keep out of: those of the `avoid` controls
   * over the strip, each counted against the edge nearer its center. */
  private reserved(from: number, span: number, height: number) {
    const origin = this.root.getBoundingClientRect();
    let top = 0;
    let bottom = 0;
    for (const node of this.avoid) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0) continue; // hidden
      const x0 = rect.left - origin.left;
      const y0 = rect.top - origin.top;
      const y1 = rect.bottom - origin.top;
      if (x0 + rect.width <= from || x0 >= from + span) continue;
      if (y0 + y1 < height) top = Math.max(top, y1);
      else bottom = Math.max(bottom, height - y0);
    }
    return {
      top: top > 0 ? top + GAP_PX : EDGE_PX,
      bottom: bottom > 0 ? bottom + GAP_PX : EDGE_PX,
    };
  }

  /** Lay the cards out for their anchors' current canvas positions
   * (`points` parallel to the labels). */
  layout(points: readonly ScreenPoint[], width: number, height: number): void {
    const rows = this.rows(width);
    const column = LABEL_GUTTER_PX + EDGE_PX;
    const edges = rows
      ? [this.reserved(0, width, height)]
      : [
          this.reserved(0, column, height),
          this.reserved(width - column, column, height),
        ];
    const key =
      `${width}x${height}:` +
      edges.map(({ top, bottom }) => `${top},${bottom}`).join(';') +
      ':' +
      points
        .map((p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)}` : '-'))
        .join(';');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.svg.setAttribute('width', String(width));
    this.svg.setAttribute('height', String(height));

    if (rows) {
      this.layoutRows(points, width, height, edges[0]);
      return;
    }
    this.root.classList.remove('is-rows');
    const columns: {
      left: boolean;
      edge: { top: number; bottom: number };
      items: { placed: Placed; point: { x: number; y: number } }[];
    }[] = [
      { left: true, edge: edges[0], items: [] },
      { left: false, edge: edges[1], items: [] },
    ];
    this.placed.forEach((placed, i) => {
      const point = points[i];
      const hidden = point === null;
      placed.card.hidden = hidden;
      placed.line.style.display = hidden ? 'none' : '';
      placed.dot.style.display = hidden ? 'none' : '';
      placed.card.style.width = '';
      placed.card.style.maxWidth = '';
      if (point)
        columns[point.x < width / 2 ? 0 : 1].items.push({ placed, point });
    });

    for (const { left, edge, items } of columns) {
      // Top to bottom by anchor, each card centered on its anchor where it
      // fits, pushed down past the one above, then back up off the bottom.
      items.sort((a, b) => a.point.y - b.point.y);
      const heights = items.map(({ placed }) => placed.card.offsetHeight);
      const tops = items.map(({ point }, k) => point.y - heights[k] / 2);
      for (let k = 0; k < tops.length; k++) {
        const min = k === 0 ? edge.top : tops[k - 1] + heights[k - 1] + GAP_PX;
        tops[k] = Math.max(tops[k], min);
      }
      for (let k = tops.length - 1; k >= 0; k--) {
        const max =
          k === tops.length - 1
            ? height - edge.bottom - heights[k]
            : tops[k + 1] - GAP_PX - heights[k];
        tops[k] = Math.max(edge.top, Math.min(tops[k], max));
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

  /** The rows layout: the cards of the highest anchors in rows down from the
   * top, the rest in rows up from the bottom (lowest anchors in the last
   * row), each row ordered left to right by anchor and centered. */
  private layoutRows(
    points: readonly ScreenPoint[],
    width: number,
    height: number,
    edge: { top: number; bottom: number }
  ): void {
    const grid = this.rowGrid(width);
    const items: { placed: Placed; point: { x: number; y: number } }[] = [];
    this.placed.forEach((placed, i) => {
      const point = points[i];
      const hidden = point === null;
      placed.card.hidden = hidden;
      placed.line.style.display = hidden ? 'none' : '';
      placed.dot.style.display = hidden ? 'none' : '';
      if (point) items.push({ placed, point });
    });
    items.sort((a, b) => a.point.y - b.point.y);
    const above = items.slice(0, grid.above);
    // Bottom band, from the bottom row up.
    const below = items.slice(grid.above).reverse();
    const step = grid.rowHeight + GAP_PX;
    const inner = width - 2 * EDGE_PX;

    const placeBand = (band: typeof items, top: boolean): void => {
      for (let r = 0; r * grid.columns < band.length; r++) {
        const row = band
          .slice(r * grid.columns, (r + 1) * grid.columns)
          .sort((a, b) => a.point.x - b.point.x);
        const rowWidth =
          row.length * grid.cardWidth + (row.length - 1) * GAP_PX;
        const left = EDGE_PX + (inner - rowWidth) / 2;
        const y = top
          ? edge.top + r * step
          : height - edge.bottom - r * step - grid.rowHeight;
        row.forEach(({ placed, point }, k) => {
          const { card, line, dot } = placed;
          const x = left + k * (grid.cardWidth + GAP_PX);
          card.style.left = `${x}px`;
          card.style.top = `${y}px`;
          // From the card's edge facing the robot, under the anchor where
          // the card spans it.
          const endX = Math.min(
            Math.max(point.x, x + 4),
            x + grid.cardWidth - 4
          );
          const endY = top ? y + card.offsetHeight : y;
          line.setAttribute('x1', String(endX));
          line.setAttribute('y1', String(endY));
          line.setAttribute('x2', String(point.x));
          line.setAttribute('y2', String(point.y));
          dot.setAttribute('cx', String(point.x));
          dot.setAttribute('cy', String(point.y));
        });
      }
    };
    placeBand(above, true);
    placeBand(below, false);
  }
}
