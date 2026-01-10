import { describe, it, expect } from 'vitest';
import { generateObjectStaticPaths } from '../../../src/utils/parse_object';
import {
  getParseObjects,
  getAllVersions,
} from '../../../src/utils/parse_object';

describe('generateObjectStaticPaths', () => {
  describe('basic functionality', () => {
    it('should return array of StaticPathsResult', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check structure of first result
      const first = result[0];
      expect(first).toHaveProperty('params');
      expect(first).toHaveProperty('props');
      expect(first.params).toHaveProperty('id');
      expect(first.params).toHaveProperty('version');
      expect(first.props).toHaveProperty('objectVersions');
    });

    it('should use default parseObjectPath for Module', async () => {
      const result = await generateObjectStaticPaths();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should generate paths for Module.json by default
      const first = result[0];
      expect(first.params.id).toBeDefined();
      expect(first.params.version).toBeDefined();
    });

    it('should generate paths for different object types', async () => {
      const pilotPaths = await generateObjectStaticPaths('Objects/Pilot.json');
      const modulePaths = await generateObjectStaticPaths(
        'Objects/Module.json'
      );

      expect(pilotPaths.length).toBeGreaterThan(0);
      expect(modulePaths.length).toBeGreaterThan(0);

      // Paths should have different IDs
      expect(pilotPaths[0].params.id).not.toBe(modulePaths[0].params.id);
    });

    it('should generate paths across multiple versions', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');
      const { versions } = getAllVersions();
      const versionCount = Object.keys(versions).length;

      // Should have paths for multiple versions
      const uniqueVersions = new Set(result.map((p) => p.params.version));
      expect(uniqueVersions.size).toBeGreaterThan(1);
      expect(uniqueVersions.size).toBeLessThanOrEqual(versionCount);
    });
  });

  describe('objectVersions tracking', () => {
    it('should populate objectVersions for each path', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      // Every path should have objectVersions array
      for (const path of result) {
        expect(Array.isArray(path.props.objectVersions)).toBe(true);
        expect(path.props.objectVersions.length).toBeGreaterThan(0);
      }
    });

    it('should have consistent objectVersions for same object ID', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      // Group paths by ID
      const pathsByObjectId = new Map<string, typeof result>();
      for (const path of result) {
        if (!pathsByObjectId.has(path.params.id)) {
          pathsByObjectId.set(path.params.id, []);
        }
        pathsByObjectId.get(path.params.id)!.push(path);
      }

      // For each object ID, all paths should have the same objectVersions list
      for (const [objectId, paths] of pathsByObjectId.entries()) {
        if (paths.length > 1) {
          const firstVersionsList = paths[0].props.objectVersions
            .sort()
            .join(',');
          for (const path of paths) {
            expect(path.props.objectVersions.sort().join(',')).toBe(
              firstVersionsList
            );
          }
        }
      }
    });

    it('should include current version in objectVersions', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      // Each path's version should be included in its objectVersions
      for (const path of result) {
        expect(path.props.objectVersions).toContain(path.params.version);
      }
    });

    it('should list all versions where object exists', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      // Pick an object that appears in multiple versions
      const objectId = result[0].params.id;
      const pathsForObject = result.filter((p) => p.params.id === objectId);
      const expectedVersions = pathsForObject
        .map((p) => p.params.version)
        .sort();
      const actualVersions = result
        .find((p) => p.params.id === objectId)!
        .props.objectVersions.sort();

      expect(actualVersions).toEqual(expectedVersions);
    });
  });

  describe('prodReadyOnly filtering', () => {
    it('should include all objects when prodReadyOnly is false', async () => {
      const allPaths = await generateObjectStaticPaths(
        'Objects/Module.json',
        false
      );

      expect(allPaths.length).toBeGreaterThan(0);
    });

    it('should filter non-Ready objects when prodReadyOnly is true', async () => {
      const allPaths = await generateObjectStaticPaths(
        'Objects/Module.json',
        false
      );
      const readyPaths = await generateObjectStaticPaths(
        'Objects/Module.json',
        true
      );

      // Ready paths should be equal or less than all paths
      expect(readyPaths.length).toBeLessThanOrEqual(allPaths.length);
    });

    it('should only include Ready objects when prodReadyOnly is true', async () => {
      const result = await generateObjectStaticPaths(
        'Objects/Module.json',
        true
      );

      // Check a few paths to verify they're Ready
      for (let i = 0; i < Math.min(5, result.length); i++) {
        const path = result[i];
        const modules = getParseObjects(
          'Objects/Module.json',
          path.params.version
        );
        const module = modules[path.params.id];

        // If production_status exists, it should be 'Ready'
        if (module.production_status) {
          expect(module.production_status).toBe('Ready');
        }
      }
    });

    it('should exclude objects without production_status when prodReadyOnly is true', async () => {
      const testVersion = '2025-12-09';
      const allModules = getParseObjects('Objects/Module.json', testVersion);

      // Find a module without production_status or with non-Ready status
      const nonReadyModule = Object.entries(allModules).find(
        ([_, mod]) =>
          !mod.production_status || mod.production_status !== 'Ready'
      );

      if (nonReadyModule) {
        const [nonReadyId] = nonReadyModule;
        const readyPaths = await generateObjectStaticPaths(
          'Objects/Module.json',
          true
        );

        // This ID should not appear in ready paths for this version
        const foundPath = readyPaths.find(
          (p) => p.params.id === nonReadyId && p.params.version === testVersion
        );
        expect(foundPath).toBeUndefined();
      }
    });
  });

  describe('params structure', () => {
    it('should have params with id and version', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      for (const path of result.slice(0, 5)) {
        expect(path.params.id).toBeDefined();
        expect(path.params.version).toBeDefined();
        expect(typeof path.params.id).toBe('string');
        expect(typeof path.params.version).toBe('string');
      }
    });

    it('should have version in YYYY-MM-DD format', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      for (const path of result.slice(0, 5)) {
        expect(path.params.version).toMatch(datePattern);
      }
    });

    it('should have valid object IDs', async () => {
      const result = await generateObjectStaticPaths('Objects/Module.json');

      for (const path of result.slice(0, 5)) {
        expect(path.params.id.length).toBeGreaterThan(0);
        expect(typeof path.params.id).toBe('string');
      }
    });
  });

  describe('edge cases', () => {
    it('should return empty array for non-existent file', async () => {
      const result = await generateObjectStaticPaths(
        'Objects/NonExistent.json'
      );

      expect(result).toEqual([]);
    });

    it('should handle object types with fewer instances', async () => {
      const result = await generateObjectStaticPaths(
        'Objects/PilotTalentType.json'
      );

      expect(Array.isArray(result)).toBe(true);
      // Should still have some paths even if fewer
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate unique paths', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      // Create set of unique path identifiers
      const pathIds = new Set(
        result.map((p) => `${p.params.id}::${p.params.version}`)
      );

      // Should have no duplicates
      expect(pathIds.size).toBe(result.length);
    });
  });

  describe('async behavior', () => {
    it('should return a Promise', () => {
      const result = generateObjectStaticPaths('Objects/PilotClass.json');

      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve to array', async () => {
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('version coverage', () => {
    it('should generate paths for most versions', async () => {
      const { versions } = getAllVersions();
      const versionKeys = Object.keys(versions);
      const result = await generateObjectStaticPaths('Objects/PilotClass.json');

      const uniqueVersions = new Set(result.map((p) => p.params.version));

      // Should cover a significant portion of versions
      // (Not all versions may have all object types)
      expect(uniqueVersions.size).toBeGreaterThan(versionKeys.length * 0.5);
    });

    it('should include latest version', async () => {
      const { latestVersion } = getAllVersions();
      const result = await generateObjectStaticPaths('Objects/Module.json');

      const hasLatest = result.some((p) => p.params.version === latestVersion);
      expect(hasLatest).toBe(true);
    });
  });
});
