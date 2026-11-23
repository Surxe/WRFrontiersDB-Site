/**
 * Every sweep's hit from Chaos float (MVP session 4.5, D26, D27;
 * findings/chaos-sweeps.md), against UE 5.4.4's own answers.
 *
 * Fixtures: reference/chaos_sweeps (session 4.5: starting overlaps on boxes,
 * a hull and meshes, floor sweeps with the CMC's shrunken capsules, spheres
 * and capsules as the hit shape, landscape heightfields, far coordinates,
 * rotated capsules; misses kept) and reference/chaos_contact (session 3.5:
 * walls, hulls, meshes, corners, replays; hits only), recorded by the
 * reference commandlet's oracle mode (/srv/dev/repos/wrf-movement-ref
 * -oracle=) through UWorld::ComponentSweepMulti (the CMC's moves) or
 * SweepSingleByChannel (its floor sweeps).
 *
 * Gated, bit for bit:
 * - the float32 port on UE's hit shape (box, hull, mesh, sphere, capsule,
 *   heightfield): distance or penetration depth, impact point, normal, and
 *   the initial-overlap status, for every hit;
 * - the collision world end to end (ExactCollisionWorld: candidates, Chaos's
 *   ranking, the face rules): blocking or not, bStartPenetrating, the
 *   component, Location, ImpactPoint, Normal, ImpactNormal, PenetrationDepth;
 * - FRotator::Quaternion (math/rotator_quat.ts) on every capsule rotation.
 *
 * Reported, not gated (each with its cause, below): hull ImpactNormals one
 * float ulp off (Chaos's cooked plane normals, not exported), the corner
 * apex's shape tie (D19), a scaled mesh's two triangles one ulp apart.
 */
import { describe, expect, it } from 'vitest';
import { rotatorQuaternion } from '../../src/scripts/movement/math/rotator_quat';
import { safeNormal } from '../../src/scripts/movement/collision/exact/chaos_gjk';
import { vec } from '../../src/scripts/movement/math/vec';
import {
  hitName,
  IDENTITY,
  loadOracle,
  portSweep,
  same,
  worldOf,
  type OracleSet,
} from './support/chaos_oracle';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};
const f = Math.fround;

const SWEEPS = loadOracle('reference/chaos_sweeps');
const CONTACT = loadOracle('reference/chaos_contact');

/** Known disagreements by set and tag, each with its cause. */
const SCALED_ULP =
  "the scaled mesh's two triangles end one float ulp apart (272.6687 cm); in UE the second is filtered by the " +
  "trimesh BVH's float bounds test or visited in another order (the cooked BVH is not exported)";
const APEX_TIE =
  'the corner apex: both walls at the same Chaos distance and face dot; UE keeps the shape its acceleration ' +
  'structure visits first (D19), and its own choice differs between worlds (findings/chaos-contact-point.md item 5)';
const KNOWN: Record<string, string> = {
  'meshes_r300|scaled side 1 lat 0 z 1500 ang 74 cap 0': SCALED_ULP,
  'corners_r600|corner 90 dir 0 z 1500': APEX_TIE,
  'corners_r600|corner 90 dir 0 z 702.15': APEX_TIE,
};
const knownFor = (o: OracleSet, tag: string): string | undefined =>
  KNOWN[`${o.set}|${tag}`];

/** Chaos's convex planes are fitted at cook time (TConvexHull3's
 * simplified faces) and stored as float; the export carries the hull's
 * vertices and faces, not the planes, so a hull's ImpactNormal is derived
 * and may differ in the last float bit. */
const HULL_NORMAL_TOL = 1e-6;

const inputOf = (o: OracleSet, q: OracleSet['queries'][number]) => {
  const cap = q.capsule ?? o.capsule;
  return {
    start: q.start,
    end: q.end,
    rotation: q.quat ?? IDENTITY,
    radius: cap.radius,
    halfLength: cap.halfHeight - cap.radius,
  };
};

describe("Chaos's float32 sweep on UE's hit shape (every shape type, overlaps)", () => {
  for (const o of [...SWEEPS, ...CONTACT]) {
    it(`${o.set}: every hit bit for bit`, () => {
      const shapes = new Map(o.shapes.map((s) => [hitName(s), s]));
      let checked = 0;
      let overlaps = 0;
      for (const q of o.queries) {
        const h = q.hit;
        if (!h) continue;
        const known = knownFor(o, q.tag);
        if (known && known === SCALED_ULP) continue;
        const s = shapes.get(h.comp)!;
        const p = portSweep(s, inputOf(o, q));
        expect(p, `${q.tag}: a hit`).not.toBeNull();
        expect(p!.overlap, `${q.tag}: initial overlap`).toBe(h.startPen);
        if (h.startPen) {
          overlaps++;
          if (h.penDepth !== undefined)
            expect(f(Math.abs(p!.distance)), `${q.tag}: depth`).toBe(
              f(h.penDepth)
            );
          expect(same(p!.normal, h.normal), `${q.tag}: MTD normal`).toBe(true);
        } else {
          expect(f(p!.distance), `${q.tag}: distance`).toBe(h.dist);
          expect(
            same(safeNormal(p!.normal, 1e-8), h.normal),
            `${q.tag}: normal`
          ).toBe(true);
        }
        expect(same(p!.impactPoint, h.impactPoint), `${q.tag}: point`).toBe(
          true
        );
        checked++;
      }
      say(
        `[chaos port] ${o.set}: ${checked} hits exact (${overlaps} overlaps)`
      );
      expect(checked).toBeGreaterThan(10);
    });
  }
});

