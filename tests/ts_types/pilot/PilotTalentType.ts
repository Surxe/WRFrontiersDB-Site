import { describe, it, expect } from 'vitest';
import type { PilotTalentType } from '../../../src/types/pilot';
import fs from 'fs';
import path from 'path';

describe('PilotTalentType interface', () => {
  let pilotTalentTypes: Record<string, any>;
  let pilotTalentTypeArray: any[];

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

    it('should have "image_path" field in every object', () => {
      pilotTalentTypeArray.forEach((talentType) => {
        expect(talentType).toHaveProperty('image_path');
        expect(typeof talentType.image_path).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    it('should have at least one object with "description" field', () => {
      const withDescription = pilotTalentTypeArray.filter((tt) =>
        tt.hasOwnProperty('description')
      );
      expect(withDescription.length).toBeGreaterThan(0);
      withDescription.forEach((talentType) => {
        expect(talentType.description).toHaveProperty('Key');
        expect(talentType.description).toHaveProperty('TableNamespace');
        expect(talentType.description).toHaveProperty('en');
        expect(typeof talentType.description.Key).toBe('string');
        expect(typeof talentType.description.TableNamespace).toBe('string');
        expect(typeof talentType.description.en).toBe('string');
      });
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
        if (talentType.hasOwnProperty('description')) {
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
