import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildCompatibilityIndex } from '../../../src/scripts/robot/build/compatibility';
import {
  resolveBuild,
  selectionFromPreset,
  toPresetModules,
} from '../../../src/scripts/robot/build/graph';
import { isProdReady } from '../../../src/scripts/robot/build/classify';
import {
  resolveComparison,
  toOverrides,
} from '../../../src/scripts/robot/build/compare';
import type { BuildTables } from '../../../src/scripts/robot/build/types';
import type { CharacterPreset } from '../../../src/types/character_preset';

// Validates the build rules against the real game data: every preset the game
// ships must be expressible as a build, and every released chassis must
// resolve to a complete robot.
const objects = path.join(
  process.cwd(),
  'WRFrontiersDB-Data',
  'current',
  'Objects'
);
const read = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(objects, file), 'utf8')) as T;

const tables: BuildTables = {
  modules: read('Module.json'),
  moduleTypes: read('ModuleType.json'),
  socketTypes: read('ModuleSocketType.json'),
  bots: read('VirtualBot.json'),
};
const presets = read<Record<string, CharacterPreset>>('CharacterPreset.json');
const index = buildCompatibilityIndex(tables);

describe('build rules vs game data', () => {
  it('every released chassis resolves with a torso and both shoulders', () => {
    const released = index.rootModules.filter((id) =>
      isProdReady(tables.modules[id])
    );
    expect(released.length).toBeGreaterThan(0);
    for (const chassis of released) {
      const { selection } = resolveBuild({ chassis }, tables, index);
      expect(selection.chassis, chassis).toBe(chassis);
      expect(selection.torso, chassis).toBeDefined();
      expect(selection.Shoulder_L, chassis).toBeDefined();
      expect(selection.Shoulder_R, chassis).toBeDefined();
    }
  });

  it('every preset round-trips through the builder unchanged', () => {
    for (const preset of Object.values(presets)) {
      const modules = preset.modules ?? [];
      if (modules.length === 0) continue;
      const selection = selectionFromPreset(modules);
      const build = resolveBuild(selection, tables, index);
      expect(build.selection, preset.id).toEqual(selection);
      expect(toPresetModules(build).length, preset.id).toBe(modules.length);
    }
  });

  // The data repo's build-code registry is derived with its own copy of the
  // fit rules; its vectors must be builds the Site resolves unchanged.
  const vectors = (
    JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'WRFrontiersDB-Data',
          'index',
          'build_code_vectors.json'
        ),
        'utf8'
      )
    ) as { vectors: { build: Record<string, string> }[] }
  ).vectors.map((v) => v.build);

  it('every build-code vector is a resolved Site build', () => {
    for (const build of vectors) {
      expect(resolveBuild(build, tables, index).selection).toEqual(build);
    }
  });

  it('a full B round-trips through overrides on A', () => {
    for (let i = 0; i + 1 < vectors.length; i += 1) {
      const a = resolveBuild(vectors[i], tables, index);
      const b = resolveBuild(vectors[i + 1], tables, index);
      const cmp = resolveComparison(a, toOverrides(a, b), tables, index);
      expect(cmp.b.selection).toEqual(b.selection);
    }
  });
});
