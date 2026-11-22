/**
 * Copy the Chaos contact oracle's results (wrf-chaos-oracle/1, recorded
 * headless by the local reference project /srv/dev/repos/wrf-movement-ref
 * with -oracle=oracle/cases.json, MVP session 3.5) into the Site's tests as
 * fixtures. Keeps the queries with a blocking hit and the fields the test
 * compares; numbers stay as UE printed them (17 significant digits).
 *
 *   npx tsx scripts/movement/import_chaos_oracle.ts <oracle output dir> <fixture dir>
 *
 * Example:
 *   npx tsx scripts/movement/import_chaos_oracle.ts \
 *     /srv/dev/repos/wrf-movement-ref/oracle/oracle tests/movement/reference/chaos_contact
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error('usage: import_chaos_oracle.ts <oracle dir> <fixture dir>');
  process.exit(2);
}
mkdirSync(target, { recursive: true });
for (const file of readdirSync(source).sort()) {
  if (!file.endsWith('.json')) continue;
  const o = JSON.parse(readFileSync(path.join(source, file), 'utf8'));
  if (o.format !== 'wrf-chaos-oracle/1')
    throw new Error(`${file}: not wrf-chaos-oracle/1`);
  const shapes = o.shapes.map((s: Record<string, unknown>) => {
    const { inputPoints: _inputs, ...rest } = s;
    return rest;
  });
  const queries = o.queries
    .filter(
      (q: { hit: { block: boolean } | null }) => q.hit !== null && q.hit.block
    )
    .map(
      (q: {
        start: number[];
        end: number[];
        quat: number[];
        tag: string;
        hit: Record<string, unknown>;
      }) => ({
        start: q.start,
        end: q.end,
        quat: q.quat,
        tag: q.tag,
        hit: {
          dist: q.hit.dist,
          impactPoint: q.hit.impactPoint,
          normal: q.hit.normal,
          impactNormal: q.hit.impactNormal,
          startPen: q.hit.startPen,
          comp: q.hit.comp,
        },
      })
    );
  const out = {
    format: o.format,
    engine: o.engine,
    set: o.set,
    description: o.description,
    capsule: o.capsule,
    shapes,
    queries,
  };
  writeFileSync(path.join(target, file), JSON.stringify(out) + '\n');
  say(`${file}: ${shapes.length} shapes, ${queries.length} hits`);
}
