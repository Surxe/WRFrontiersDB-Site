/**
 * Chaos's EPA (VectorEPA) in float32, operation for operation, for the
 * initial-overlap exit of the GJK raycast when the cores overlap
 * (GJKRaycast2ImplSimd's bComputeMTD branch, findings/chaos-sweeps.md).
 *
 * Source: UE 5.4.4 Experimental/Chaos/Public/Chaos/EPAVectorized.h
 * (VectorTEPAEntry, VectorInitializeEPA, VectorEPAComputeVisibilityBorder,
 * VectorComputeEPAResults, VectorEPA).
 *
 * The queue is sorted with std::sort, whose order between equal distances
 * is the library's: the Linux editor links UE's bundled libc++
 * (ThirdParty/Unix/LibCxx, __algorithm/sort.h). `libcxxSort` copies its
 * small-array paths (2 to 5 elements by the sorting networks, up to 30 by
 * insertion sort); a longer queue takes introsort's partitioning, which is
 * not ported: those runs are counted (`epaStats.longQueue`) and sorted
 * stably instead.
 */
import {
  closestToOrigin,
  cross,
  dot3,
  f,
  FLT_MAX,
  neg,
  scale,
  sub,
  ZERO,
  type F3,
  type SimplexState,
} from './chaos_simd';

export type EpaResult =
  | 'Ok'
  | 'MaxIterations'
  | 'BadInitialSimplex'
  | 'Degenerate'
  | 'NoValidContact';

export interface EpaOutput {
  result: EpaResult;
  penetration: number;
  dir: F3;
  witnessA: F3;
  witnessB: F3;
}

/** Runs EPA could not order exactly (a queue longer than 30). */
export const epaStats = { runs: 0, longQueue: 0 };

interface Entry {
  normal: F3;
  distance: number;
  idx: [number, number, number];
  adjFaces: [number, number, number];
  adjEdges: [number, number, number];
  obsolete: boolean;
  /** Initialize() succeeded at least once (garbage otherwise, as in UE). */
  valid: boolean;
}

const blank = (): Entry => ({
  normal: [0, 0, 0],
  distance: 0,
  idx: [0, 0, 0],
  adjFaces: [0, 0, 0],
  adjEdges: [0, 0, 0],
  obsolete: false,
  valid: false,
});

const minkowski = (va: F3[], vb: F3[], i: number): F3 => sub(va[i], vb[i]);

/** VectorTEPAEntry::Initialize. */
function initialize(
  e: Entry,
  va: F3[],
  vb: F3[],
  i0: number,
  i1: number,
  i2: number,
  adjFaces: [number, number, number],
  adjEdges: [number, number, number]
): boolean {
  const v0 = minkowski(va, vb, i0);
  const v1 = minkowski(va, vb, i1);
  const v2 = minkowski(va, vb, i2);
  const n = cross(sub(v1, v0), sub(v2, v0));
  const lenSq = dot3(n, n);
  if (f(1e-4) > lenSq) return false;
  e.normal = scale(n, f(1 / f(Math.sqrt(lenSq))));
  e.idx = [i0, i1, i2];
  e.adjFaces = adjFaces;
  e.adjEdges = adjEdges;
  e.distance = dot3(e.normal, v0);
  e.obsolete = false;
  e.valid = true;
  return true;
}

/** VectorTEPAEntry::SwapWinding. */
function swapWinding(e: Entry, entries: Entry[]): void {
  const t = e.idx[0];
  e.idx[0] = e.idx[1];
  e.idx[1] = t;
  const update = (oldI: number, newI: number) => {
    entries[e.adjFaces[oldI]].adjEdges[e.adjEdges[oldI]] = newI;
  };
  update(1, 2);
  update(2, 1);
  let s = e.adjFaces[1];
  e.adjFaces[1] = e.adjFaces[2];
  e.adjFaces[2] = s;
  s = e.adjEdges[1];
  e.adjEdges[1] = e.adjEdges[2];
  e.adjEdges[2] = s;
  e.normal = neg(e.normal);
  e.distance = -e.distance;
}

const distanceToPlane = (e: Entry, x: F3): number =>
  f(dot3(e.normal, x) - e.distance);

