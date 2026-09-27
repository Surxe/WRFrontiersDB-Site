import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../src/scripts/model_viewer/build/types';
import { buildCompatibilityIndex } from '../../src/scripts/model_viewer/build/compatibility';
import {
  resolveBuild,
  toPresetModules,
} from '../../src/scripts/model_viewer/build/graph';
import {
  LEG_ZONES,
  MODULE_PALETTE,
  buildModuleColors,
  buildZoneColors,
  uniqueColors,
} from '../../src/scripts/model_viewer/colors';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'build', 'fixture_tables.json'), 'utf8')
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
  it('covers a full robot (9 modules) from the palette', () => {
    expect(MODULE_PALETTE.length).toBeGreaterThanOrEqual(9);
    expect(new Set(MODULE_PALETTE).size).toBe(MODULE_PALETTE.length);
  });

  it('stays unique past the palette', () => {
    const colors = uniqueColors(40);
    expect(colors).toHaveLength(40);
    expect(new Set(colors).size).toBe(40);
    expect(colors.every((c) => c >= 0 && c <= 0xffffff)).toBe(true);
  });
});

describe('buildModuleColors', () => {
  it('gives every rendered module its own color', () => {
    const build = resolveBuild(
      { ...full, Ability: 'DA_Module_AbilityDash.0' },
      tables,
      index
    );
    const colors = buildModuleColors(build);
    expect(colors).toHaveLength(toPresetModules(build).length);
    expect(colors).toHaveLength(10);
    expect(new Set(colors).size).toBe(10);
  });

  it('keeps each module color when other slots change', () => {
    const colorByKey = (selection: Record<string, string>) => {
      const build = resolveBuild(selection, tables, index);
      const colors = buildModuleColors(build);
      const filled = build.slots.filter((s) => s.moduleId);
      return Object.fromEntries(filled.map((s, i) => [s.key, colors[i]]));
    };
    const before = colorByKey(full);
    const { 'Shoulder_L.Shoulder_Weapon_0': _dropped, ...fewer } = full;
    const after = colorByKey(fewer);
    for (const key of Object.keys(after)) {
      expect(after[key], key).toBe(before[key]);
    }
  });
});

describe('buildZoneColors', () => {
  it('gives each chassis leg pool a color no module uses', () => {
    const build = resolveBuild(full, tables, index);
    const zones = buildZoneColors(build);
    const legColors = LEG_ZONES.map((zone) => zones[zone]);
    expect(legColors.every((c) => c !== undefined)).toBe(true);
    const all = [...buildModuleColors(build), ...legColors];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the leg colors when weapons change', () => {
    const { 'Shoulder_L.Shoulder_Weapon_0': _dropped, ...fewer } = full;
    expect(buildZoneColors(resolveBuild(fewer, tables, index))).toEqual(
      buildZoneColors(resolveBuild(full, tables, index))
    );
  });
});
