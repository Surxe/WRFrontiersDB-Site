import { describe, it, expect } from 'vitest';
import langs from '../../../public/langs.json';
import {
  precomputeMetaBodies,
  pilotMetaBody,
  pilotTalentMetaBody,
  statEmbeddedText,
} from '../../../src/utils/meta_description';
import type { Pilot, PilotTalent } from '../../../src/types/pilot';
import type { StatValueChoices } from '../../../src/types/stat';

// Keys without Key/TableNamespace resolve to their InvariantString in every
// language, so these tests don't depend on the game localization data.
const text = (value: string) => ({ InvariantString: value });

const talent = (id: string, name: string, description = '') =>
  ({
    id,
    parseObjectClass: 'PilotTalent',
    name: text(name),
    description: text(description),
  }) as unknown as PilotTalent;

const talents: Record<string, PilotTalent> = {
  'T_A.0': talent('T_A.0', 'Alpha'),
  'T_B.0': talent('T_B.0', 'Bravo'),
  'T_C.0': talent('T_C.0', 'Charlie'),
};

const pilot = (levels: string[][]) =>
  ({
    id: 'P.0',
    parseObjectClass: 'Pilot',
    first_name: text('Test'),
    levels: levels.map((refs) => ({
      talent_type_ref: 'TT.0',
      talents_refs: refs.map((id) => `OBJID_PilotTalent::${id}`),
    })),
  }) as unknown as Pilot;

describe('precomputeMetaBodies', () => {
  it('builds one body per supported language', () => {
    const bodies = precomputeMetaBodies((lang) => `body ${lang}`);
    expect(bodies.map((b) => b.lang)).toEqual(Object.keys(langs));
    expect(bodies.every((b) => b.description === `body ${b.lang}`)).toBe(true);
  });

  it('falls back to English for empty languages, and to fallback for English', () => {
    expect(
      precomputeMetaBodies((lang) => (lang === 'en' ? 'english' : ''))
        .map((b) => b.description)
        .every((d) => d === 'english')
    ).toBe(true);
    expect(
      precomputeMetaBodies(() => '', 'fallback').every(
        (b) => b.description === 'fallback'
      )
    ).toBe(true);
  });

  it('strips game markup from every body', () => {
    expect(
      precomputeMetaBodies(
        () => 'Supply Gear: <Orange>Supply Gear</> modules'
      ).every((b) => b.description === 'Supply Gear: Supply Gear modules')
    ).toBe(true);
  });
});

describe('pilotMetaBody', () => {
  it('lists every talent, one line per level', () => {
    const body = pilotMetaBody(
      pilot([['T_A.0', 'T_B.0'], ['T_C.0']]),
      talents
    )('en');
    expect(body).toBe('L1: Alpha, Bravo\nL2: Charlie');
  });

  it('skips empty levels but keeps the real level number', () => {
    const body = pilotMetaBody(pilot([[], ['T_A.0']]), talents)('en');
    expect(body).toBe('L2: Alpha');
  });
});

describe('statEmbeddedText / pilotTalentMetaBody', () => {
  const choices: StatValueChoices = {
    Reload: {
      pattern: '{Amount}{Unit}',
      unitName: '%' as unknown as StatValueChoices[string]['unitName'],
      shortKey: 'Reload',
      choices: { 0: 5, 1: 10 },
    },
  };

  it('embeds the chosen stat value, whitespace collapsed', () => {
    const key = text('Reload  {Reload} faster.');
    expect(statEmbeddedText(key, choices, 'en')).toBe('Reload 5% faster.');
    expect(statEmbeddedText(key, choices, 'en', 1)).toBe('Reload 10% faster.');
  });

  it('uses the talent description as the talent body', () => {
    const t = talent('T_D.0', 'Delta', 'Reload {Reload} faster.');
    expect(pilotTalentMetaBody(t, choices)('en')).toBe('Reload 5% faster.');
  });
});
