import { describe, it, expect } from 'vitest';
import {
  readMapQuery,
  resolveSelection,
  sortMaps,
  writeMapQuery,
} from '../../src/scripts/map_viewer/params';
import type { GameMap } from '../../src/types/map';

const map = (id: string, queued: boolean, modes: string[] = []): GameMap => ({
  id,
  name: { en: `${id} name` },
  queued,
  files: { base: `Maps/${id}.glb`, pins: `Maps/${id}.json` },
  modes: modes.map((mode) => ({ id: mode })),
});

const MAPS = [
  map('Mont', true, ['BeaconRush', 'Spearhead']),
  map('EM1', true, ['Elimination']),
  map('Tutorial', false),
];

describe('readMapQuery', () => {
  it('reads map, mode and foliage', () => {
    expect(
      readMapQuery(new URLSearchParams('map=Mont&mode=Spearhead&foliage=0'))
    ).toEqual({ map: 'Mont', mode: 'Spearhead', foliage: false });
  });

  it('defaults to no choice and foliage on', () => {
    expect(readMapQuery(new URLSearchParams('lang=es'))).toEqual({
      map: null,
      mode: null,
      foliage: true,
    });
  });
});

describe('writeMapQuery', () => {
  const write = (query: string, state: Parameters<typeof writeMapQuery>[1]) => {
    const params = new URLSearchParams(query);
    writeMapQuery(params, state);
    return params.toString();
  };

  it('writes the state and keeps other params', () => {
    expect(
      write('lang=es&mode=CTF', { map: 'EM1', mode: null, foliage: false })
    ).toBe('lang=es&map=EM1&foliage=0');
  });

  it('round-trips', () => {
    const state = { map: 'Mont', mode: 'BeaconRush', foliage: true };
    expect(readMapQuery(new URLSearchParams(write('', state)))).toEqual(state);
  });
});

describe('resolveSelection', () => {
  it('keeps a valid request', () => {
    const { map, mode } = resolveSelection(MAPS, 'Mont', 'Spearhead');
    expect([map?.id, mode]).toEqual(['Mont', 'Spearhead']);
  });

  it("falls back to the map's first mode", () => {
    const { map, mode } = resolveSelection(MAPS, 'EM1', 'Spearhead');
    expect([map?.id, mode]).toEqual(['EM1', 'Elimination']);
  });

  it('falls back to the first map', () => {
    const { map, mode } = resolveSelection(MAPS, 'Nowhere', null);
    expect([map?.id, mode]).toEqual(['Mont', 'BeaconRush']);
  });

  it('has no mode on a map without modes', () => {
    expect(resolveSelection(MAPS, 'Tutorial', 'BeaconRush').mode).toBeNull();
  });

  it('has nothing without maps', () => {
    expect(resolveSelection([], 'Mont', null)).toEqual({
      map: null,
      mode: null,
    });
  });
});

describe('sortMaps', () => {
  it('puts queued maps first, each group by name', () => {
    const names: Record<string, string> = {
      Mont: 'Fissure',
      EM1: 'Solidus Node: Depot',
      HighGround: 'Catalyst',
      Tutorial: 'Robot Training Course',
      FiringRange: 'Firing Range',
    };
    const maps = [
      map('Tutorial', false),
      map('Mont', true),
      map('FiringRange', false),
      map('EM1', true),
      map('HighGround', true),
    ];
    expect(sortMaps(maps, ({ id }) => names[id]).map(({ id }) => id)).toEqual([
      'HighGround',
      'Mont',
      'EM1',
      'FiringRange',
      'Tutorial',
    ]);
  });
});
