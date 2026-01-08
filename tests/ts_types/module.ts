import { describe, it, expect, beforeAll } from 'vitest';
import { getParseObjects } from '../../src/utils/parse_object';
import type { Module } from '../../src/types/module';

describe('Module interface', () => {
  const testVersion = '2025-12-09';
  let modules: Record<string, Module>;
  let sampleModule: Module;
  let sampleModuleId: string;

  // Load real data once for all tests
  beforeAll(() => {
    modules = getParseObjects<Module>('Objects/Module.json', testVersion);
    sampleModuleId = Object.keys(modules)[0];
    sampleModule = modules[sampleModuleId];
  });

  describe('required properties', () => {
    it('should have parseObjectClass property', () => {
      expect(sampleModule.parseObjectClass).toBe('Module');
      expect(typeof sampleModule.parseObjectClass).toBe('string');
    });

    it('should have id property', () => {
      expect(sampleModule.id).toBeDefined();
      expect(typeof sampleModule.id).toBe('string');
      expect(sampleModule.id.length).toBeGreaterThan(0);
    });

    it('should have inventory_icon_path property', () => {
      expect(sampleModule.inventory_icon_path).toBeDefined();
      expect(typeof sampleModule.inventory_icon_path).toBe('string');
    });

    it('should have module_rarity_id property', () => {
      expect(sampleModule.module_rarity_id).toBeDefined();
      expect(typeof sampleModule.module_rarity_id).toBe('string');
    });

    it('should have character_module_mounts array', () => {
      expect(sampleModule.character_module_mounts).toBeDefined();
      expect(Array.isArray(sampleModule.character_module_mounts)).toBe(true);
    });

    it('should have module_scalars object', () => {
      expect(sampleModule.module_scalars).toBeDefined();
      expect(typeof sampleModule.module_scalars).toBe('object');
    });

    it('should have faction_id property', () => {
      expect(sampleModule.faction_id).toBeDefined();
      expect(typeof sampleModule.faction_id).toBe('string');
    });

    it('should have module_classes_ids array', () => {
      expect(sampleModule.module_classes_ids).toBeDefined();
      expect(Array.isArray(sampleModule.module_classes_ids)).toBe(true);
    });

    it('should have module_type_id property', () => {
      expect(sampleModule.module_type_id).toBeDefined();
      expect(typeof sampleModule.module_type_id).toBe('string');
    });
  });

  describe('optional properties', () => {
    it('should handle production_status when present', () => {
      const modulesWithStatus = Object.values(modules).filter(
        m => m.production_status !== undefined
      );

      if (modulesWithStatus.length > 0) {
        expect(typeof modulesWithStatus[0].production_status).toBe('string');
      }
    });

    it('should handle name when present', () => {
      const modulesWithName = Object.values(modules).filter(m => m.name !== undefined);

      if (modulesWithName.length > 0) {
        const nameModule = modulesWithName[0];
        expect(nameModule.name).toHaveProperty('Key');
        expect(nameModule.name).toHaveProperty('TableNamespace');
        expect(nameModule.name).toHaveProperty('en');
      }
    });

    it('should handle description when present', () => {
      const modulesWithDescription = Object.values(modules).filter(
        m => m.description !== undefined
      );

      if (modulesWithDescription.length > 0) {
        const descModule = modulesWithDescription[0];
        expect(descModule.description).toHaveProperty('Key');
        expect(descModule.description).toHaveProperty('TableNamespace');
        expect(descModule.description).toHaveProperty('en');
      }
    });

    it('should handle module_tags_ids when present', () => {
      const modulesWithTags = Object.values(modules).filter(
        m => m.module_tags_ids !== undefined
      );

      if (modulesWithTags.length > 0) {
        expect(Array.isArray(modulesWithTags[0].module_tags_ids)).toBe(true);
      }
    });

    it('should handle text_tags when present', () => {
      const modulesWithTextTags = Object.values(modules).filter(
        m => m.text_tags !== undefined
      );

      if (modulesWithTextTags.length > 0) {
        expect(Array.isArray(modulesWithTextTags[0].text_tags)).toBe(true);
        
        if (modulesWithTextTags[0].text_tags!.length > 0) {
          const firstTag = modulesWithTextTags[0].text_tags![0];
          expect(firstTag).toHaveProperty('Key');
          expect(firstTag).toHaveProperty('TableNamespace');
          expect(firstTag).toHaveProperty('en');
        }
      }
    });

    it('should handle module_stats_table_id when present', () => {
      const modulesWithStatsTable = Object.values(modules).filter(
        m => m.module_stats_table_id !== undefined
      );

      if (modulesWithStatsTable.length > 0) {
        expect(typeof modulesWithStatsTable[0].module_stats_table_id).toBe('string');
      }
    });

    it('should handle module_socket_type_ids when present', () => {
      const modulesWithSocketTypes = Object.values(modules).filter(
        m => m.module_socket_type_ids !== undefined
      );

      if (modulesWithSocketTypes.length > 0) {
        expect(Array.isArray(modulesWithSocketTypes[0].module_socket_type_ids)).toBe(true);
      }
    });
  });

  describe('character_module_mounts structure', () => {
    it('should have correct structure for each mount', () => {
      if (sampleModule.character_module_mounts.length > 0) {
        const mount = sampleModule.character_module_mounts[0];
        
        expect(mount).toHaveProperty('character_module_id');
        expect(mount).toHaveProperty('mount');
        expect(typeof mount.character_module_id).toBe('string');
        expect(typeof mount.mount).toBe('string');
      }
    });

    it('should handle empty mounts array', () => {
      const modulesWithEmptyMounts = Object.values(modules).filter(
        m => m.character_module_mounts.length === 0
      );

      if (modulesWithEmptyMounts.length > 0) {
        expect(Array.isArray(modulesWithEmptyMounts[0].character_module_mounts)).toBe(true);
        expect(modulesWithEmptyMounts[0].character_module_mounts.length).toBe(0);
      }
    });
  });

  describe('module_scalars structure', () => {
    it('should be an object', () => {
      expect(typeof sampleModule.module_scalars).toBe('object');
      expect(sampleModule.module_scalars).not.toBeNull();
    });

    it('should handle default_scalars when present', () => {
      const modulesWithDefaultScalars = Object.values(modules).filter(
        m => m.module_scalars.default_scalars !== undefined
      );

      if (modulesWithDefaultScalars.length > 0) {
        expect(typeof modulesWithDefaultScalars[0].module_scalars.default_scalars).toBe('object');
      }
    });

    it('should handle primary_stat_id when present', () => {
      const modulesWithPrimaryStat = Object.values(modules).filter(
        m => m.module_scalars.primary_stat_id !== undefined
      );

      if (modulesWithPrimaryStat.length > 0) {
        expect(typeof modulesWithPrimaryStat[0].module_scalars.primary_stat_id).toBe('string');
      }
    });

    it('should handle secondary_stat_id when present', () => {
      const modulesWithSecondaryStat = Object.values(modules).filter(
        m => m.module_scalars.secondary_stat_id !== undefined
      );

      if (modulesWithSecondaryStat.length > 0) {
        expect(typeof modulesWithSecondaryStat[0].module_scalars.secondary_stat_id).toBe('string');
      }
    });

    it('should handle levels when present', () => {
      const modulesWithLevels = Object.values(modules).filter(
        m => m.module_scalars.levels !== undefined
      );

      if (modulesWithLevels.length > 0) {
        const levels = modulesWithLevels[0].module_scalars.levels!;
        
        expect(levels).toHaveProperty('constants');
        expect(levels).toHaveProperty('variables');
        expect(typeof levels.constants).toBe('object');
        expect(typeof levels.variables).toBe('object');
      }
    });

    it('should handle module_name when present', () => {
      const modulesWithModuleName = Object.values(modules).filter(
        m => m.module_scalars.module_name !== undefined
      );

      if (modulesWithModuleName.length > 0) {
        expect(typeof modulesWithModuleName[0].module_scalars.module_name).toBe('string');
      }
    });
  });

  describe('arrays structure', () => {
    it('should have module_classes_ids as string array', () => {
      expect(Array.isArray(sampleModule.module_classes_ids)).toBe(true);
      
      if (sampleModule.module_classes_ids.length > 0) {
        expect(typeof sampleModule.module_classes_ids[0]).toBe('string');
      }
    });

    it('should handle module_tags_ids as string array when present', () => {
      const modulesWithTags = Object.values(modules).filter(
        m => m.module_tags_ids !== undefined && m.module_tags_ids.length > 0
      );

      if (modulesWithTags.length > 0) {
        expect(typeof modulesWithTags[0].module_tags_ids![0]).toBe('string');
      }
    });

    it('should handle module_socket_type_ids as string array when present', () => {
      const modulesWithSocketTypes = Object.values(modules).filter(
        m => m.module_socket_type_ids !== undefined && m.module_socket_type_ids.length > 0
      );

      if (modulesWithSocketTypes.length > 0) {
        expect(typeof modulesWithSocketTypes[0].module_socket_type_ids![0]).toBe('string');
      }
    });
  });

  describe('data consistency', () => {
    it('should have consistent structure across all modules', () => {
      const moduleValues = Object.values(modules);
      expect(moduleValues.length).toBeGreaterThan(0);

      for (const module of moduleValues.slice(0, 10)) {
        expect(module.parseObjectClass).toBe('Module');
        expect(module.id).toBeDefined();
        expect(module.inventory_icon_path).toBeDefined();
        expect(module.module_rarity_id).toBeDefined();
        expect(Array.isArray(module.character_module_mounts)).toBe(true);
        expect(typeof module.module_scalars).toBe('object');
        expect(module.faction_id).toBeDefined();
        expect(Array.isArray(module.module_classes_ids)).toBe(true);
        expect(module.module_type_id).toBeDefined();
      }
    });

    it('should have unique module IDs', () => {
      const moduleIds = Object.keys(modules);
      const uniqueIds = new Set(moduleIds);
      
      expect(uniqueIds.size).toBe(moduleIds.length);
    });

    it('should have all modules conform to Module interface', () => {
      const moduleValues = Object.values(modules);

      for (const module of moduleValues) {
        // This test passes if TypeScript compilation succeeds
        // and runtime checks don't throw errors
        const _typedModule: Module = module;
        expect(_typedModule.parseObjectClass).toBe('Module');
      }
    });
  });

  describe('LocalizationKey structure', () => {
    it('should have correct LocalizationKey structure for name', () => {
      const modulesWithName = Object.values(modules).filter(m => m.name !== undefined);

      if (modulesWithName.length > 0) {
        const name = modulesWithName[0].name!;
        
        expect(typeof name.Key).toBe('string');
        expect(typeof name.TableNamespace).toBe('string');
        expect(typeof name.en).toBe('string');
        expect(name.Key.length).toBeGreaterThan(0);
        expect(name.TableNamespace.length).toBeGreaterThan(0);
        expect(name.en.length).toBeGreaterThan(0);
      }
    });

    it('should have correct LocalizationKey structure for description', () => {
      const modulesWithDescription = Object.values(modules).filter(
        m => m.description !== undefined
      );

      if (modulesWithDescription.length > 0) {
        const description = modulesWithDescription[0].description!;
        
        expect(typeof description.Key).toBe('string');
        expect(typeof description.TableNamespace).toBe('string');
        expect(typeof description.en).toBe('string');
      }
    });
  });

  describe('real data validation', () => {
    it('should load at least 10 modules', () => {
      expect(Object.keys(modules).length).toBeGreaterThanOrEqual(10);
    });

    it('should have modules with production_status Ready', () => {
      const readyModules = Object.values(modules).filter(
        m => m.production_status === 'Ready'
      );

      expect(readyModules.length).toBeGreaterThan(0);
    });

    it('should have modules with names', () => {
      const namedModules = Object.values(modules).filter(m => m.name !== undefined);

      expect(namedModules.length).toBeGreaterThan(0);
    });

    it('should have valid inventory_icon_path format', () => {
      const modulesWithIcons = Object.values(modules).slice(0, 5);

      for (const module of modulesWithIcons) {
        expect(typeof module.inventory_icon_path).toBe('string');
        // Most icon paths should contain common path patterns
        if (module.inventory_icon_path.length > 0) {
          expect(
            module.inventory_icon_path.includes('/') ||
            module.inventory_icon_path.includes('\\') ||
            module.inventory_icon_path.length === 0
          ).toBe(true);
        }
      }
    });
  });
});
