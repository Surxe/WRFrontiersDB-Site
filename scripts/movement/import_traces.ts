/**
 * Copy UE reference traces (wrf-move-ref/1, recorded headless by the local
 * reference project /srv/dev/repos/wrf-movement-ref, decision D10) into the
 * Site's tests as fixtures. Drops each tick's `log` (the -logmoves hit log,
 * about three quarters of the size); everything the replay compares stays.
 *
 *   npx tsx scripts/movement/import_traces.ts <source traces dir> <fixture dir> [scenario...]
 *
 * Example (the box set the collision layer is gated on):
 *   npx tsx scripts/movement/import_traces.ts \
 *     /srv/dev/repos/wrf-movement-ref/out-logmoves/traces tests/movement/reference/traces/box
 *
 * The shape set (session 2; recorded with -set=shapes -logmoves):
 *   npx tsx scripts/movement/import_traces.ts \
 *     /srv/dev/repos/wrf-movement-ref/out-shapes/traces tests/movement/reference/traces/shapes
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

const [source, target, ...only] = process.argv.slice(2);
if (!source || !target) {
  console.error(
    'usage: import_traces.ts <source dir> <fixture dir> [scenario...]'
  );
  process.exit(2);
}
mkdirSync(target, { recursive: true });
for (const file of readdirSync(source).sort()) {
  if (!file.endsWith('.json')) continue;
  if (only.length > 0 && !only.includes(path.basename(file, '.json'))) continue;
  const trace = JSON.parse(readFileSync(path.join(source, file), 'utf8'));
  if (trace.format !== 'wrf-move-ref/1')
    throw new Error(`${file}: not wrf-move-ref/1`);
  for (const tick of trace.ticks) delete tick.log;
  writeFileSync(path.join(target, file), JSON.stringify(trace) + '\n');
  say(`${file}: ${trace.ticks.length} ticks`);
}
