import { describe, it, expect } from 'vitest';
import {
  describePins,
  firstSpawn,
  powerupName,
} from '../../src/scripts/map_viewer/pins';
import {
  NO_TEAM_COLOR,
  PIN_COLORS,
  TEAM_COLORS,
} from '../../src/scripts/map_viewer/colors';
import type { Pin } from '../../src/types/map';

const at = (x: number): [number, number, number] => [x, 0, 0];

describe('powerupName', () => {
  it('reads the Blueprint name', () => {
    expect(powerupName('BP_PowerUp_DoubleDamage')).toBe('Double Damage');
    expect(powerupName('BP_PowerUp_TeamRegenArmor')).toBe('Team Regen Armor');
    expect(powerupName('BP_PowerUp_GameModeScore')).toBe('Game Mode Score');
  });
});

describe('describePins', () => {
  it('colors spawns and CTF objects by team', () => {
    const pins: Pin[] = [
      { type: 'spawn', team: 0, position: at(1), yaw: 90 },
      { type: 'spawn', team: 1, position: at(2), yaw: 0 },
      { type: 'ctf_core', team: 1, position: at(3), yaw: 0 },
      { type: 'ctf_upload_zone', position: at(4), yaw: 0 },
    ];
    expect(describePins(pins, {}).map(({ color }) => color)).toEqual([
      TEAM_COLORS[0],
      TEAM_COLORS[1],
      TEAM_COLORS[1],
      NO_TEAM_COLOR,
    ]);
  });

  it('keeps order and zone for beacons and probes', () => {
    const [beacon, probe] = describePins(
      [
        {
          type: 'beacon',
          position: at(1),
          yaw: 0,
          order: 3,
          zone_radius: 5000,
        },
        { type: 'warp_probe', position: at(2), yaw: 0, order: 1 },
      ],
      {}
    );
    expect(beacon).toMatchObject({
      color: PIN_COLORS.beacon,
      order: 3,
      zoneRadius: 5000,
    });
    expect(probe).toMatchObject({ color: PIN_COLORS.warp_probe, order: 1 });
    expect(probe.zoneRadius).toBeUndefined();
  });

  it("names a spawner's power-ups and takes the first one's color", () => {
    const [spawner] = describePins(
      [
        {
          type: 'powerup_spawner',
          position: at(1),
          yaw: 0,
          powerup_ids: ['BP_PowerUp_DoubleDamage', 'BP_PowerUp_Unknown'],
        },
      ],
      {
        BP_PowerUp_DoubleDamage: {
          icon_path: '/WRFrontiers/Content/T_MinimapDoubleDamage',
          icon_color: { Hex: 'FCB997' },
        },
      }
    );
    expect(spawner.color).toBe(0xfcb997);
    expect(spawner.powerups).toEqual([
      {
        id: 'BP_PowerUp_DoubleDamage',
        name: 'Double Damage',
        iconPath: '/WRFrontiers/Content/T_MinimapDoubleDamage',
      },
      { id: 'BP_PowerUp_Unknown', name: 'Unknown' },
    ]);
  });

  it('falls back to the spawner color without power-up data', () => {
    const [spawner] = describePins(
      [{ type: 'powerup_spawner', position: at(1), yaw: 0, powerup_ids: [] }],
      {}
    );
    expect(spawner.color).toBe(PIN_COLORS.powerup_spawner);
  });
});

describe('firstSpawn', () => {
  it("is the first team's first spawn", () => {
    const pins: Pin[] = [
      { type: 'beacon', position: at(0), yaw: 0 },
      { type: 'spawn', team: 1, position: at(1), yaw: 0 },
      { type: 'spawn', team: 0, position: at(2), yaw: 0 },
    ];
    expect(firstSpawn(pins)?.position).toEqual(at(2));
  });

  it('is any spawn without team 0, else none', () => {
    expect(
      firstSpawn([{ type: 'spawn', team: 1, position: at(1), yaw: 0 }])?.team
    ).toBe(1);
    expect(firstSpawn([{ type: 'drill', position: at(1), yaw: 0 }])).toBeNull();
  });
});
