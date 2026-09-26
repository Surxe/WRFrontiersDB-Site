/* eslint-disable no-console */
/**
 * sync-model-data.mjs — copy the runtime data the 3D model viewer needs
 * from the data repo (WRFrontiersDB-Data/current/) into public/data/.
 *
 * Copies:
 *   - Objects/CharacterPreset.json   (preset module layout + mount graph)
 *   - Objects/Module.json            (module sockets, mounts, types)
 *   - Objects/CharacterModule.json   (mesh/adapter refs -> model file names)
 *   - Objects/VirtualBot.json        (bot -> factory preset refs)
 *   - Objects/ModuleSocketType.json  (socket type ids)
 *   - Objects/ModuleType.json        (module type ids)
 *   - Models/*.json                  (per-CharacterModule hitbox+untextured
 *                                     models produced by the parser)
 *
 * The script is idempotent (destination files are overwritten in place) and
 * exits 0 with a SKIP log line when a source file/directory is missing, so
 * `npm run build` keeps working on machines where the parser has not run yet.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'WRFrontiersDB-Data', 'current');
const DEST = join(ROOT, 'public', 'data');

const OBJECT_FILES = [
  'CharacterPreset.json',
  'Module.json',
  'CharacterModule.json',
  'VirtualBot.json',
  'ModuleSocketType.json',
  'ModuleType.json',
];

let copied = 0;
let skipped = 0;

function log(line) {
  console.log(`[sync:models] ${line}`);
}

// ---- Objects files -------------------------------------------------------
mkdirSync(join(DEST, 'Objects'), { recursive: true });
for (const file of OBJECT_FILES) {
  const src = join(SOURCE, 'Objects', file);
  const dst = join(DEST, 'Objects', file);
  if (!existsSync(src)) {
    log(`SKIP (missing source): Objects/${file}`);
    skipped += 1;
    continue;
  }
  cpSync(src, dst);
  copied += 1;
  log(`copied Objects/${file}`);
}

// ---- Per-module models ---------------------------------------------------
const modelsSrc = join(SOURCE, 'Models');
const modelsDst = join(DEST, 'Models');
if (!existsSync(modelsSrc)) {
  log('SKIP (missing source): Models/ directory — run the parser first');
} else {
  mkdirSync(modelsDst, { recursive: true });
  // Prune stale copies that no longer exist in the source (keeps the sync
  // truly idempotent); nothing is removed when the source dir is absent.
  for (const file of readdirSync(modelsDst)) {
    if (file.endsWith('.json') && !existsSync(join(modelsSrc, file))) {
      rmSync(join(modelsDst, file));
      log(`pruned stale Models/${file}`);
    }
  }
  for (const file of readdirSync(modelsSrc).sort()) {
    if (!file.endsWith('.json')) {
      continue;
    }
    cpSync(join(modelsSrc, file), join(modelsDst, file));
    copied += 1;
    log(`copied Models/${file}`);
  }
}

log(`done: ${copied} copied, ${skipped} skipped`);
