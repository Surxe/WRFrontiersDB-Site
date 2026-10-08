import { describe, it, expect } from 'vitest';
import langs from '../../../public/langs.json';
import {
  moduleMetaBody,
  generateModuleStatSummaries,
  moduleStatLineText,
  precomputeMetaBodies,
  pilotMetaBody,
  pilotTalentMetaBody,
  statEmbeddedText,
} from '../../../src/utils/meta_description';
import type { Pilot, PilotTalent } from '../../../src/types/pilot';
import type { Module } from '../../../src/types/module';
import type { ModuleStatLine } from '../../../src/utils/module_stats';
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

describe('moduleMetaBody stat summary', () => {
  const statLine = (
    label: string,
    value: number,
    unitScaler = 1
  ): ModuleStatLine => ({
    kind: 'stat',
    display: {
      labelKey: text(label),
      pattern: '{Amount}{Unit}',
      shortKey: label,
      unitScaler,
    },
    value,
  });
  const lines: ModuleStatLine[] = [
    { kind: 'slots', label: text('Light Weapon'), count: 2 },
    statLine('Armor', 52100),
    statLine('Shield Cooldown Reduction', 0.05, 100),
  ];
  const mod = (fields: Partial<Module>) =>
    ({
      id: 'M.0',
      parseObjectClass: 'Module',
      name: text('Ares'),
      ...fields,
    }) as unknown as Module;

  it('formats each line in the language', () => {
    expect(moduleStatLineText(lines[0], 'en')).toBe('Light Weapon ×2');
    expect(moduleStatLineText(lines[1], 'en')).toBe('Armor: 52,100');
    expect(moduleStatLineText(lines[2], 'en')).toBe(
      'Shield Cooldown Reduction: 5'
    );
  });

  it('shows the stats when the module has no text', () => {
    expect(moduleMetaBody(mod({}), {}, [], 0, [lines.slice(0, 2), lines.slice(2)])('en')).toBe(
      'Light Weapon ×2\nArmor: 52,100\nShield Cooldown Reduction: 5'
    );
  });

  it('keeps the module text first', () => {
    const withText = mod({ description: text('Pulls a target in.') });
    expect(moduleMetaBody(withText, {}, [], 0, [[lines[1]]])('en')).toBe(
      'Pulls a target in.\nArmor: 52,100'
    );
  });

  it('gives consumers the lead text and the stats as rows of fields', () => {
    const withText = mod({ description: text('Pulls a target in.') });
    const summaries = generateModuleStatSummaries(withText, {}, [], 0, [
      lines.slice(0, 2),
      lines.slice(2),
    ]);
    expect(summaries?.en).toEqual({
      lead: 'Pulls a target in.',
      rows: [
        [
          { name: 'Light Weapon', value: '×2' },
          { name: 'Armor', value: '52,100' },
        ],
        [{ name: 'Shield Cooldown Reduction', value: '5' }],
      ],
    });
    expect(Object.keys(summaries ?? {})).toContain('de');
  });

  it('has no summary without stats', () => {
    expect(generateModuleStatSummaries(mod({}), {}, [], 0, [])).toBeNull();
  });
});
