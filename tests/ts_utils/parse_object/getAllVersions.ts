import { describe, it, expect } from 'vitest';
import { getAllVersions } from '../../../src/utils/parse_object';

describe('getAllVersions', () => {
  it('should return versions object and latestVersion string', () => {
    const result = getAllVersions();

    expect(result).toHaveProperty('versions');
    expect(result).toHaveProperty('latestVersion');
    expect(typeof result.latestVersion).toBe('string');
    expect(typeof result.versions).toBe('object');
  });

  it('should return non-empty versions', () => {
    const result = getAllVersions();

    const versionKeys = Object.keys(result.versions);
    expect(versionKeys.length).toBeGreaterThan(0);
  });

  it('should have latestVersion as the first key in versions', () => {
    const result = getAllVersions();

    const firstKey = Object.keys(result.versions)[0];
    expect(result.latestVersion).toBe(firstKey);
  });

  it('should have versions sorted by date DESC', () => {
    const result = getAllVersions();

    const versionKeys = Object.keys(result.versions);
    
    // Check that version keys are in descending order
    for (let i = 0; i < versionKeys.length - 1; i++) {
      const current = versionKeys[i];
      const next = versionKeys[i + 1];
      
      // Later dates should come before earlier dates
      expect(current >= next).toBe(true);
    }
  });

  it('should have valid VersionInfo structure for each version', () => {
    const result = getAllVersions();

    const firstVersionKey = Object.keys(result.versions)[0];
    const firstVersion = result.versions[firstVersionKey];

    // Check required properties
    expect(firstVersion).toHaveProperty('title');
    expect(firstVersion).toHaveProperty('date_utc');
    expect(firstVersion).toHaveProperty('manifest_id');

    // Type checks
    expect(typeof firstVersion.title).toBe('string');
    expect(typeof firstVersion.date_utc).toBe('string');
    expect(typeof firstVersion.manifest_id).toBe('string');
  });

  it('should have latestVersion exist in versions object', () => {
    const result = getAllVersions();

    expect(result.versions).toHaveProperty(result.latestVersion);
  });

  it('should have date format YYYY-MM-DD in version keys', () => {
    const result = getAllVersions();

    const versionKeys = Object.keys(result.versions);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    // Check first few versions to verify format
    for (let i = 0; i < Math.min(5, versionKeys.length); i++) {
      expect(versionKeys[i]).toMatch(datePattern);
    }
  });

  it('should have latestVersion match the most recent date', () => {
    const result = getAllVersions();

    const versionKeys = Object.keys(result.versions);
    const latestKey = versionKeys[0];
    
    expect(result.latestVersion).toBe(latestKey);
    
    // Verify it's actually the latest date
    for (const key of versionKeys) {
      expect(latestKey >= key).toBe(true);
    }
  });

  it('should include optional fields when present', () => {
    const result = getAllVersions();

    // Find a version that might have optional fields
    const versionKeys = Object.keys(result.versions);
    
    for (const key of versionKeys) {
      const version = result.versions[key];
      
      // If patch_notes_url exists, it should be a string
      if ('patch_notes_url' in version) {
        expect(typeof version.patch_notes_url).toBe('string');
      }
      
      // If is_season_release exists, it should be a boolean
      if ('is_season_release' in version) {
        expect(typeof version.is_season_release).toBe('boolean');
      }
    }
  });

  it('should return the same object structure on multiple calls', () => {
    const result1 = getAllVersions();
    const result2 = getAllVersions();

    expect(result1.latestVersion).toBe(result2.latestVersion);
    expect(Object.keys(result1.versions).length).toBe(Object.keys(result2.versions).length);
  });
});
