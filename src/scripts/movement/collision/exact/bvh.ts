/**
 * A static bounding-volume hierarchy over axis-aligned boxes, the exact
 * layer's broad phase: it answers "which colliders' boxes overlap this
 * box", nothing more. Built once (spatial-median split on the longest
 * centroid axis, object median when that fails), queried with a stack.
 */

const LEAF_SIZE = 4;

export class Bvh {
  /** Per node: min xyz, max xyz. */
  private readonly nodeBounds: Float64Array;
  /** Per node: first child index (internal) or -1 (leaf). */
  private readonly nodeChild: Int32Array;
  /** Per leaf: first item in `order`, item count. */
  private readonly nodeFirst: Int32Array;
  private readonly nodeCount: Int32Array;
  private readonly order: Int32Array;
  private nodes = 0;
  private readonly stack = new Int32Array(512);

  /** `bounds`: 6 numbers per item (min xyz, max xyz). */
  constructor(
    private readonly bounds: Float64Array,
    readonly count: number
  ) {
    const capacity = 2 * count + 1;
    this.nodeBounds = new Float64Array(capacity * 6);
    this.nodeChild = new Int32Array(capacity);
    this.nodeFirst = new Int32Array(capacity);
    this.nodeCount = new Int32Array(capacity);
    this.order = new Int32Array(count);
    for (let i = 0; i < count; i++) this.order[i] = i;
    const centroids = new Float64Array(count * 3);
    for (let i = 0; i < count; i++)
      for (let k = 0; k < 3; k++)
        centroids[i * 3 + k] = (bounds[i * 6 + k] + bounds[i * 6 + 3 + k]) / 2;
    this.nodes = 1;
    if (count > 0) this.build(0, 0, count, centroids);
    else this.nodeChild[0] = -1;
  }

  private build(
    node: number,
    start: number,
    end: number,
    centroids: Float64Array
  ): void {
    const b = this.bounds;
    const nb = this.nodeBounds;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMinZ = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;
    let cMaxZ = -Infinity;
    for (let i = start; i < end; i++) {
      const item = this.order[i];
      minX = Math.min(minX, b[item * 6]);
      minY = Math.min(minY, b[item * 6 + 1]);
      minZ = Math.min(minZ, b[item * 6 + 2]);
      maxX = Math.max(maxX, b[item * 6 + 3]);
      maxY = Math.max(maxY, b[item * 6 + 4]);
      maxZ = Math.max(maxZ, b[item * 6 + 5]);
      cMinX = Math.min(cMinX, centroids[item * 3]);
      cMinY = Math.min(cMinY, centroids[item * 3 + 1]);
      cMinZ = Math.min(cMinZ, centroids[item * 3 + 2]);
      cMaxX = Math.max(cMaxX, centroids[item * 3]);
      cMaxY = Math.max(cMaxY, centroids[item * 3 + 1]);
      cMaxZ = Math.max(cMaxZ, centroids[item * 3 + 2]);
    }
    nb[node * 6] = minX;
    nb[node * 6 + 1] = minY;
    nb[node * 6 + 2] = minZ;
    nb[node * 6 + 3] = maxX;
    nb[node * 6 + 4] = maxY;
    nb[node * 6 + 5] = maxZ;
    const count = end - start;
    if (count <= LEAF_SIZE) {
      this.nodeChild[node] = -1;
      this.nodeFirst[node] = start;
      this.nodeCount[node] = count;
      return;
    }
    const ex = cMaxX - cMinX;
    const ey = cMaxY - cMinY;
    const ez = cMaxZ - cMinZ;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const split =
      axis === 0
        ? (cMinX + cMaxX) / 2
        : axis === 1
          ? (cMinY + cMaxY) / 2
          : (cMinZ + cMaxZ) / 2;
    // Partition around the spatial median.
    let i = start;
    let j = end - 1;
    while (i <= j) {
      if (centroids[this.order[i] * 3 + axis] < split) i++;
      else {
        const t = this.order[i];
        this.order[i] = this.order[j];
        this.order[j] = t;
        j--;
      }
    }
    let mid = i;
    if (mid === start || mid === end) {
      // All centroids on one side: split by count instead.
      const sorted = Array.from(this.order.subarray(start, end)).sort(
        (p, q) => centroids[p * 3 + axis] - centroids[q * 3 + axis]
      );
      this.order.set(sorted, start);
      mid = (start + end) >> 1;
    }
    const left = this.nodes;
    this.nodes += 2;
    this.nodeChild[node] = left;
    this.build(left, start, mid, centroids);
    this.build(left + 1, mid, end, centroids);
  }

  /** Call `visit` for every item whose box overlaps [min, max]. */
  query(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    visit: (item: number) => void
  ): void {
    if (this.count === 0) return;
    const nb = this.nodeBounds;
    const b = this.bounds;
    const stack = this.stack;
    let top = 0;
    stack[top++] = 0;
    while (top > 0) {
      const node = stack[--top];
      const o = node * 6;
      if (
        nb[o] > maxX ||
        nb[o + 3] < minX ||
        nb[o + 1] > maxY ||
        nb[o + 4] < minY ||
        nb[o + 2] > maxZ ||
        nb[o + 5] < minZ
      )
        continue;
      const child = this.nodeChild[node];
      if (child >= 0) {
        stack[top++] = child;
        stack[top++] = child + 1;
        continue;
      }
      const first = this.nodeFirst[node];
      const last = first + this.nodeCount[node];
      for (let k = first; k < last; k++) {
        const item = this.order[k];
        const ib = item * 6;
        if (
          b[ib] > maxX ||
          b[ib + 3] < minX ||
          b[ib + 1] > maxY ||
          b[ib + 4] < minY ||
          b[ib + 2] > maxZ ||
          b[ib + 5] < minZ
        )
          continue;
        visit(item);
      }
    }
  }
}
