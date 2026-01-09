import { describe, it, expect } from 'vitest';
import type { PilotType } from '../../../src/types/pilot';
import fs from 'fs';
import path from 'path';

describe('PilotType interface', () => {
  let pilotTypes: Record<string, any>;
  let pilotTypeArray: any[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotTypePath = path.join(archiveDir, latestVersion, 'Objects', 'PilotType.json');

  pilotTypes = JSON.parse(fs.readFileSync(pilotTypePath, 'utf-8'));
  pilotTypeArray = Object.values(pilotTypes);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType).toHaveProperty('id');
        expect(typeof pilotType.id).toBe('string');
      });
    });

    it('should have "rarity_id" field in every object', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType).toHaveProperty('rarity_id');
        expect(typeof pilotType.rarity_id).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType).toHaveProperty('name');
        expect(pilotType.name).toHaveProperty('Key');
        expect(pilotType.name).toHaveProperty('TableNamespace');
        expect(pilotType.name).toHaveProperty('en');
        expect(typeof pilotType.name.Key).toBe('string');
        expect(typeof pilotType.name.TableNamespace).toBe('string');
        expect(typeof pilotType.name.en).toBe('string');
      });
    });

    it('should have "group_reward_id" field in every object', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType).toHaveProperty('group_reward_id');
        expect(typeof pilotType.group_reward_id).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    it('should have at least one object with "has_extended_bio" field', () => {
      const withHasExtendedBio = pilotTypeArray.filter((pt) => 
        pt.hasOwnProperty('has_extended_bio')
      );
      expect(withHasExtendedBio.length).toBeGreaterThan(0);
      withHasExtendedBio.forEach((pilotType) => {
        expect(typeof pilotType.has_extended_bio).toBe('boolean');
      });
    });

    it('should have at least one object with "can_change_talents" field', () => {
      const withCanChangeTalents = pilotTypeArray.filter((pt) => 
        pt.hasOwnProperty('can_change_talents')
      );
      expect(withCanChangeTalents.length).toBeGreaterThan(0);
      withCanChangeTalents.forEach((pilotType) => {
        expect(typeof pilotType.can_change_talents).toBe('boolean');
      });
    });

    it('should have at least one object with "sort_order" field', () => {
      const withSortOrder = pilotTypeArray.filter((pt) => 
        pt.hasOwnProperty('sort_order')
      );
      expect(withSortOrder.length).toBeGreaterThan(0);
      withSortOrder.forEach((pilotType) => {
        expect(typeof pilotType.sort_order).toBe('number');
      });
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'rarity_id',
        'name',
        'group_reward_id',
        'has_extended_bio',
        'can_change_talents',
        'sort_order',
        // parseObjectClass is added at build time, not in raw data
      ]);

      pilotTypeArray.forEach((pilotType) => {
        const actualFields = Object.keys(pilotType);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(true);
        });
      });
    });
  });

  describe('Nested structures', () => {
    it('should have valid LocalizationKey structure for name', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType.name).toBeDefined();
        expect(pilotType.name.Key).toBeDefined();
        expect(pilotType.name.TableNamespace).toBeDefined();
        expect(pilotType.name.en).toBeDefined();
        expect(typeof pilotType.name.Key).toBe('string');
        expect(typeof pilotType.name.TableNamespace).toBe('string');
        expect(typeof pilotType.name.en).toBe('string');
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotTypeArray.map((pt) => pt.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotTypeArray.forEach((pilotType) => {
        expect(pilotType.id.length).toBeGreaterThan(0);
        expect(pilotType.rarity_id.length).toBeGreaterThan(0);
        expect(pilotType.name.en.length).toBeGreaterThan(0);
        expect(pilotType.group_reward_id.length).toBeGreaterThan(0);
      });
    });

    it('should have valid sort_order values when present', () => {
      pilotTypeArray.forEach((pilotType) => {
        if (pilotType.hasOwnProperty('sort_order')) {
          expect(typeof pilotType.sort_order).toBe('number');
          expect(pilotType.sort_order).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
