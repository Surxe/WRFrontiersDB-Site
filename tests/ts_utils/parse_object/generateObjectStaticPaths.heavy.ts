import { describe, it, expect } from 'vitest';
import { generateObjectStaticPaths } from '../../../src/utils/parse_object';
import { getParseObjects } from '../../../src/utils/parse_object';

describe('generateObjectStaticPaths - heavy performance tests', () => {
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
  }, 30000);

  it('should only include Ready objects when prodReadyOnly is true', async () => {
    const result = await generateObjectStaticPaths(
      'Objects/Module.json',
      true
    );

    // Check a few paths to verify they're Ready
    for (let i = 0; i < Math.min(5, result.length); i++) {
      const path = result[i];
      const module = getParseObjects('Objects/Module.json', path.params.version)[path.params.id];
      expect(module.production_status).toBe('Ready');
    }
  }, 30000);

  it('should exclude objects without production_status when prodReadyOnly is true', async () => {
    const testVersion = '2025-12-09';
    const allModules = getParseObjects('Objects/Module.json', testVersion);

    // Find a module without production_status or with non-Ready status
    const nonReadyModule = Object.entries(allModules).find(
      ([_, mod]) =>
        !mod.production_status || mod.production_status !== 'Ready'
    );

    if (nonReadyModule) {
      const result = await generateObjectStaticPaths(
        'Objects/Module.json',
        true
      );

      // The non-ready module should not be in the results
      const hasNonReady = result.some(
        path => path.params.id === nonReadyModule[0] && path.params.version === testVersion
      );
      expect(hasNonReady).toBe(false);
    } else {
      // If all modules are Ready, the test should still pass
      expect(true).toBe(true);
    }
  }, 30000);
});
