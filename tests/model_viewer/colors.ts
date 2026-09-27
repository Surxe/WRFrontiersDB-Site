import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../src/scripts/robot/build/types';
import { buildCompatibilityIndex } from '../../src/scripts/robot/build/compatibility';
import {
  resolveBuild,
  toPresetModules,
} from '../../src/scripts/robot/build/graph';
import {
  buildColors,
  partColor,
  uniqueColors,
} from '../../src/scripts/model_viewer/colors';
import {
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_PELVIS,
  ARMOR_ZONE_RIGHT_LEG,
} from '../../src/utils/constants';

const tables = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'robot', 'build', 'fixture_tables.json'),
    'utf8'
  )
) as BuildTables;
const index = buildCompatibilityIndex(tables);

// Typhon fixture: chassis, torso, 2 shoulders with 2 weapon slots each, a
// torso weapon slot and a gear slot.
const full = {
  chassis: 'DA_Module_ChassisTyphon.0',
  'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_WeaponHeavy.0',
  'Shoulder_L.Shoulder_Weapon_1': 'DA_Module_WeaponLight.0',
  'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_WeaponHeavy.0',
  'Shoulder_R.Shoulder_Weapon_1': 'DA_Module_WeaponLight.0',
  Torso_Weapon_0: 'DA_Module_WeaponHeavy.0',
};

describe('uniqueColors', () => {
  it('covers a full robot (11 colors) from the fixed palette, all distinct', () => {
    expect(new Set(uniqueColors(11)).size).toBe(11);
  });

  it('stays unique past the palette', () => {
    const colors = uniqueColors(40);
    expect(colors).toHaveLength(40);
    expect(new Set(colors).size).toBe(40);
    expect(colors.every((c) => c >= 0 && c <= 0xffffff)).toBe(true);
  });
});

describe('buildColors', () => {
  it('gives every rendered module its own color', () => {
    const build = resolveBuild(
      { ...full, Ability: 'DA_Module_AbilityDash.0' },
      tables,
      index
    );
    const { modules } = buildColors(build);
    expect(modules).toHaveLength(toPresetModules(build).length);
    expect(modules).toHaveLength(10);
    expect(new Set(modules).size).toBe(10);
  });

  it('keeps each module color when other slots change', () => {
    const colorByKey = (selection: Record<string, string>) => {
      const build = resolveBuild(selection, tables, index);
      const { modules } = buildColors(build);
      const filled = build.slots.filter((s) => s.moduleId);
      return Object.fromEntries(filled.map((s, i) => [s.key, modules[i]]));
    };
    const before = colorByKey(full);
    const { 'Shoulder_L.Shoulder_Weapon_0': _dropped, ...fewer } = full;
    const after = colorByKey(fewer);
    for (const key of Object.keys(after)) {
      expect(after[key], key).toBe(before[key]);
    }
  });

  it('gives each chassis leg pool a color no module uses', () => {
    const { modules, zones } = buildColors(resolveBuild(full, tables, index));
    const legs = [ARMOR_ZONE_LEFT_LEG, ARMOR_ZONE_RIGHT_LEG].map((zone) =>
      zones.get(zone)
    );
    expect(legs.every((c) => c !== undefined)).toBe(true);
    const all = [...modules, ...legs];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the leg colors when weapons change', () => {
    const { 'Shoulder_L.Shoulder_Weapon_0': _dropped, ...fewer } = full;
    expect(buildColors(resolveBuild(fewer, tables, index)).zones).toEqual(
      buildColors(resolveBuild(full, tables, index)).zones
    );
  });
});

describe('partColor', () => {
  it("uses a zone's own color, else the module's", () => {
    const colors = buildColors(resolveBuild(full, tables, index));
    expect(partColor(colors, 0, ARMOR_ZONE_LEFT_LEG)).toBe(
      colors.zones.get(ARMOR_ZONE_LEFT_LEG)
    );
    // The pelvis keeps the chassis's color.
    expect(partColor(colors, 0, ARMOR_ZONE_PELVIS)).toBe(colors.modules[0]);
    expect(partColor(colors, 1, null)).toBe(colors.modules[1]);
  });
});