/** VectorTEPAEntry::IsOriginProjectedInside with Epsilon 0. */
function originProjectedInside(e: Entry, va: F3[], vb: F3[]): boolean {
  const pn = scale(e.normal, e.distance);
  const pa = sub(minkowski(va, vb, e.idx[0]), pn);
  const pb = sub(minkowski(va, vb, e.idx[1]), pn);
  const pc = sub(minkowski(va, vb, e.idx[2]), pn);
  const pac = dot3(cross(pa, pc), e.normal);
  const pcb = dot3(cross(pc, pb), e.normal);
  const pba = dot3(cross(pb, pa), e.normal);
  const false1 = (0 > pac && pcb > 0) || (pac > 0 && 0 > pcb);
  const false2 = (0 > pac && pba > 0) || (pac > 0 && 0 > pba);
  return !(false1 || false2);
}

type Support = (d: F3) => F3;

/** VectorInitializeEPA. */
function initializeEpa(
  va: F3[],
  vb: F3[],
  supA: Support,
  supB: Support,
  entries: Entry[],
  touch: { n: F3 }
): boolean {
  const numVerts = va.length;
  const addFartherPoint = (dir: F3) => {
    const negDir = neg(dir);
    const a0 = supA(dir);
    const a1 = supA(negDir);
    const b0 = supB(negDir);
    const b1 = supB(dir);
    const dist0 = dot3(sub(a0, b0), dir);
    const dist1 = dot3(sub(a1, b1), negDir);
    if (dist1 >= dist0) {
      va.push(a1);
      vb.push(b1);
    } else {
      va.push(a0);
      vb.push(b0);
    }
  };
  for (let i = 0; i < 4; i++) entries.push(blank());
  touch.n = [0, 0, 1];
  let valid = false;
  const four = () => {
    let ok = initialize(entries[0], va, vb, 1, 2, 3, [3, 1, 2], [1, 1, 1]);
    ok = initialize(entries[1], va, vb, 0, 3, 2, [2, 0, 3], [2, 1, 0]) && ok;
    ok = initialize(entries[2], va, vb, 0, 1, 3, [3, 0, 1], [2, 2, 0]) && ok;
    return ok;
  };
  switch (numVerts) {
    case 1:
    case 2: {
      if (numVerts === 1) addFartherPoint(touch.n);
      const dir = sub(minkowski(va, vb, 1), minkowski(va, vb, 0));
      if (dot3(dir, dir) > f(1e-4)) {
        const ax = Math.abs(dir[0]);
        const ay = Math.abs(dir[1]);
        const az = Math.abs(dir[2]);
        const axis01: F3 = ax > ay ? [0, 1, 0] : [1, 0, 0];
        const axis02: F3 = ax > az ? [0, 0, 1] : [1, 0, 0];
        const other = ay > az ? axis02 : axis01;
        const orthog = cross(dir, other);
        const orthog2 = cross(orthog, dir);
        addFartherPoint(orthog);
        addFartherPoint(orthog2);
        valid = four();
        valid =
          initialize(entries[3], va, vb, 0, 2, 1, [1, 0, 2], [2, 0, 0]) &&
          valid;
        if (!valid) {
          const l = f(1 / f(Math.sqrt(dot3(orthog, orthog))));
          touch.n = scale(orthog, l);
          return false;
        }
      } else {
        return false;
      }
      break;
    }
    case 3: {
      valid = initialize(entries[3], va, vb, 0, 2, 1, [1, 0, 2], [2, 0, 0]);
      if (valid) {
        const base = entries[3];
        addFartherPoint(base.normal);
        valid = four();
        if (!valid) {
          touch.n = base.normal;
          return false;
        }
      }
      break;
    }
    case 4: {
      valid = four();
      valid =
        initialize(entries[3], va, vb, 0, 2, 1, [1, 0, 2], [2, 0, 0]) && valid;
      break;
    }
    default:
      break;
  }
  if (valid) {
    let maxSigned = 0;
    for (const e of entries) {
      if (Math.abs(e.distance) > Math.abs(maxSigned)) maxSigned = e.distance;
    }
    if (0 > maxSigned) for (const e of entries) swapWinding(e, entries);
  }
  return valid;
}

/** VectorEPAComputeVisibilityBorder. */
function visibilityBorder(
  entries: Entry[],
  entryIdx: number,
  w: F3,
  border: { entry: number; edge: number }[]
): void {
  const stack: { entry: number; edge: number }[] = [];
  const e0 = entries[entryIdx];
  for (let i = 0; i < 3; i++)
    stack.push({ entry: e0.adjFaces[i], edge: e0.adjEdges[i] });
  let iteration = 0;
  while (stack.length && iteration++ < 10000) {
    const flood = stack.pop()!;
    const e = entries[flood.entry];
    if (e.obsolete) continue;
    if (0 > distanceToPlane(e, w)) {
      border.push(flood);
    } else {
      e.obsolete = true;
      const i1 = (flood.edge + 1) % 3;
      const i2 = (flood.edge + 2) % 3;
      stack.push({ entry: e.adjFaces[i1], edge: e.adjEdges[i1] });
      stack.push({ entry: e.adjFaces[i2], edge: e.adjEdges[i2] });
    }
  }
}

