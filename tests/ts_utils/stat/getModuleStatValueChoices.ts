import { describe, it, expect } from 'vitest';
import { getModuleStatValueChoices } from '../../../src/utils/stat';
import type {
  Module,
  ModuleStat,
  ModuleStatsTable,
} from '../../../src/types/module';

const stat = (id: string, shortKey: string) =>
  ({ id, short_key: shortKey }) as unknown as ModuleStat;

const moduleStats: Record<string, ModuleStat> = {
  'Duration.0': stat('Duration.0', 'Duration'),
  'Cooldown.0': stat('Cooldown.0', 'Cooldown'),
  'ChargeDrain.0': stat('ChargeDrain.0', 'ChargeDrain'),
  'Consumables.0': stat('Consumables.0', 'Consum'),
};

const tables = {
  'Table.0': {
    id: 'Table.0',
    stats_refs: {
      Cooldown: 'OBJID_ModuleStat::Cooldown.0',
      ChargeDrain: 'OBJID_ModuleStat::ChargeDrain.0',
    },
  },
} as unknown as Record<string, ModuleStatsTable>;

const stats = {
  ChargeDuration: {
    id: 'ChargeDuration',
    module_stat_ref: 'OBJID_ModuleStat::ChargeDrain.0',
  },
  MaxCharges: {
    id: 'MaxCharges',
    module_stat_ref: 'OBJID_ModuleStat::Consumables.0',
  },
};

const gear = {
  id: 'Gear.0',
  module_stats_table_ref: 'OBJID_ModuleStatsTable::Table.0',
  module_scalars: {
    primary_stat_ref: 'OBJID_ModuleStat::Duration.0',
    levels: {
      constants: { MaxCharges: 4, ID: 'Gear' },
      variables: [
        { PrimaryParameter: 3, Cooldown: 40, ChargeDuration: 399 },
        { PrimaryParameter: 4, Cooldown: 35, ChargeDuration: 300 },
      ],
    },
  },
} as unknown as Module;

const choicesOf = (...args: Parameters<typeof getModuleStatValueChoices>) =>
  Object.fromEntries(
    Object.entries(getModuleStatValueChoices(...args)).map(([key, value]) => [
      key,
      value.choices,
    ])
  );

describe('getModuleStatValueChoices', () => {
  it('maps the parameters by their stat refs and level keys by the stats table', () => {
    expect(choicesOf(gear, moduleStats, tables)).toEqual({
      Duration: { 0: 3, 1: 4 },
      Cooldown: { 0: 40, 1: 35 },
    });
  });

  it('maps level keys the table lacks through Stat.json', () => {
    expect(
      choicesOf(gear, moduleStats, tables, undefined, stats).ChargeDrain
    ).toEqual({ 0: 399, 1: 300 });
  });

  it('gives a numeric level constant the same value at every level', () => {
    const choices = choicesOf(gear, moduleStats, tables, undefined, stats);
    expect(choices.Consum).toEqual({ 0: 4, 1: 4 });
    expect(Object.keys(choices).sort()).toEqual([
      'ChargeDrain',
      'Consum',
      'Cooldown',
      'Duration',
    ]);
  });

  it('keeps only the stats the description uses', () => {
    expect(
      Object.keys(
        choicesOf(gear, moduleStats, tables, 'Charge: {ChargeDrain}.', stats)
      )
    ).toEqual(['ChargeDrain']);
  });
});
