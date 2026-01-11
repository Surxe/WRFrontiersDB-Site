import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Rarity interface', () => {
  let rarities: Record<string, unknown>;
  let rarityArray: unknown[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const rarityPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'Rarity.json'
  );

  rarities = JSON.parse(fs.readFileSync(rarityPath, 'utf-8'));
  rarityArray = Object.values(rarities);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      rarityArray.forEach((rarity) => {
        expect(rarity).toHaveProperty('id');
        expect(typeof rarity.id).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      rarityArray.forEach((rarity) => {
        expect(rarity).toHaveProperty('name');
        expect(rarity.name).toHaveProperty('Key');
        expect(rarity.name).toHaveProperty('TableNamespace');
        expect(rarity.name).toHaveProperty('en');
        expect(typeof rarity.name.Key).toBe('string');
        expect(typeof rarity.name.TableNamespace).toBe('string');
        expect(typeof rarity.name.en).toBe('string');
      });
    });

    it('should have "hex" field in every object', () => {
      rarityArray.forEach((rarity) => {
        expect(rarity).toHaveProperty('hex');
        expect(typeof rarity.hex).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    // Rarity interface has no optional fields besides parseObjectClass and parseObjectUrl (which are set at build time)
    it('should note that Rarity has no optional fields besides build-time fields', () => {
      // This test exists to document that all fields in Rarity are required
      expect(true).toBe(true);
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'name',
        'hex',
        // parseObjectClass and parseObjectUrl are added at build time, not in raw data
      ]);

      rarityArray.forEach((rarity) => {
        const actualFields = Object.keys(rarity);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(
            true
          );
        });
      });
    });
  });

  describe('Nested structures', () => {
    it('should have valid LocalizationKey structure for name', () => {
      rarityArray.forEach((rarity) => {
        expect(rarity.name).toBeDefined();
        expect(rarity.name.Key).toBeDefined();
        expect(rarity.name.TableNamespace).toBeDefined();
        expect(rarity.name.en).toBeDefined();
        expect(typeof rarity.name.Key).toBe('string');
        expect(typeof rarity.name.TableNamespace).toBe('string');
        expect(typeof rarity.name.en).toBe('string');
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = rarityArray.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      rarityArray.forEach((rarity) => {
        expect(rarity.id.length).toBeGreaterThan(0);
        expect(rarity.name.en.length).toBeGreaterThan(0);
        expect(rarity.hex.length).toBeGreaterThan(0);
      });
    });

    it('should have valid hex color format', () => {
      rarityArray.forEach((rarity) => {
        // Hex should be a valid hex color (6 characters)
        expect(rarity.hex).toMatch(/^[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have at least one rarity object', () => {
      expect(rarityArray.length).toBeGreaterThan(0);
    });
  });
});