/** VectorComputeEPAResults. */
function computeResults(va: F3[], vb: F3[], e: Entry): EpaOutput {
  const as: F3[] = [va[e.idx[0]], va[e.idx[1]], va[e.idx[2]], ZERO];
  const bs: F3[] = [vb[e.idx[0]], vb[e.idx[1]], vb[e.idx[2]], ZERO];
  const st: SimplexState = {
    s: [sub(as[0], bs[0]), sub(as[1], bs[1]), sub(as[2], bs[2]), ZERO],
    as: as as SimplexState['as'],
    bs: bs as SimplexState['bs'],
    n: 3,
    bary: [0, 0, 0, 0],
  };
  let dir = closestToOrigin(st);
  let pen = f(Math.sqrt(dot3(dir, dir)));
  if (f(1e-4) > pen) {
    dir = e.normal;
    if (0 > e.distance) pen = -pen;
  } else {
    dir = [f(dir[0] / pen), f(dir[1] / pen), f(dir[2] / pen)];
    if (0 > e.distance) {
      dir = neg(dir);
      pen = -pen;
    }
  }
  let a: F3 = [0, 0, 0];
  let b: F3 = [0, 0, 0];
  for (let i = 0; i < st.n; i++) {
    const w = st.bary[i];
    a = [
      f(f(st.as[i][0] * w) + a[0]),
      f(f(st.as[i][1] * w) + a[1]),
      f(f(st.as[i][2] * w) + a[2]),
    ];
    b = [
      f(f(st.bs[i][0] * w) + b[0]),
      f(f(st.bs[i][1] * w) + b[1]),
      f(f(st.bs[i][2] * w) + b[2]),
    ];
  }
  return {
    result: 'Ok',
    penetration: pen,
    dir,
    witnessA: a,
    witnessB: b,
  };
}

/**
 * libc++'s std::sort (UE's bundled ThirdParty/Unix/LibCxx) for up to 30
 * elements: the 2- to 5-element networks (__sort3, __sort4, __sort5) and
 * __insertion_sort_3. `less(a, b)` is the comparator. Returns false when
 * the array is longer (introsort, not ported).
 */
export function libcxxSort<T>(
  arr: T[],
  less: (a: T, b: T) => boolean
): boolean {
  const n = arr.length;
  const swap = (i: number, j: number) => {
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  };
  const sort3 = (x: number, y: number, z: number) => {
    if (!less(arr[y], arr[x])) {
      if (!less(arr[z], arr[y])) return;
      swap(y, z);
      if (less(arr[y], arr[x])) swap(x, y);
      return;
    }
    if (less(arr[z], arr[y])) {
      swap(x, z);
      return;
    }
    swap(x, y);
    if (less(arr[z], arr[y])) swap(y, z);
  };
  const sort4 = (a: number, b: number, c: number, d: number) => {
    sort3(a, b, c);
    if (less(arr[d], arr[c])) {
      swap(c, d);
      if (less(arr[c], arr[b])) {
        swap(b, c);
        if (less(arr[b], arr[a])) swap(a, b);
      }
    }
  };
  switch (n) {
    case 0:
    case 1:
      return true;
    case 2:
      if (less(arr[1], arr[0])) swap(0, 1);
      return true;
    case 3:
      sort3(0, 1, 2);
      return true;
    case 4:
      sort4(0, 1, 2, 3);
      return true;
    case 5:
      sort4(0, 1, 2, 3);
      if (less(arr[4], arr[3])) {
        swap(3, 4);
        if (less(arr[3], arr[2])) {
          swap(2, 3);
          if (less(arr[2], arr[1])) {
            swap(1, 2);
            if (less(arr[1], arr[0])) swap(0, 1);
          }
        }
      }
      return true;
  }
  if (n > 30) return false;
  // __insertion_sort_3
  let j = 2;
  sort3(0, 1, 2);
  for (let i = j + 1; i < n; i++) {
    if (less(arr[i], arr[j])) {
      const t = arr[i];
      let k = j;
      j = i;
      do {
        arr[j] = arr[k];
        j = k;
      } while (j !== 0 && less(t, arr[--k]));
      arr[j] = t;
    }
    j = i;
  }
  return true;
}

