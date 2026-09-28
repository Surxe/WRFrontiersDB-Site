import { describe, it, expect } from 'vitest';
import {
  readSelection,
  selectionQuery,
  slotKeyMatcher,
  writeSelection,
} from '../../../src/scripts/robot/build/params';

const isSlotKey = slotKeyMatcher(
  new Set([
    'Root',
    'Shoulder_L',
    'Shoulder_R',
    'Shoulder_Weapon_0',
    'Torso_Weapon_0',
  ])
);

describe('slotKeyMatcher', () => {
  it('accepts chassis/torso and socket-name paths only', () => {
    expect(isSlotKey('chassis')).toBe(true);
    expect(isSlotKey('torso')).toBe(true);
    expect(isSlotKey('Shoulder_L')).toBe(true);
    expect(isSlotKey('Shoulder_L.Shoulder_Weapon_0')).toBe(true);
    expect(isSlotKey('hitbox')).toBe(false);
    expect(isSlotKey('Shoulder_L.foo')).toBe(false);
    expect(isSlotKey('')).toBe(false);
  });
});

describe('readSelection / writeSelection', () => {
  it('reads only slot params', () => {
    const sp = new URLSearchParams(
      'chassis=A&Shoulder_L.Shoulder_Weapon_0=W&hitbox=0&utm=x&torso='
    );
    expect(readSelection(sp, isSlotKey)).toEqual({
      chassis: 'A',
      'Shoulder_L.Shoulder_Weapon_0': 'W',
    });
  });

  it('replaces slot params, preserving everything else', () => {
    const sp = new URLSearchParams(
      'chassis=A&Torso_Weapon_0=old&hitbox=0&future=1'
    );
    writeSelection(sp, { chassis: 'B', Shoulder_R: 'S' }, isSlotKey);
    expect(sp.toString()).toBe('hitbox=0&future=1&chassis=B&Shoulder_R=S');
  });

  it('round-trips a selection', () => {
    const selection = {
      chassis: 'DA_Module_ChassisTyphon.2',
      torso: 'DA_Module_TorsoTyphon.1',
      'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_Weapon_X.0',
    };
    const sp = new URLSearchParams(selectionQuery(selection));
    expect(readSelection(sp, isSlotKey)).toEqual(selection);
  });
});
