import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  modelsPageHref,
  readModelQuery,
  writeModelQuery,
  type ModelUrlState,
} from '../../src/scripts/model_viewer/params';
import {
  BuildCodec,
  type BuildCodesDoc,
} from '../../src/scripts/robot/build/code';
import { slotKeyMatcher } from '../../src/scripts/robot/build/params';

const data = path.join(process.cwd(), 'WRFrontiersDB-Data', 'index');
const codec = new BuildCodec(
  JSON.parse(
    fs.readFileSync(path.join(data, 'build_codes.json'), 'utf8')
  ) as BuildCodesDoc
);
const [v1, v2] = (
  JSON.parse(
    fs.readFileSync(path.join(data, 'build_code_vectors.json'), 'utf8')
  ) as { vectors: { code: string; build: Record<string, string> }[] }
).vectors;

const isSlotKey = slotKeyMatcher(
  new Set(['Root', 'Shoulder_L', 'Shoulder_R', 'Shoulder_Weapon_0', 'Ability'])
);

const view = { compareLayout: 'overlap', mesh: true, hitbox: true } as const;
const read = (query: string) =>
  readModelQuery(new URLSearchParams(query), isSlotKey, codec);
const write = (query: string, state: ModelUrlState, c = codec) => {
  const params = new URLSearchParams(query);
  writeModelQuery(params, state, isSlotKey, c);
  return params.toString();
};

describe('readModelQuery', () => {
  it('reads build A from its code', () => {
    const state = read(`a=${v1.code}`);
    expect(state.selection).toEqual(v1.build);
    expect(state.compareBuild).toBeNull();
    expect(state.codeProblem).toBeNull();
  });

  it('reads build B from its code, which turns compare on', () => {
    const state = read(`a=${v1.code}&b=${v2.code}&layout=side`);
    expect(state.compareBuild).toEqual(v2.build);
    expect(state.compareLayout).toBe('side');
  });

  it('ignores readable build params when a code is present', () => {
    const state = read(`a=${v1.code}&chassis=X&compare=1&b.torso=Y`);
    expect(state.selection).toEqual(v1.build);
    expect(state.compare).toBeNull();
  });

  it('flags a too-new code and falls back to the default robot', () => {
    const state = read('a=_00&b=0');
    expect(state.codeProblem).toBe('tooNew');
    expect(state.selection).toEqual({});
    expect(state.compareBuild).toBeNull();
  });

  it('flags a code that is not a build code', () => {
    expect(read('a=*').codeProblem).toBe('invalid');
    expect(read(`a=${v1.code}&b=*`).codeProblem).toBe('invalid');
  });

  it('still reads readable params', () => {
    const state = read('chassis=C&Shoulder_L=S&compare=1&b.Ability=&mesh=0');
    expect(state.selection).toEqual({ chassis: 'C', Shoulder_L: 'S' });
    expect(state.compare).toEqual({ Ability: null });
    expect(state.compareBuild).toBeNull();
    expect(state.mesh).toBe(false);
  });
});

describe('writeModelQuery', () => {
  it('writes codes, replacing readable build params and keeping the rest', () => {
    const query = write('chassis=X&compare=1&b.torso=Y&lang=de', {
      ...view,
      selection: v1.build,
      compare: { selection: v2.build, overrides: { torso: 'ignored' } },
      compareLayout: 'side',
    });
    expect(query).toBe(`lang=de&a=${v1.code}&b=${v2.code}&layout=side`);
  });

  it('drops b and layout when not comparing', () => {
    const query = write(`a=x&b=y&layout=side`, {
      ...view,
      selection: v1.build,
      compare: null,
    });
    expect(query).toBe(`a=${v1.code}`);
  });

  it('writes mesh and hitbox only when off', () => {
    const query = write('mesh=0&hitbox=1&lang=en', {
      ...view,
      selection: v1.build,
      compare: null,
      mesh: true,
      hitbox: false,
    });
    expect(query).toBe(`hitbox=0&lang=en&a=${v1.code}`);
  });

  it('falls back to readable params when a build cannot be encoded', () => {
    const unreleased = { ...v1.build, chassis: 'DA_Module_NotReleased.0' };
    const query = write(`a=old`, {
      ...view,
      selection: v1.build,
      compare: { selection: unreleased, overrides: { chassis: 'Z' } },
    });
    const params = new URLSearchParams(query);
    expect(params.has('a')).toBe(false);
    expect(params.has('b')).toBe(false);
    expect(params.get('chassis')).toBe(v1.build.chassis);
    expect(params.get('compare')).toBe('1');
    expect(params.get('b.chassis')).toBe('Z');
  });

  it('round-trips through readModelQuery', () => {
    const query = write('', {
      ...view,
      selection: v1.build,
      compare: { selection: v2.build, overrides: {} },
    });
    const state = read(query);
    expect(state.selection).toEqual(v1.build);
    expect(state.compareBuild).toEqual(v2.build);
  });
});

describe('modelsPageHref', () => {
  it('links with a code', () => {
    expect(modelsPageHref(v1.build, codec)).toBe(`/models?a=${v1.code}`);
  });

  it('links with readable params without a registry', () => {
    expect(modelsPageHref({ chassis: 'C' }, null)).toBe('/models?chassis=C');
  });
});
