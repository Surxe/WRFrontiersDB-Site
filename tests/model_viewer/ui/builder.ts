import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/robot/build/types';
import { buildCompatibilityIndex } from '../../../src/scripts/robot/build/compatibility';
import { resolveBuild } from '../../../src/scripts/robot/build/graph';
import {
  displaySlots,
  slotLabel,
} from '../../../src/scripts/model_viewer/ui/builder';
import {
  MODEL_STRINGS,
  ModelText,
} from '../../../src/scripts/model_viewer/strings';
import { resolveLocalizationKeys } from '../../../src/utils/localization';

const tables = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'robot', 'build', 'fixture_tables.json'),
    'utf8'
  )
) as BuildTables;
const index = buildCompatibilityIndex(tables);
// English, as before the reader's language loads.
const text = new ModelText(resolveLocalizationKeys(MODEL_STRINGS), null);

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

describe('slotLabel', () => {
  const base = {
    key: 'k',
    path: [],
    parentKey: 'p',
    depth: 3,
    mountWay: null,
    required: false,
    fixed: false,
    options: [],
    moduleId: null,
  };

  it('names the chassis slot', () => {
    expect(
      slotLabel(
        {
          ...base,
          parentKey: null,
          socketName: 'None',
          socketTypeId: null,
          kind: 'chassis',
        },
        tables,
        text
      )
    ).toEqual({ label: 'Chassis', hint: null });
  });

  it('names weapon slots by number with the socket type as hint', () => {
    expect(
      slotLabel(
        {
          ...base,
          socketName: 'Shoulder_Weapon_1',
          socketTypeId: 'DA_ModuleSocketType_Weapon.0',
          kind: 'weapon',
        },
        tables,
        text
      )
    ).toEqual({ label: 'Weapon 2', hint: 'Light Weapon' });
  });

  it('names other slots by their socket type', () => {
    expect(
      slotLabel(
        {
          ...base,
          socketName: 'Shoulder_L',
          socketTypeId: 'DA_ModuleSocketType_ShoulderL.0',
          kind: 'shoulder',
        },
        tables,
        text
      )
    ).toEqual({ label: 'Left Shoulder', hint: null });
  });
});