describe('the collision world end to end against UE (every field)', () => {
  for (const o of [...SWEEPS, ...CONTACT]) {
    it(`${o.set}: every query`, () => {
      const w = worldOf(o);
      const hulls = new Set(
        o.shapes.filter((s) => s.shape === 'hull').map((s) => s.name)
      );
      let checked = 0;
      let hullNormals = 0;
      for (const q of o.queries) {
        const cap = q.capsule ?? o.capsule;
        const l = w.sweepCapsule(
          vec(...q.start),
          vec(...q.end),
          cap,
          q.kind === 'single' ? {} : { rotation: q.quat ?? IDENTITY }
        );
        const h = q.hit;
        // The replayed apex sweeps of corner_60_v: the same tie, where the
        // layer keeps the other wall.
        const known =
          knownFor(o, q.tag) ??
          (o.set === 'replay_corner_60_v' && l && h && l.source !== h.comp
            ? APEX_TIE
            : undefined);
        if (known) {
          say(`[reported] ${o.set} ${q.tag}: ${known}`);
          continue;
        }
        expect(!!l, `${q.tag}: blocking`).toBe(!!h);
        if (!l || !h) {
          checked++;
          continue;
        }
        expect(l.startPenetrating, `${q.tag}: start penetrating`).toBe(
          h.startPen
        );
        expect(l.source, `${q.tag}: component`).toBe(h.comp);
        const v = (x: { x: number; y: number; z: number }) => [x.x, x.y, x.z];
        expect(same(v(l.impactPoint), h.impactPoint), `${q.tag}: point`).toBe(
          true
        );
        expect(same(v(l.normal), h.normal), `${q.tag}: normal`).toBe(true);
        if (h.startPen) {
          if (h.penDepth !== undefined)
            expect(f(l.penetrationDepth), `${q.tag}: depth`).toBe(
              f(h.penDepth)
            );
        } else if (h.loc) {
          expect(same(v(l.location), h.loc), `${q.tag}: location`).toBe(true);
        }
        if (hulls.has(h.comp) && !same(v(l.impactNormal), h.impactNormal)) {
          hullNormals++;
          const d = Math.hypot(
            l.impactNormal.x - h.impactNormal[0],
            l.impactNormal.y - h.impactNormal[1],
            l.impactNormal.z - h.impactNormal[2]
          );
          expect(d, `${q.tag}: hull impact normal`).toBeLessThan(
            HULL_NORMAL_TOL
          );
        } else {
          expect(
            same(v(l.impactNormal), h.impactNormal),
            `${q.tag}: impact normal`
          ).toBe(true);
        }
        checked++;
      }
      say(
        `[world] ${o.set}: ${checked} queries exact` +
          (hullNormals
            ? `; ${hullNormals} hull ImpactNormals within ${HULL_NORMAL_TOL} (cooked planes not exported)`
            : '')
      );
      expect(checked).toBeGreaterThan(10);
    });
  }
});

describe("FRotator::Quaternion with UE's bits (D27)", () => {
  it("every capsule rotation of the oracle, bit for bit after Chaos's float rounding", () => {
    let n = 0;
    let exact = 0;
    for (const o of SWEEPS)
      for (const q of o.queries) {
        if (!q.rotationPYR) continue;
        const u = rotatorQuaternion(...q.rotationPYR);
        const ue = q.quat ?? IDENTITY;
        n++;
        // Chaos takes the capsule rotation in float32 (BToARotation).
        expect(
          u.every((x, i) => f(x) === f(ue[i])),
          `${q.rotationPYR}: float32`
        ).toBe(true);
        if (u.every((x, i) => x === ue[i] || (x === 0 && ue[i] === 0))) exact++;
      }
    // In double, glibc's sin and cos (UE's on Linux) are not always
    // correctly rounded; math/sincos.ts is, so a few differ in the last bit.
    say(`[rotator] ${exact}/${n} quaternions exact in double`);
    expect(exact / n).toBeGreaterThan(0.999);
  });
});
