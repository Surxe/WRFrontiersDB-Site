import { describe, it, expect } from 'vitest';
import type { PilotClass } from '../../../src/types/pilot';
import fs from 'fs';
import path from 'path';

describe('PilotClass interface', () => {
  let pilotClasses: Record<string, any>;
  let pilotClassArray: any[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotClassPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'PilotClass.json'
  );

  pilotClasses = JSON.parse(fs.readFileSync(pilotClassPath, 'utf-8'));
  pilotClassArray = Object.values(pilotClasses);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass).toHaveProperty('id');
        expect(typeof pilotClass.id).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass).toHaveProperty('name');
        expect(pilotClass.name).toHaveProperty('Key');
        expect(pilotClass.name).toHaveProperty('TableNamespace');
        expect(pilotClass.name).toHaveProperty('en');
        expect(typeof pilotClass.name.Key).toBe('string');
        expect(typeof pilotClass.name.TableNamespace).toBe('string');
        expect(typeof pilotClass.name.en).toBe('string');
      });
    });

    it('should have "badge" field in every object', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass).toHaveProperty('badge');
        expect(typeof pilotClass.badge).toBe('object');
      });
    });

    it('should have "badge.image_path" field in every object', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass.badge).toHaveProperty('image_path');
        expect(typeof pilotClass.badge.image_path).toBe('string');
      });
    });

    it('should have "badge.hex" field in every object', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass.badge).toHaveProperty('hex');
        expect(typeof pilotClass.badge.hex).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    // PilotClass interface has no optional fields besides parseObjectClass (which is set at build time)
    it('should note that PilotClass has no optional fields besides parseObjectClass', () => {
      // This test exists to document that all fields in PilotClass are required
      expect(true).toBe(true);
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'name',
        'badge',
        // parseObjectClass is added at build time, not in raw data
      ]);

      const allowedBadgeFields = new Set(['image_path', 'hex']);

      pilotClassArray.forEach((pilotClass) => {
        const actualFields = Object.keys(pilotClass);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(
            true
          );
        });

        if (pilotClass.badge) {
          const actualBadgeFields = Object.keys(pilotClass.badge);
          actualBadgeFields.forEach((field) => {
            expect(
              allowedBadgeFields.has(field),
              `Unexpected badge field: ${field}`
            ).toBe(true);
          });
        }
      });
    });
  });

  describe('Nested structures', () => {
    it('should have valid badge structure with image_path and hex', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass.badge).toBeDefined();
        expect(pilotClass.badge.image_path).toBeDefined();
        expect(pilotClass.badge.hex).toBeDefined();
        expect(typeof pilotClass.badge.image_path).toBe('string');
        expect(typeof pilotClass.badge.hex).toBe('string');
        // Hex should be a valid hex color (6 characters)
        expect(pilotClass.badge.hex).toMatch(/^[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have valid LocalizationKey structure for name', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass.name).toBeDefined();
        expect(pilotClass.name.Key).toBeDefined();
        expect(pilotClass.name.TableNamespace).toBeDefined();
        expect(pilotClass.name.en).toBeDefined();
        expect(typeof pilotClass.name.Key).toBe('string');
        expect(typeof pilotClass.name.TableNamespace).toBe('string');
        expect(typeof pilotClass.name.en).toBe('string');
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotClassArray.map((pc) => pc.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotClassArray.forEach((pilotClass) => {
        expect(pilotClass.id.length).toBeGreaterThan(0);
        expect(pilotClass.name.en.length).toBeGreaterThan(0);
        expect(pilotClass.badge.image_path.length).toBeGreaterThan(0);
        expect(pilotClass.badge.hex.length).toBeGreaterThan(0);
      });
    });
  });
});
