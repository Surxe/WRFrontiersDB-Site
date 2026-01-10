import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PilotTalentType interface', () => {
  let pilotTalentTypes: Record<string, unknown>;
  let pilotTalentTypeArray: unknown[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotTalentTypePath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'PilotTalentType.json'
  );

  pilotTalentTypes = JSON.parse(fs.readFileSync(pilotTalentTypePath, 'utf-8'));
  pilotTalentTypeArray = Object.values(pilotTalentTypes);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType).toHaveProperty('id');
        expect(typeof talentType.id).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType).toHaveProperty('name');
        expect(talentType.name).toHaveProperty('Key');
        expect(talentType.name).toHaveProperty('TableNamespace');
        expect(talentType.name).toHaveProperty('en');
        expect(typeof talentType.name.Key).toBe('string');
        expect(typeof talentType.name.TableNamespace).toBe('string');
        expect(typeof talentType.name.en).toBe('string');
      });
    });

    it('should have "description" field in every object', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType).toHaveProperty('description');
        expect(talentType.description).toHaveProperty('Key');
        expect(talentType.description).toHaveProperty('TableNamespace');
        expect(talentType.description).toHaveProperty('en');
        expect(typeof talentType.description.Key).toBe('string');
        expect(typeof talentType.description.TableNamespace).toBe('string');
        expect(typeof talentType.description.en).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    // PilotTalentType interface has no optional fields besides parseObjectClass (which is set at build time)
    it('should note that PilotTalentType has no optional fields besides parseObjectClass', () => {
      // This test exists to document that all fields in PilotTalentType are required
      expect(true).toBe(true);
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'name',
        'description',
        'image_path',
        // parseObjectClass is added at build time, not in raw data
      ]);

      pilotTalentTypeArray.forEach((talentType) => {
        const actualFields = Object.keys(talentType);
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
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType.name).toBeDefined();
        expect(talentType.name.Key).toBeDefined();
        expect(talentType.name.TableNamespace).toBeDefined();
        expect(talentType.name.en).toBeDefined();
        expect(typeof talentType.name.Key).toBe('string');
        expect(typeof talentType.name.TableNamespace).toBe('string');
        expect(typeof talentType.name.en).toBe('string');
      });
    });

    it('should have valid LocalizationKey structure for description when present', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        if (Object.prototype.hasOwnProperty.call(talentType, 'description')) {
          expect(talentType.description).toBeDefined();
          expect(talentType.description.Key).toBeDefined();
          expect(talentType.description.TableNamespace).toBeDefined();
          expect(talentType.description.en).toBeDefined();
          expect(typeof talentType.description.Key).toBe('string');
          expect(typeof talentType.description.TableNamespace).toBe('string');
          expect(typeof talentType.description.en).toBe('string');
        }
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotTalentTypeArray.map((tt) => tt.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType.id.length).toBeGreaterThan(0);
        expect(talentType.name.en.length).toBeGreaterThan(0);
        expect(talentType.image_path.length).toBeGreaterThan(0);
      });
    });

    it('should have valid image paths', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType.image_path.length).toBeGreaterThan(0);
        // Typically these paths contain 'Textures' in them
        expect(talentType.image_path).toMatch(/Textures/);
      });
    });
  });
});
