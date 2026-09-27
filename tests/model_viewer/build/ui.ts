import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/model_viewer/build/types';
import { buildCompatibilityIndex } from '../../../src/scripts/model_viewer/build/compatibility';
import { resolveBuild } from '../../../src/scripts/model_viewer/build/graph';
import { displaySlots } from '../../../src/scripts/model_viewer/build/ui';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;
const index = buildCompatibilityIndex(tables);

describe('displaySlots', () => {
  it('lists each part followed by its own weapons, hiding gear', () => {
    const build = resolveBuild(
      {
        chassis: 'DA_Module_ChassisTyphon.0',
        Ability: 'DA_Module_AbilityDash.0',
      },
      tables,
      index
    );
    expect(displaySlots(build).map((s) => s.key)).toEqual([
      'chassis',
      'torso',
      'Torso_Weapon_0',
      'Shoulder_L',
      'Shoulder_L.Shoulder_Weapon_0',
      'Shoulder_L.Shoulder_Weapon_1',
      'Shoulder_R',
      'Shoulder_R.Shoulder_Weapon_0',
      'Shoulder_R.Shoulder_Weapon_1',
    ]);
  });
});
