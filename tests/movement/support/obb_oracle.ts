/**
 * Test oracle: an exact float64 CollisionWorld for oriented boxes, slow and
 * simple, ported from the mvp-prep prototype
 * (/srv/dev/repos/wrf-movement-ref/compare/exact_obb_world.mts, with its
 * CHAOS_TIE rules always on). On it the engine port matched every UE box
 * trace (findings/engine-port-collision-queries.md), so the production
 * layer (src/scripts/movement/collision/exact/) is checked against it.
 *
 * The capsule is a vertical segment (half length a) plus radius r. The
 * signed distance to a box is convex, so h(t) = min over the segment of
 * the distance at time t, minus r, is convex in t: golden-section for its
 * minimum, then bisection for the first root.
 */
import type { Vec3 } from '../../../src/scripts/movement/math/vec';
import type {
  Capsule,
  CollisionWorld,
  QueryHit,
  QueryStats,
  SweepOptions,
} from '../../../src/scripts/movement/collision/world';

type V = [number, number, number];
export interface Obb {
  name: string;
  c: V;
  ax: [V, V, V];
  e: V;
}

const PENETRATION_TOLERANCE = 0.01;
const KINDA_SMALL = 1e-4;
const GOLD = (Math.sqrt(5) - 1) / 2;

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addS = (a: V, b: V, s: number): V => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const toV = (v: Vec3): V => [v.x, v.y, v.z];
const toVec = (v: V): Vec3 => ({ x: v[0], y: v[1], z: v[2] });

export function obbFromQuat(
  name: string,
  c: V,
  e: V,
  q: [number, number, number, number]
): Obb {
  const [x, y, z, w] = q;
  const rot = (v: V): V => {
    const cx = y * v[2] - z * v[1];
    const cy = z * v[0] - x * v[2];
    const cz = x * v[1] - y * v[0];
    const ccx = y * cz - z * cy;
    const ccy = z * cx - x * cz;
    const ccz = x * cy - y * cx;
    return [
      v[0] + 2 * (w * cx + ccx),
      v[1] + 2 * (w * cy + ccy),
      v[2] + 2 * (w * cz + ccz),
    ];
  };
  return { name, c, e, ax: [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])] };
}

function sdBox(b: Obb, x: V): { d: number; q: V } {
  const r = sub(x, b.c);
  const l: V = [dot(r, b.ax[0]), dot(r, b.ax[1]), dot(r, b.ax[2])];
  const inside =
    Math.abs(l[0]) <= b.e[0] &&
    Math.abs(l[1]) <= b.e[1] &&
    Math.abs(l[2]) <= b.e[2];
  if (!inside) {
    const cl = [0, 1, 2].map((i) =>
      Math.max(-b.e[i], Math.min(b.e[i], l[i]))
    ) as V;
    let q = b.c;
    for (let i = 0; i < 3; i++) q = addS(q, b.ax[i], cl[i]);
    return { d: len(sub(x, q)), q };
  }
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < 3; i++) {
    const g = b.e[i] - Math.abs(l[i]);
    if (g < bestGap) {
      bestGap = g;
      best = i;
    }
  }
  const cl: V = [...l];
  cl[best] = Math.sign(l[best] || 1) * b.e[best];
  let q = b.c;
  for (let i = 0; i < 3; i++) q = addS(q, b.ax[i], cl[i]);
  return { d: -bestGap, q };
}

