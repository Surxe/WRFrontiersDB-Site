/**
 * The exact collision layer per shape: boxes against the float64 box
 * oracle (support/obb_oracle.ts, the mvp-prep prototype the engine port
 * matched UE on), the other shapes against analytic cases, and the Chaos
 * hit rules (findings/engine-port-collision-queries.md item 3, 6).
 */
import { describe, expect, it } from 'vitest';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import {
  emptyColliderSet,
  rotate,
  type ColliderSet,
  type Quat,
  type V3,
} from '../../src/scripts/movement/collision/exact/colliders';
import { convexHull } from '../../src/scripts/movement/collision/exact/hull';
import {
  boxSupport,
  chaosConvexSweep,
} from '../../src/scripts/movement/collision/exact/chaos_gjk';
import type { QueryHit } from '../../src/scripts/movement/collision/world';
import { vec, type Vec3 } from '../../src/scripts/movement/math/vec';
import { ObbOracleWorld, obbFromQuat } from './support/obb_oracle';

const info = { source: 'test', flags: 0 };
const world = (set: Partial<ColliderSet>) =>
  new ExactCollisionWorld({ ...emptyColliderSet(), ...set });
const yawQuat = (deg: number): Quat => {
  const h = (deg * Math.PI) / 360;
  return [0, 0, Math.sin(h), Math.cos(h)];
};
const tiltQuat = (deg: number): Quat => {
  const h = (deg * Math.PI) / 360;
  return [Math.sin(h), 0, 0, Math.cos(h)];
};
const mulQuat = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const near = (a: Vec3, b: Vec3, tol: number) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= tol;

