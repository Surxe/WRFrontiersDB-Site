/**
 * Copy the session 4.5 oracle sets (wrf-chaos-oracle/1, recorded headless by
 * the local reference project /srv/dev/repos/wrf-movement-ref with
 * -oracle=oracle/cases45.json) into the Site's tests as fixtures: starting
 * overlaps, floor sweeps, spheres and capsules, landscapes, far coordinates
 * and rotated capsules (tests/movement/chaos_sweeps.ts). Keeps every query
 * (a miss is part of the comparison) and the fields the test compares;
 * numbers stay as UE printed them.
 *
 *   npx tsx scripts/movement/import_chaos_sweeps.ts <oracle output dir> <fixture dir> <set> [...]
 *
 * Example:
 *   npx tsx scripts/movement/import_chaos_sweeps.ts \
 *     /srv/dev/repos/wrf-movement-ref/oracle45/oracle tests/movement/reference/chaos_sweeps \
 *     overlaps_r600 overlaps_far floors floors_far rounds_r600 landscape landscape_far far_touch_r600 rotated_r600
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [source, target, ...names] = process.argv.slice(2);
if (!source || !target || names.length === 0) {
  console.error(
    'usage: import_chaos_sweeps.ts <oracle dir> <fixture dir> <set> [...]'
  );
  process.exit(2);
}
mkdirSync(target, { recursive: true });
for (const name of names) {
  const o = JSON.parse(readFileSync(path.join(source, `${name}.json`), 'utf8'));
  if (o.format !== 'wrf-chaos-oracle/1')
    throw new Error(`${name}: not wrf-chaos-oracle/1`);
  const shapes = o.shapes.map((s: Record<string, unknown>) => {
    const { inputPoints: _inputs, ...rest } = s;
    const p = rest.particle as { x: number[]; r: number[] } | undefined;
    return { ...rest, particle: p ? { x: p.x, r: p.r } : undefined };
  });
  const identity = (q: number[]) =>
    q[0] === 0 && q[1] === 0 && q[2] === 0 && q[3] === 1;
  interface RawHit {
    block: boolean;
    time: number;
    dist: number;
    loc: number[];
    impactPoint: number[];
    normal: number[];
    impactNormal: number[];
    startPen: boolean;
    penDepth: number;
    comp: string;
  }
  interface RawQuery {
    kind?: string;
    capsule?: unknown;
    start: number[];
    end: number[];
    quat: number[];
    rotationPYR: number[];
    tag: string;
    hit: RawHit | null;
  }
  const queries = o.queries.map((q: RawQuery) => {
    const h = q.hit && q.hit.block ? q.hit : null;
    return {
      ...(q.kind === 'single' ? { kind: 'single', capsule: q.capsule } : {}),
      start: q.start,
      end: q.end,
      ...(identity(q.quat) ? {} : { quat: q.quat }),
      rotationPYR: q.rotationPYR,
      tag: q.tag,
      hit: h && {
        time: h.time,
        dist: h.dist,
        loc: h.loc,
        impactPoint: h.impactPoint,
        normal: h.normal,
        impactNormal: h.impactNormal,
        startPen: h.startPen,
        penDepth: h.penDepth,
        comp: h.comp,
      },
    };
  });
  const out = {
    format: o.format,
    engine: o.engine,
    set: o.set,
    description: o.description,
    capsule: o.capsule,
    shapes,
    queries,
  };
  writeFileSync(path.join(target, `${name}.json`), JSON.stringify(out) + '\n');
  process.stdout.write(
    `${name}: ${shapes.length} shapes, ${queries.length} queries\n`
  );
}