function golden(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iters = 90
): number {
  let a = lo;
  let b = hi;
  let c = b - GOLD * (b - a);
  let d = a + GOLD * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iters && b - a > 1e-12; i++) {
    if (fc <= fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLD * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLD * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

export class ObbOracleWorld implements CollisionWorld {
  private stats: QueryStats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };
  constructor(readonly boxes: Obb[]) {}

  takeStats(): QueryStats {
    const s = this.stats;
    this.stats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };
    return s;
  }

  private segMin(
    b: Obb,
    p: V,
    a: number
  ): { g: number; s: number; q: V; x: V } {
    const f = (s: number) => sdBox(b, [p[0], p[1], p[2] + s]).d;
    let s = a > 0 ? golden(f, -a, a) : 0;
    // Chaos TSegment::SupportCore: an orthogonal direction takes the top end.
    if (a > 0 && f(a) <= f(s) + 1e-9) s = a;
    const x: V = [p[0], p[1], p[2] + s];
    const r = sdBox(b, x);
    return { g: r.d, s, q: r.q, x };
  }

  private hitFields(b: Obb, p: V, a: number, r: number, dir: V) {
    const m = this.segMin(b, p, a);
    let n = sub(m.x, m.q);
    const nl = len(n);
    if (m.g < 0 || nl < 1e-12) {
      const rr = sub(m.x, b.c);
      let best = 0;
      let gap = Infinity;
      for (let i = 0; i < 3; i++) {
        const g = b.e[i] - Math.abs(dot(rr, b.ax[i]));
        if (g < gap) {
          gap = g;
          best = i;
        }
      }
      const sgn = Math.sign(dot(rr, b.ax[best]) || 1);
      n = b.ax[best].map((v) => v * sgn) as V;
    } else n = n.map((v) => v / nl) as V;
    const ln: V = [dot(n, b.ax[0]), dot(n, b.ax[1]), dot(n, b.ax[2])];
    const ld: V = [dot(dir, b.ax[0]), dot(dir, b.ax[1]), dot(dir, b.ax[2])];
    let bestDot = Infinity;
    let best: V = n;
    for (let i = 0; i < 3; i++) {
      if (ln[i] > KINDA_SMALL && ld[i] < bestDot) {
        bestDot = ld[i];
        best = b.ax[i];
      } else if (ln[i] < -KINDA_SMALL && -ld[i] < bestDot) {
        bestDot = -ld[i];
        best = b.ax[i].map((v) => -v) as V;
      }
    }
    const surface = addS(m.x, n, -(m.g < 0 ? 0 : m.g));
    const ip = (m.g < 0 ? m.q : surface).map((v) => Math.fround(v)) as V;
    return { normal: n, impactPoint: ip, impactNormal: best, depth: r - m.g };
  }

  sweepCapsule(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    options: SweepOptions = {}
  ): QueryHit | null {
    this.stats.sweeps++;
    const p0 = toV(start);
    const d = sub(toV(end), p0);
    const r = capsule.radius;
    const a = Math.max(0, capsule.halfHeight - r);
    let best: QueryHit | null = null;
    for (const b of this.boxes) {
      const h = (t: number) => this.segMin(b, addS(p0, d, t), a).g - r;
      const h0 = h(0);
      if (h0 < -PENETRATION_TOLERANCE) {
        const hf = this.hitFields(b, p0, a, r, d);
        if (options.ignoreOverlapsMovingOut && dot(d, hf.normal) > 0) continue;
        const hit: QueryHit = {
          time: 0,
          location: start,
          impactPoint: toVec(hf.impactPoint),
          normal: toVec(hf.normal),
          impactNormal: toVec(hf.impactNormal),
          startPenetrating: true,
          penetrationDepth: hf.depth,
        };
        if (!best || !best.startPenetrating || hf.depth > best.penetrationDepth)
          best = hit;
        continue;
      }
      if (best && best.time === 0) continue;
      let t: number;
      if (h0 <= PENETRATION_TOLERANCE) {
        if (len(d) === 0 || h(Math.min(1, 1e-6)) >= h0) continue;
        t = 0;
      } else {
        if (len(d) === 0) continue;
        const tm = golden(h, 0, 1);
        if (Math.min(h(tm), h(1)) > 0) continue;
        let lo = 0;
        let hi = h(tm) <= 0 ? tm : 1;
        for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
          const mid = (lo + hi) / 2;
          if (h(mid) > 0) lo = mid;
          else hi = mid;
        }
        t = lo;
      }
      if (best && best.time <= t) continue;
      const loc = addS(p0, d, t);
      const hf = this.hitFields(b, loc, a, r, d);
      best = {
        time: t,
        location: toVec(loc),
        impactPoint: toVec(hf.impactPoint),
        normal: toVec(hf.normal),
        impactNormal: toVec(hf.impactNormal),
        startPenetrating: false,
        penetrationDepth: 0,
      };
    }
    return best;
  }

  lineTrace(start: Vec3, end: Vec3): QueryHit | null {
    this.stats.lineTraces++;
    const o = toV(start);
    const d = sub(toV(end), o);
    let best: QueryHit | null = null;
    for (const b of this.boxes) {
      const ro = sub(o, b.c);
      let t0 = -Infinity;
      let t1 = Infinity;
      let axis = -1;
      let sgn = 1;
      let miss = false;
      for (let i = 0; i < 3; i++) {
        const lo = dot(ro, b.ax[i]);
        const ld = dot(d, b.ax[i]);
        if (Math.abs(ld) < 1e-15) {
          if (Math.abs(lo) > b.e[i]) {
            miss = true;
            break;
          }
          continue;
        }
        let ta = (-b.e[i] - lo) / ld;
        let tb = (b.e[i] - lo) / ld;
        let s = -1;
        if (ta > tb) {
          [ta, tb] = [tb, ta];
          s = 1;
        }
        if (ta > t0) {
          t0 = ta;
          axis = i;
          sgn = s;
        }
        t1 = Math.min(t1, tb);
      }
      if (miss || t0 > t1 || t1 < 0 || t0 > 1) continue;
      const t = Math.max(0, t0);
      if (best && best.time <= t) continue;
      const pt = addS(o, d, t);
      const n =
        axis >= 0 ? (b.ax[axis].map((v) => v * sgn) as V) : ([0, 0, 1] as V);
      best = {
        time: t,
        location: toVec(pt),
        impactPoint: toVec(pt),
        normal: toVec(n),
        impactNormal: toVec(n),
        startPenetrating: t0 < 0,
        penetrationDepth: 0,
      };
    }
    return best;
  }

  overlapCapsule(position: Vec3, capsule: Capsule): boolean {
    this.stats.overlaps++;
    const p = toV(position);
    const a = Math.max(0, capsule.halfHeight - capsule.radius);
    return this.boxes.some((b) => this.segMin(b, p, a).g < capsule.radius);
  }
}
