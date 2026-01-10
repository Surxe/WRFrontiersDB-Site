import { describe, it, expect } from 'vitest';
import type { Pilot } from '../../../src/types/pilot';
import fs from 'fs';
import path from 'path';

describe('Pilot interface', () => {
  let pilots: Record<string, any>;
  let pilotArray: any[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'Pilot.json'
  );

  pilots = JSON.parse(fs.readFileSync(pilotPath, 'utf-8'));
  pilotArray = Object.values(pilots);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('id');
        expect(typeof pilot.id).toBe('string');
      });
    });

    it('should have "first_name" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('first_name');
        expect(pilot.first_name).toHaveProperty('Key');
        expect(pilot.first_name).toHaveProperty('TableNamespace');
        expect(pilot.first_name).toHaveProperty('en');
        expect(typeof pilot.first_name.Key).toBe('string');
        expect(typeof pilot.first_name.TableNamespace).toBe('string');
        expect(typeof pilot.first_name.en).toBe('string');
      });
    });

    it('should have "image_path" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('image_path');
        expect(typeof pilot.image_path).toBe('string');
      });
    });

    it('should have "bio" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('bio');
        expect(pilot.bio).toHaveProperty('Key');
        expect(pilot.bio).toHaveProperty('TableNamespace');
        expect(pilot.bio).toHaveProperty('en');
        expect(typeof pilot.bio.Key).toBe('string');
        expect(typeof pilot.bio.TableNamespace).toBe('string');
        expect(typeof pilot.bio.en).toBe('string');
      });
    });

    it('should have "pilot_type_id" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('pilot_type_id');
        expect(typeof pilot.pilot_type_id).toBe('string');
      });
    });

    it('should have "pilot_class_id" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('pilot_class_id');
        expect(typeof pilot.pilot_class_id).toBe('string');
      });
    });

    it('should have "personality_id" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('personality_id');
        expect(typeof pilot.personality_id).toBe('string');
      });
    });

    it('should have "faction_id" field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('faction_id');
        expect(typeof pilot.faction_id).toBe('string');
      });
    });

    it('should have "sell_price" object field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('sell_price');
        expect(typeof pilot.sell_price).toBe('object');
        expect(pilot.sell_price).toHaveProperty('currency_id');
        expect(pilot.sell_price).toHaveProperty('amount');
        expect(typeof pilot.sell_price.currency_id).toBe('string');
        expect(typeof pilot.sell_price.amount).toBe('number');
      });
    });

    it('should have "levels" array field in every object', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot).toHaveProperty('levels');
        expect(Array.isArray(pilot.levels)).toBe(true);
        expect(pilot.levels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Optional fields', () => {
    it('should have at least one object with "second_name" field', () => {
      const withSecondName = pilotArray.filter((p) =>
        p.hasOwnProperty('second_name')
      );
      expect(withSecondName.length).toBeGreaterThan(0);
      withSecondName.forEach((pilot) => {
        expect(pilot.second_name).toHaveProperty('Key');
        expect(pilot.second_name).toHaveProperty('TableNamespace');
        expect(pilot.second_name).toHaveProperty('en');
        expect(typeof pilot.second_name.Key).toBe('string');
        expect(typeof pilot.second_name.TableNamespace).toBe('string');
        expect(typeof pilot.second_name.en).toBe('string');
      });
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'first_name',
        'second_name',
        'image_path',
        'bio',
        'pilot_type_id',
        'pilot_class_id',
        'personality_id',
        'faction_id',
        'sell_price',
        'levels',
        // parseObjectClass is added at build time, not in raw data
      ]);

      pilotArray.forEach((pilot) => {
        const actualFields = Object.keys(pilot);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(
            true
          );
        });
      });
    });
  });

  describe('Nested structures - LocalizationKeys', () => {
    it('should have valid LocalizationKey structure for first_name', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot.first_name).toBeDefined();
        expect(pilot.first_name.Key).toBeDefined();
        expect(pilot.first_name.TableNamespace).toBeDefined();
        expect(pilot.first_name.en).toBeDefined();
        expect(typeof pilot.first_name.Key).toBe('string');
        expect(typeof pilot.first_name.TableNamespace).toBe('string');
        expect(typeof pilot.first_name.en).toBe('string');
      });
    });

    it('should have valid LocalizationKey structure for second_name when present', () => {
      pilotArray.forEach((pilot) => {
        if (pilot.hasOwnProperty('second_name')) {
          expect(pilot.second_name).toBeDefined();
          expect(pilot.second_name.Key).toBeDefined();
          expect(pilot.second_name.TableNamespace).toBeDefined();
          expect(pilot.second_name.en).toBeDefined();
          expect(typeof pilot.second_name.Key).toBe('string');
          expect(typeof pilot.second_name.TableNamespace).toBe('string');
          expect(typeof pilot.second_name.en).toBe('string');
        }
      });
    });

    it('should have valid LocalizationKey structure for bio', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot.bio).toBeDefined();
        expect(pilot.bio.Key).toBeDefined();
        expect(pilot.bio.TableNamespace).toBeDefined();
        expect(pilot.bio.en).toBeDefined();
        expect(typeof pilot.bio.Key).toBe('string');
        expect(typeof pilot.bio.TableNamespace).toBe('string');
        expect(typeof pilot.bio.en).toBe('string');
      });
    });
  });

  describe('Nested structures - sell_price', () => {
    it('should have valid sell_price structure', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot.sell_price).toBeDefined();
        expect(pilot.sell_price.currency_id).toBeDefined();
        expect(pilot.sell_price.amount).toBeDefined();
        expect(typeof pilot.sell_price.currency_id).toBe('string');
        expect(typeof pilot.sell_price.amount).toBe('number');
        expect(pilot.sell_price.amount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should not have extra fields in sell_price objects', () => {
      const allowedSellPriceFields = new Set(['currency_id', 'amount']);

      pilotArray.forEach((pilot) => {
        const actualFields = Object.keys(pilot.sell_price);
        actualFields.forEach((field) => {
          expect(
            allowedSellPriceFields.has(field),
            `Unexpected sell_price field: ${field}`
          ).toBe(true);
        });
      });
    });
  });

  describe('Nested structures - levels array', () => {
    it('should have valid levels array structure', () => {
      pilotArray.forEach((pilot) => {
        expect(Array.isArray(pilot.levels)).toBe(true);
        expect(pilot.levels.length).toBeGreaterThan(0);

        pilot.levels.forEach((level: any) => {
          expect(level).toHaveProperty('talent_type_id');
          expect(level).toHaveProperty('talents');
          expect(typeof level.talent_type_id).toBe('string');
          expect(Array.isArray(level.talents)).toBe(true);
        });
      });
    });

    it('should have at least one level with "reputation_cost" field', () => {
      let foundReputationCost = false;

      pilotArray.forEach((pilot) => {
        pilot.levels.forEach((level: any) => {
          if (level.hasOwnProperty('reputation_cost')) {
            foundReputationCost = true;
            expect(typeof level.reputation_cost).toBe('number');
            expect(level.reputation_cost).toBeGreaterThanOrEqual(0);
          }
        });
      });

      expect(foundReputationCost).toBe(true);
    });

    it('should have valid upgrade_cost structure in levels when present', () => {
      pilotArray.forEach((pilot) => {
        pilot.levels.forEach((level: any) => {
          if (level.hasOwnProperty('upgrade_cost')) {
            expect(level.upgrade_cost).toHaveProperty('currency_id');
            expect(level.upgrade_cost).toHaveProperty('amount');
            expect(typeof level.upgrade_cost.currency_id).toBe('string');
            expect(typeof level.upgrade_cost.amount).toBe('number');
            expect(level.upgrade_cost.amount).toBeGreaterThanOrEqual(0);
          }
        });
      });
    });

    it('should have non-empty talents array in each level', () => {
      pilotArray.forEach((pilot) => {
        pilot.levels.forEach((level: any) => {
          expect(level.talents.length).toBeGreaterThan(0);
          level.talents.forEach((talent: any) => {
            expect(typeof talent).toBe('string');
            expect(talent.length).toBeGreaterThan(0);
          });
        });
      });
    });

    it('should not have extra fields in level objects', () => {
      const allowedLevelFields = new Set([
        'talent_type_id',
        'talents',
        'reputation_cost',
        'upgrade_cost',
      ]);

      pilotArray.forEach((pilot) => {
        pilot.levels.forEach((level: any) => {
          const actualFields = Object.keys(level);
          actualFields.forEach((field) => {
            expect(
              allowedLevelFields.has(field),
              `Unexpected level field: ${field}`
            ).toBe(true);
          });
        });
      });
    });

    it('should not have extra fields in upgrade_cost objects when present', () => {
      const allowedUpgradeCostFields = new Set(['currency_id', 'amount']);

      pilotArray.forEach((pilot) => {
        pilot.levels.forEach((level: any) => {
          if (level.hasOwnProperty('upgrade_cost')) {
            const actualFields = Object.keys(level.upgrade_cost);
            actualFields.forEach((field) => {
              expect(
                allowedUpgradeCostFields.has(field),
                `Unexpected upgrade_cost field: ${field}`
              ).toBe(true);
            });
          }
        });
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotArray.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot.id.length).toBeGreaterThan(0);
        expect(pilot.first_name.en.length).toBeGreaterThan(0);
        expect(pilot.image_path.length).toBeGreaterThan(0);
        expect(pilot.pilot_type_id.length).toBeGreaterThan(0);
        expect(pilot.pilot_class_id.length).toBeGreaterThan(0);
        expect(pilot.personality_id.length).toBeGreaterThan(0);
        expect(pilot.faction_id.length).toBeGreaterThan(0);
      });
    });

    it('should have valid image paths', () => {
      pilotArray.forEach((pilot) => {
        expect(pilot.image_path.length).toBeGreaterThan(0);
        // Typically these paths contain 'Textures' in them
        expect(pilot.image_path).toMatch(/Textures/);
      });
    });

    it('should have multiple levels', () => {
      pilotArray.forEach((pilot) => {
        // Most pilots should have multiple levels
        expect(pilot.levels.length).toBeGreaterThan(1);
      });
    });
  });
});