/**
 * VectorEPA: `va`, `vb` are GJK's final simplex (A's supports, and B's
 * supports moved to the start point), extended in place; `supA`, `supB`
 * the support functions (B's at the start point).
 */
export function vectorEpa(
  va: F3[],
  vb: F3[],
  supA: Support,
  supB: Support
): EpaOutput {
  epaStats.runs++;
  const epsRelPlusOne = f(1 + f(1e-2));
  const entries: Entry[] = [];
  const touch = { n: [0, 0, 1] as F3 };
  if (!initializeEpa(va, vb, supA, supB, entries, touch)) {
    return {
      result: 'BadInitialSimplex',
      penetration: 0,
      dir: touch.n,
      witnessA: [0, 0, 0],
      witnessB: [0, 0, 0],
    };
  }
  const queue: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (0 >= entries[i].distance || originProjectedInside(entries[i], va, vb))
      queue.push(i);
  }
  const copy = (e: Entry): Entry => ({
    ...e,
    idx: [...e.idx] as Entry['idx'],
  });
  let last = copy(
    queue.length > 0 ? entries[queue[queue.length - 1]] : entries[0]
  );
  let upper = FLT_MAX;
  let lower = -FLT_MAX;
  let dirty = true;
  let iteration = 0;
  let result: EpaResult = 'MaxIterations';
  const less = (l: number, r: number) =>
    entries[l].distance > entries[r].distance;
  while (queue.length && iteration++ < 128) {
    if (dirty) {
      if (!libcxxSort(queue, less)) {
        epaStats.longQueue++;
        const stable = queue
          .map((v, i) => ({ v, i }))
          .sort((x, y) =>
            less(x.v, y.v) ? -1 : less(y.v, x.v) ? 1 : x.i - y.i
          );
        for (let i = 0; i < stable.length; i++) queue[i] = stable[i].v;
      }
      dirty = false;
    }
    const entryIdx = queue.pop()!;
    const entry = entries[entryIdx];
    if (entry.obsolete) continue;
    if (entry.distance > upper) {
      result = 'Ok';
      break;
    }
    const aSup = supA(entry.normal);
    const bSup = supB(neg(entry.normal));
    const w = sub(aSup, bSup);
    const distToSupport = dot3(entry.normal, w);
    upper = distToSupport < upper ? distToSupport : upper;
    lower = entry.distance;
    const tolerance = f(epsRelPlusOne * Math.abs(lower));
    if (upper <= tolerance) {
      result = 'Ok';
      last = copy(entry);
      break;
    }
    if (lower > upper) {
      result = 'Ok';
      break;
    }
    last = copy(entry);
    const newVert = va.length;
    va.push(aSup);
    vb.push(bSup);
    entry.obsolete = true;
    const border: { entry: number; edge: number }[] = [];
    visibilityBorder(entries, entryIdx, w, border);
    const numBorder = border.length;
    const first = entries.length;
    let newIdx = first;
    for (let i = 0; i < numBorder; i++) entries.push(blank());
    if (numBorder >= 3) {
      let terminate = false;
      for (let vi = 0; vi < numBorder; vi++) {
        const info = border[vi];
        const ne = entries[newIdx];
        const be = entries[info.entry];
        const e0 = info.edge;
        const e1 = (e0 + 1) % 3;
        const next = vi + 1 < numBorder ? newIdx + 1 : first;
        const prev = newIdx > first ? newIdx - 1 : first + numBorder - 1;
        const ok = initialize(
          ne,
          va,
          vb,
          be.idx[e1],
          be.idx[e0],
          newVert,
          [info.entry, prev, next],
          [e0, 2, 1]
        );
        be.adjFaces[e0] = newIdx;
        be.adjEdges[e0] = 0;
        if (!ok) {
          result = 'Degenerate';
          terminate = true;
          break;
        }
        if (upper >= ne.distance) {
          if (0 >= ne.distance || originProjectedInside(ne, va, vb)) {
            queue.push(newIdx);
            dirty = true;
          }
        }
        newIdx++;
      }
      if (terminate) break;
    } else {
      result = 'Degenerate';
      break;
    }
  }
  const out = computeResults(va, vb, last);
  out.result = result;
  return out;
}
