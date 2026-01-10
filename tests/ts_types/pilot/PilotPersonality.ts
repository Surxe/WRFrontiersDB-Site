import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PilotPersonality interface', () => {
  let pilotPersonalities: Record<string, unknown>;
  let pilotPersonalityArray: unknown[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotPersonalityPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'PilotPersonality.json'
  );

  pilotPersonalities = JSON.parse(
    fs.readFileSync(pilotPersonalityPath, 'utf-8')
  );
  pilotPersonalityArray = Object.values(pilotPersonalities);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotPersonalityArray.forEach((personality) => {
        expect(personality).toHaveProperty('id');
        expect(typeof personality.id).toBe('string');
      });
    });

    it('should have "icon_path" field in every object', () => {
      pilotPersonalityArray.forEach((personality) => {
        expect(personality).toHaveProperty('icon_path');
        expect(typeof personality.icon_path).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      pilotPersonalityArray.forEach((personality) => {
        expect(personality).toHaveProperty('name');
        expect(personality.name).toHaveProperty('Key');
        expect(personality.name).toHaveProperty('TableNamespace');
        expect(personality.name).toHaveProperty('en');
        expect(typeof personality.name.Key).toBe('string');
        expect(typeof personality.name.TableNamespace).toBe('string');
        expect(typeof personality.name.en).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    // PilotPersonality interface has no optional fields besides parseObjectClass (which is set at build time)
    it('should note that PilotPersonality has no optional fields besides parseObjectClass', () => {
      // This test exists to document that all fields in PilotPersonality are required
      expect(true).toBe(true);
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'icon_path',
        'name',
        // parseObjectClass is added at build time, not in raw data
      ]);

      pilotPersonalityArray.forEach((personality) => {
        const actualFields = Object.keys(personality);
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
      pilotPersonalityArray.forEach((personality) => {
        expect(personality.name).toBeDefined();
        expect(personality.name.Key).toBeDefined();
        expect(personality.name.TableNamespace).toBeDefined();
        expect(personality.name.en).toBeDefined();
        expect(typeof personality.name.Key).toBe('string');
        expect(typeof personality.name.TableNamespace).toBe('string');
        expect(typeof personality.name.en).toBe('string');
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotPersonalityArray.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotPersonalityArray.forEach((personality) => {
        expect(personality.id.length).toBeGreaterThan(0);
        expect(personality.icon_path.length).toBeGreaterThan(0);
        expect(personality.name.en.length).toBeGreaterThan(0);
      });
    });

    it('should have valid icon paths', () => {
      pilotPersonalityArray.forEach((personality) => {
        // Icon paths should start with a slash or be relative paths
        expect(personality.icon_path.length).toBeGreaterThan(0);
        // Typically these paths contain 'Textures' in them
        expect(personality.icon_path).toMatch(/Textures/);
      });
    });
  });
});
