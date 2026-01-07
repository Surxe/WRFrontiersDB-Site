import { describe, it, expect } from 'vitest';
import { getVersionsData } from '../../../src/utils/parse_object';

describe('getVersionsData', () => {
  const testVersion = '2025-12-09';
  const olderVersion = '2025-11-25';

  describe('valid version', () => {
    it('should return versions and versionInfo for valid version', () => {
      const result = getVersionsData(testVersion);

      expect(result).toHaveProperty('versions');
      expect(result).toHaveProperty('versionInfo');
      expect(typeof result.versions).toBe('object');
      expect(typeof result.versionInfo).toBe('object');
    });

    it('should have versionInfo match the requested version', () => {
      const result = getVersionsData(testVersion);

      expect(result.versionInfo).toBeDefined();
      expect(result.versionInfo.date_utc).toBe(testVersion);
    });

    it('should return all versions in versions object', () => {
      const result = getVersionsData(testVersion);

      const versionKeys = Object.keys(result.versions);
      expect(versionKeys.length).toBeGreaterThan(1);
      expect(versionKeys).toContain(testVersion);
    });

    it('should have versionInfo with required properties', () => {
      const result = getVersionsData(testVersion);

      expect(result.versionInfo).toHaveProperty('title');
      expect(result.versionInfo).toHaveProperty('date_utc');
      expect(result.versionInfo).toHaveProperty('manifest_id');

      expect(typeof result.versionInfo.title).toBe('string');
      expect(typeof result.versionInfo.date_utc).toBe('string');
      expect(typeof result.versionInfo.manifest_id).toBe('string');
    });

    it('should work for different versions', () => {
      const result1 = getVersionsData(testVersion);
      const result2 = getVersionsData(olderVersion);

      expect(result1.versionInfo.date_utc).toBe(testVersion);
      expect(result2.versionInfo.date_utc).toBe(olderVersion);
      expect(result1.versionInfo.title).not.toBe(result2.versionInfo.title);
    });
  });

  describe('versions object', () => {
    it('should return same versions object regardless of requested version', () => {
      const result1 = getVersionsData(testVersion);
      const result2 = getVersionsData(olderVersion);

      const keys1 = Object.keys(result1.versions);
      const keys2 = Object.keys(result2.versions);

      expect(keys1.length).toBe(keys2.length);
      expect(keys1).toEqual(keys2);
    });

    it('should have versions object containing requested version', () => {
      const result = getVersionsData(testVersion);

      expect(result.versions).toHaveProperty(testVersion);
      expect(result.versions[testVersion]).toBeDefined();
    });

    it('should have all versions with valid VersionInfo structure', () => {
      const result = getVersionsData(testVersion);

      const versionKeys = Object.keys(result.versions);
      
      // Check a few versions
      for (let i = 0; i < Math.min(3, versionKeys.length); i++) {
        const key = versionKeys[i];
        const versionInfo = result.versions[key];

        expect(versionInfo).toHaveProperty('title');
        expect(versionInfo).toHaveProperty('date_utc');
        expect(versionInfo).toHaveProperty('manifest_id');
      }
    });
  });

  describe('versionInfo details', () => {
    it('should have versionInfo match entry in versions object', () => {
      const result = getVersionsData(testVersion);

      const versionFromObject = result.versions[testVersion];
      
      expect(result.versionInfo.title).toBe(versionFromObject.title);
      expect(result.versionInfo.date_utc).toBe(versionFromObject.date_utc);
      expect(result.versionInfo.manifest_id).toBe(versionFromObject.manifest_id);
    });

    it('should include optional properties when present', () => {
      const result = getVersionsData(testVersion);

      // If patch_notes_url exists, it should be a string
      if ('patch_notes_url' in result.versionInfo) {
        expect(typeof result.versionInfo.patch_notes_url).toBe('string');
      }

      // If is_season_release exists, it should be a boolean
      if ('is_season_release' in result.versionInfo) {
        expect(typeof result.versionInfo.is_season_release).toBe('boolean');
      }
    });
  });

  describe('invalid version', () => {
    it('should return undefined versionInfo for non-existent version', () => {
      const result = getVersionsData('2000-01-01');

      expect(result.versionInfo).toBeUndefined();
      expect(result.versions).toBeDefined();
      expect(Object.keys(result.versions).length).toBeGreaterThan(0);
    });

    it('should still return complete versions object for invalid version', () => {
      const validResult = getVersionsData(testVersion);
      const invalidResult = getVersionsData('1999-12-31');

      expect(Object.keys(invalidResult.versions).length).toBe(
        Object.keys(validResult.versions).length
      );
    });
  });

  describe('return type structure', () => {
    it('should match VersionsData interface', () => {
      const result = getVersionsData(testVersion);

      // Has both required properties
      expect('versions' in result).toBe(true);
      expect('versionInfo' in result).toBe(true);

      // versions is a Record<string, VersionInfo>
      expect(typeof result.versions).toBe('object');
      expect(Array.isArray(result.versions)).toBe(false);

      // versionInfo is VersionInfo
      expect(typeof result.versionInfo).toBe('object');
    });

    it('should be usable for version navigation', () => {
      const result = getVersionsData(testVersion);

      // Common use case: listing all available versions
      const allVersionKeys = Object.keys(result.versions);
      expect(allVersionKeys.length).toBeGreaterThan(0);

      // Common use case: getting current version details
      expect(result.versionInfo.date_utc).toBe(testVersion);
      expect(result.versionInfo.title).toBeDefined();
    });
  });
});