/** A deterministic random stream (tests must be reproducible). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CAPSULE = { radius: 600, halfHeight: 700 };

describe('boxes against the float64 oracle', () => {
  const boxes = [
    {
      c: [0, 0, -500] as V3,
      e: [20000, 20000, 500] as V3,
      q: [0, 0, 0, 1] as Quat,
    },
    { c: [5000, 0, 1500] as V3, e: [150, 8000, 1500] as V3, q: yawQuat(45) },
    {
      c: [-3000, 2500, 300] as V3,
      e: [800, 600, 300] as V3,
      q: mulQuat(yawQuat(30), tiltQuat(20)),
    },
  ];
  const exact = world({
    boxes: boxes.map((b) => ({
      center: b.c,
      rotation: b.q,
      halfExtents: b.e,
      info,
    })),
  });
  const oracle = new ObbOracleWorld(
    boxes.map((b, i) => obbFromQuat(`b${i}`, [...b.c], [...b.e], [...b.q]))
  );

  const compare = (a: QueryHit | null, b: QueryHit | null, label: string) => {
    expect(a === null, `${label}: hit or miss`).toBe(b === null);
    if (!a || !b) return;
    expect(a.startPenetrating, label).toBe(b.startPenetrating);
    // The oracle bisects to 1e-15 of the move; normals from golden-section
    // searches are good to about 1e-6.
    expect(Math.abs(a.time - b.time), `${label}: time`).toBeLessThan(1e-7);
    expect(near(a.normal, b.normal, 1e-5), `${label}: normal`).toBe(true);
    // A starting overlap reports ImpactNormal = Normal, the MTD direction
    // (UE ConvertOverlappedShapeToImpactHit); the oracle applies the box
    // face rule there too, so compare it with the face rule for hits only.
    if (a.startPenetrating)
      expect(
        near(a.impactNormal, a.normal, 0),
        `${label}: overlap impact normal`
      ).toBe(true);
    else
      expect(
        near(a.impactNormal, b.impactNormal, 1e-5),
        `${label}: impact normal`
      ).toBe(true);
    // A starting overlap's impact point is not defined by a unique closest
    // pair (and UE derives it from its own MTD); compare it for hits only.
    // On a contact parallel to the capsule axis the layer reports Chaos's
    // float32 point (session 3.5): somewhere on the core's span of the
    // contact line, where the oracle has its top end. Check the line. On a
    // vertical edge Chaos's simplex is degenerate and its point lands off
    // the edge (0.06 cm here; 0.16 cm in UE's own hull_pillar_slide), so
    // edges get that allowance; the UE fixtures check the point bit for
    // bit (chaos_contact.ts).
    if (!a.startPenetrating && a.normal.z === 0) {
      const core = CAPSULE.halfHeight - CAPSULE.radius;
      const onFace = near(a.normal, a.impactNormal, 1e-6);
      expect(
        Math.hypot(
          a.impactPoint.x - b.impactPoint.x,
          a.impactPoint.y - b.impactPoint.y
        ),
        `${label}: parallel contact, impact point on the contact line`
      ).toBeLessThan(onFace ? 1e-2 : 0.25);
      expect(
        Math.abs(a.impactPoint.z - a.location.z),
        `${label}: parallel contact, impact point within the core`
      ).toBeLessThanOrEqual(core + 1e-2);
    } else if (!a.startPenetrating)
      expect(
        near(a.impactPoint, b.impactPoint, 1e-3),
        `${label}: impact point`
      ).toBe(true);
    if (a.startPenetrating)
      expect(
        Math.abs(a.penetrationDepth - b.penetrationDepth),
        `${label}: depth`
      ).toBeLessThan(1e-6);
  };

  it('sweeps agree on random moves (time, normals, impact point, overlaps)', () => {
    const random = rng(7);
    let hits = 0;
    let deep = 0;
    for (let i = 0; i < 400; i++) {
      const start = vec(
        -6000 + 12000 * random(),
        -6000 + 12000 * random(),
        100 + 3000 * random()
      );
      const len = 50 + 3000 * random();
      const yaw = 2 * Math.PI * random();
      const pitch = (random() - 0.5) * Math.PI;
      const end = vec(
        start.x + len * Math.cos(pitch) * Math.cos(yaw),
        start.y + len * Math.cos(pitch) * Math.sin(yaw),
        start.z + len * Math.sin(pitch)
      );
      // Deep overlaps (the core inside a box) can tie between faces, and so
      // can everything that depends on their exit direction: a known gap
      // (no UE trace), left out here.
      const plain = oracle.sweepCapsule(start, start, CAPSULE);
      if (plain?.startPenetrating && plain.penetrationDepth >= CAPSULE.radius) {
        deep++;
        continue;
      }
      for (const moving of [false, true]) {
        const a = exact.sweepCapsule(start, end, CAPSULE, {
          ignoreOverlapsMovingOut: moving,
        });
        const b = oracle.sweepCapsule(start, end, CAPSULE, {
          ignoreOverlapsMovingOut: moving,
        });
        compare(a, b, `move ${i}${moving ? ' (moving out)' : ''}`);
        if (a) hits++;
      }
      expect(exact.overlapCapsule(start, CAPSULE)).toBe(
        oracle.overlapCapsule(start, CAPSULE)
      );
    }
    expect(hits).toBeGreaterThan(200);
    expect(deep).toBeLessThan(100);
  });

  it('line traces agree', () => {
    const random = rng(11);
    for (let i = 0; i < 300; i++) {
      const start = vec(
        -6000 + 12000 * random(),
        -6000 + 12000 * random(),
        -200 + 3000 * random()
      );
      const end = vec(
        start.x + 4000 * (random() - 0.5),
        start.y + 4000 * (random() - 0.5),
        start.z - 3000 * random()
      );
      const a = exact.lineTrace(start, end);
      const b = oracle.lineTrace(start, end);
      expect(a === null, `trace ${i}`).toBe(b === null);
      if (!a || !b || b.startPenetrating) continue;
      expect(Math.abs(a.time - b.time)).toBeLessThan(1e-9);
      expect(near(a.normal, b.normal, 1e-9)).toBe(true);
    }
  });

  it("a wall contact parallel to the capsule axis reports Chaos's impact point", () => {
    // Walking +X into a wall face at x = 1000: every point of the core is
    // equally close; the layer takes the point Chaos's float32 GJK raycast
    // reports (chaos_gjk.ts), here just below the top end.
    const box = {
      center: [1100, 0, 1000] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      halfExtents: [100, 5000, 1000] as [number, number, number],
      info,
    };
    const w = world({ boxes: [box] });
    const z = 702.15;
    const hit = w.sweepCapsule(vec(0, 0, z), vec(1000, 0, z), CAPSULE)!;
    expect(hit.time).toBeCloseTo(400 / 1000, 12);
    expect(hit.normal.x).toBeCloseTo(-1, 12);
    const chaos = chaosConvexSweep(
      boxSupport([-100, -5000, -1000], box.halfExtents),
      { t: box.center, q: box.rotation },
      {
        start: [0, 0, z],
        end: [1000, 0, z],
        rotation: [0, 0, 0, 1],
        radius: CAPSULE.radius,
        halfLength: CAPSULE.halfHeight - CAPSULE.radius,
      }
    )!;
    expect([hit.impactPoint.x, hit.impactPoint.y, hit.impactPoint.z]).toEqual(
      chaos.impactPoint
    );
    expect(hit.impactPoint.x).toBeCloseTo(1000, 3);
    expect(hit.impactPoint.z).toBeCloseTo(802.15, 3);
  });

  it('ignores a starting overlap it moves out of, not one it moves into', () => {
    const w = world({
      boxes: [
        {
          center: [0, 0, -500],
          rotation: [0, 0, 0, 1],
          halfExtents: [5000, 5000, 500],
          info,
        },
      ],
    });
    const start = vec(0, 0, 690); // 10 cm into the floor
    expect(
      w.sweepCapsule(start, vec(0, 0, 790), CAPSULE, {
        ignoreOverlapsMovingOut: true,
      })
    ).toBeNull();
    const into = w.sweepCapsule(start, vec(0, 0, 600), CAPSULE, {
      ignoreOverlapsMovingOut: true,
    })!;
    expect(into.startPenetrating).toBe(true);
    expect(into.penetrationDepth).toBeCloseTo(10, 9);
    expect(into.normal.z).toBeCloseTo(1, 12);
  });
});

describe('spheres and capsules (analytic)', () => {
  it('a capsule dropping onto a sphere stops where the hemisphere touches it', () => {
    const w = world({ spheres: [{ center: [0, 0, 0], radius: 100, info }] });
    // Core bottom at z - 100; touch when it is r + R = 700 above the centre.
    const hit = w.sweepCapsule(vec(0, 0, 2000), vec(0, 0, 0), CAPSULE)!;
    expect(hit.location.z).toBeCloseTo(800, 9);
    expect(hit.normal.z).toBeCloseTo(1, 12);
    expect(hit.impactNormal.z).toBeCloseTo(1, 12); // sphere: ImpactNormal = Normal
    expect(hit.impactPoint.z).toBeCloseTo(100, 4);
  });

  it('a capsule moving sideways meets a sphere with its cylinder', () => {
    const w = world({
      spheres: [{ center: [2000, 0, 700], radius: 100, info }],
    });
    const hit = w.sweepCapsule(vec(0, 0, 700), vec(4000, 0, 700), CAPSULE)!;
    expect(hit.location.x).toBeCloseTo(1300, 9);
    expect(hit.normal.x).toBeCloseTo(-1, 12);
  });

  it('a capsule meets a lying capsule along its core', () => {
    const w = world({
      capsules: [
        {
          center: [0, 0, 0],
          rotation: tiltQuat(90),
          radius: 50,
          halfLength: 1000,
          info,
        },
      ],
    });
    const hit = w.sweepCapsule(vec(0, 300, 3000), vec(0, 300, 0), CAPSULE)!;
    expect(hit.location.z).toBeCloseTo(100 + 650, 9);
  });
});

describe('convex hulls', () => {
  const cube = (half: number) => {
    const pts: number[] = [];
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1]) pts.push(x * half, y * half, z * half);
    return new Float64Array(pts);
  };

  it('a scaled, rotated hull sweeps like the same box', () => {
    const q = mulQuat(yawQuat(25), tiltQuat(10));
    const hull = world({
      hulls: [
        {
          body: { points: cube(1) },
          t: [0, 0, 200],
          q,
          s: [400, 300, 200],
          info,
        },
      ],
    });
    const oracle = new ObbOracleWorld([
      obbFromQuat('b', [0, 0, 200], [400, 300, 200], [...q]),
    ]);
    const random = rng(3);
    for (let i = 0; i < 200; i++) {
      const start = vec(
        -3000 + 6000 * random(),
        -3000 + 6000 * random(),
        800 + 2000 * random()
      );
      const end = vec(
        -start.x * random(),
        -start.y * random(),
        start.z - 2500 * random()
      );
      const a = hull.sweepCapsule(start, end, CAPSULE);
      const b = oracle.sweepCapsule(start, end, CAPSULE);
      expect(a === null).toBe(b === null);
      if (!a || !b) continue;
      expect(Math.abs(a.time - b.time)).toBeLessThan(1e-7);
      expect(near(a.normal, b.normal, 1e-5)).toBe(true);
    }
  });

  it('ImpactNormal is the face most opposing the trace among faces near the impact point', () => {
    // Cube [-1000, 1000]^3; the capsule's lower hemisphere meets its top
    // edge at x = 1000. Both the top (0, 0, 1) and the side (1, 0, 0) face
    // pass within the search distance of that edge.
    const w = world({
      hulls: [
        {
          body: { points: cube(1) },
          t: [0, 0, 0],
          q: [0, 0, 0, 1],
          s: [1000, 1000, 1000],
          info,
        },
      ],
    });
    // Mostly sideways (-X): the side face opposes the move most.
    const side = w.sweepCapsule(
      vec(2000, 0, 1500),
      vec(1000, 0, 1300),
      CAPSULE
    )!;
    expect(side.impactPoint.x).toBeCloseTo(1000, 3);
    expect(side.impactPoint.z).toBeCloseTo(1000, 3);
    expect(side.impactNormal.x).toBeCloseTo(1, 9);
    // Straight down past the edge: the top face.
    const down = w.sweepCapsule(
      vec(1100, 0, 2400),
      vec(1100, 0, 1500),
      CAPSULE
    )!;
    expect(down.location.z).toBeCloseTo(
      1100 + Math.sqrt(600 ** 2 - 100 ** 2),
      9
    );
    expect(down.impactNormal.z).toBeCloseTo(1, 9);
  });

  it('builds flat hulls (exported without faces) as two-sided polygons', () => {
    const flat = convexHull([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0]);
    expect(flat.kind).toBe('flat');
    const w = world({
      hulls: [
        {
          body: {
            points: new Float64Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
          },
          t: [-1000, -1000, 0],
          q: [0, 0, 0, 1],
          s: [2000, 2000, 1],
          info,
        },
      ],
    });
    const fromAbove = w.sweepCapsule(vec(0, 0, 1000), vec(0, 0, 0), CAPSULE)!;
    expect(fromAbove.location.z).toBeCloseTo(700, 9);
    const fromBelow = w.sweepCapsule(vec(0, 0, -1000), vec(0, 0, 0), CAPSULE)!;
    expect(fromBelow.location.z).toBeCloseTo(-700, 9);
  });
});

describe('triangle meshes', () => {
  // A 2000 x 2000 quad at z = 0 in UE winding: outward (v2 - v0) x (v1 - v0) = +Z.
  const quad = (doubleSided: boolean) =>
    world({
      meshes: [
        {
          vertices: [
            -1000, -1000, 0, 1000, -1000, 0, 1000, 1000, 0, -1000, 1000, 0,
          ],
          triangles: [0, 2, 1, 0, 3, 2],
          t: [0, 0, 0],
          q: [0, 0, 0, 1],
          s: [1, 1, 1],
          doubleSided,
          info,
        },
      ],
    });

  it('a one-sided mesh blocks from its front only', () => {
    const w = quad(false);
    const down = w.sweepCapsule(vec(0, 0, 1000), vec(0, 0, 0), CAPSULE)!;
    expect(down.location.z).toBeCloseTo(700, 9);
    expect(down.impactNormal.z).toBeCloseTo(1, 12);
    expect(w.sweepCapsule(vec(0, 0, -1000), vec(0, 0, 0), CAPSULE)).toBeNull();
    // Line traces cull back faces too.
    expect(w.lineTrace(vec(0, 0, 100), vec(0, 0, -100))).not.toBeNull();
    expect(w.lineTrace(vec(0, 0, -100), vec(0, 0, 100))).toBeNull();
  });

  it('a one-sided mesh still reports a back face it starts overlapping', () => {
    const w = quad(false);
    const hit = w.sweepCapsule(vec(0, 0, -650), vec(0, 0, -600), CAPSULE)!;
    expect(hit.startPenetrating).toBe(true);
  });

  it('a double-sided mesh (flag bit 32) blocks from both sides', () => {
    const w = quad(true);
    expect(
      w.sweepCapsule(vec(0, 0, -1000), vec(0, 0, 0), CAPSULE)!.location.z
    ).toBeCloseTo(-700, 9);
  });

  it('a mirroring scale keeps the outward side', () => {
    const w = world({
      meshes: [
        {
          vertices: [
            -1000, -1000, 0, 1000, -1000, 0, 1000, 1000, 0, -1000, 1000, 0,
          ],
          triangles: [0, 2, 1, 0, 3, 2],
          t: [0, 0, 0],
          q: [0, 0, 0, 1],
          s: [-1, 1, 1],
          doubleSided: false,
          info,
        },
      ],
    });
    expect(
      w.sweepCapsule(vec(0, 0, 1000), vec(0, 0, 0), CAPSULE)
    ).not.toBeNull();
    expect(w.sweepCapsule(vec(0, 0, -1000), vec(0, 0, 0), CAPSULE)).toBeNull();
  });
});

describe('heightfields', () => {
  // 3 x 3 vertices, 100 cm cells, one corner of cell (0, 0) raised; cell
  // (1, 1) a hole. Heights decoded, scale 1.
  const heights = new Float64Array([0, 80, 0, 0, 0, 0, 0, 0, 0]);
  const hf = (holes: Uint8Array | null) =>
    world({
      heightfields: [
        {
          rows: 3,
          cols: 3,
          heights,
          holes,
          t: [0, 0, 0],
          q: [0, 0, 0, 1],
          s: [100, 100, 1],
          info,
        },
      ],
    });

  it('splits cells along (x, y) to (x + 1, y + 1)', () => {
    const w = hf(null);
    // Vertex (1, 0) is raised: only triangle (P0, P1, P3) holds it.
    const below = w.lineTrace(vec(75, 25, 500), vec(75, 25, -500))!;
    // On (P0, P1, P3): z = 80 * (x - y) / 100.
    expect(below.impactPoint.z).toBeCloseTo(40, 9);
    const above = w.lineTrace(vec(25, 75, 500), vec(25, 75, -500))!;
    expect(above.impactPoint.z).toBeCloseTo(0, 9);
  });

  it('hole cells have no collision', () => {
    const holes = new Uint8Array([0, 0, 0, 1]);
    const w = hf(holes);
    expect(w.lineTrace(vec(150, 150, 500), vec(150, 150, -500))).toBeNull();
    expect(w.lineTrace(vec(50, 150, 500), vec(50, 150, -500))).not.toBeNull();
  });

  it('blocks from both sides', () => {
    const small = { radius: 20, halfHeight: 40 };
    const w = hf(null);
    // Cell (1, 1) is flat at 0 and more than the radius from the raised vertex.
    expect(
      w.sweepCapsule(vec(150, 150, 500), vec(150, 150, 0), small)!.location.z
    ).toBeCloseTo(40, 9);
    expect(
      w.sweepCapsule(vec(150, 150, -500), vec(150, 150, 0), small)!.location.z
    ).toBeCloseTo(-40, 9);
  });

  it('ImpactNormal is the cell face most opposing the trace near the impact point', () => {
    const small = { radius: 20, halfHeight: 40 };
    const w = hf(null);
    const hit = w.sweepCapsule(vec(75, 25, 500), vec(75, 25, 0), small)!;
    // The raised triangle (P0, P1, P3): normal ~ (-80, 80, 100) normalised.
    const n = rotate([0, 0, 0, 1], -0.8, 0.8, 1);
    const l = Math.hypot(...n);
    expect(hit.impactNormal.x).toBeCloseTo(n[0] / l, 9);
    expect(hit.impactNormal.z).toBeCloseTo(n[2] / l, 9);
  });
});
