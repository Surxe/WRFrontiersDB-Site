import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Module interface', () => {
  let modules: Record<string, unknown>;
  let moduleArray: unknown[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const modulePath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'Module.json'
  );

  modules = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));
  moduleArray = Object.values(modules);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('id');
        expect(typeof module.id).toBe('string');
      });
    });

    it('should have "inventory_icon_path" field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('inventory_icon_path');
        expect(typeof module.inventory_icon_path).toBe('string');
      });
    });

    it('should have "module_rarity_id" field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('module_rarity_id');
        expect(typeof module.module_rarity_id).toBe('string');
      });
    });

    it('should have "character_module_mounts" array field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('character_module_mounts');
        expect(Array.isArray(module.character_module_mounts)).toBe(true);
      });
    });

    it('should have "module_scalars" object field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('module_scalars');
        expect(typeof module.module_scalars).toBe('object');
      });
    });

    it('should have "faction_id" field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('faction_id');
        expect(typeof module.faction_id).toBe('string');
      });
    });

    it('should have "module_classes_ids" array field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('module_classes_ids');
        expect(Array.isArray(module.module_classes_ids)).toBe(true);
      });
    });

    it('should have "module_type_id" field in every object', () => {
      moduleArray.forEach((module) => {
        expect(module).toHaveProperty('module_type_id');
        expect(typeof module.module_type_id).toBe('string');
      });
    });
  });

  describe('Optional fields', () => {
    it('should have at least one object with "production_status" field', () => {
      const withProductionStatus = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'production_status')
      );
      expect(withProductionStatus.length).toBeGreaterThan(0);
      withProductionStatus.forEach((module) => {
        expect(typeof module.production_status).toBe('string');
      });
    });

    it('should have at least one object with "module_tags_ids" field', () => {
      const withModuleTags = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'module_tags_ids')
      );
      expect(withModuleTags.length).toBeGreaterThan(0);
      withModuleTags.forEach((module) => {
        expect(Array.isArray(module.module_tags_ids)).toBe(true);
      });
    });

    it('should have at least one object with "name" field', () => {
      const withName = moduleArray.filter((m) => Object.prototype.hasOwnProperty.call(m, 'name'));
      expect(withName.length).toBeGreaterThan(0);
      withName.forEach((module) => {
        const name = (module as Record<string, unknown>).name as Record<string, unknown>;
        // name can be either LocalizationKey or { InvariantString: string }
        const isLocalizationKey =
          Object.prototype.hasOwnProperty.call(name, 'Key') &&
          Object.prototype.hasOwnProperty.call(name, 'TableNamespace') &&
          Object.prototype.hasOwnProperty.call(name, 'en');
        const isInvariantString =
          Object.prototype.hasOwnProperty.call(name, 'InvariantString') &&
          typeof name.InvariantString === 'string';

        expect(isLocalizationKey || isInvariantString).toBe(true);
      });
    });

    it('should have at least one object with "description" field', () => {
      const withDescription = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'description')
      );
      expect(withDescription.length).toBeGreaterThan(0);
      withDescription.forEach((module) => {
        expect(module.description).toHaveProperty('Key');
        expect(module.description).toHaveProperty('TableNamespace');
        expect(module.description).toHaveProperty('en');
      });
    });

    it('should have at least one object with "text_tags" field', () => {
      const withTextTags = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'text_tags')
      );
      expect(withTextTags.length).toBeGreaterThan(0);
      withTextTags.forEach((module) => {
        expect(Array.isArray(module.text_tags)).toBe(true);
      });
    });

    it('should have at least one object with "module_stats_table_id" field', () => {
      const withModuleStatsTable = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'module_stats_table_id')
      );
      expect(withModuleStatsTable.length).toBeGreaterThan(0);
      withModuleStatsTable.forEach((module) => {
        expect(typeof module.module_stats_table_id).toBe('string');
      });
    });

    it('should have at least one object with "module_socket_type_ids" field', () => {
      const withSocketTypes = moduleArray.filter((m) =>
        Object.prototype.hasOwnProperty.call(m, 'module_socket_type_ids')
      );
      expect(withSocketTypes.length).toBeGreaterThan(0);
      withSocketTypes.forEach((module) => {
        expect(Array.isArray(module.module_socket_type_ids)).toBe(true);
      });
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'production_status',
        'inventory_icon_path',
        'module_rarity_id',
        'character_module_mounts',
        'module_tags_ids',
        'name',
        'description',
        'text_tags',
        'module_scalars',
        'abilities_scalars',
        'faction_id',
        'module_classes_ids',
        'module_stats_table_id',
        'module_type_id',
        'module_socket_type_ids',
        // parseObjectClass is added at build time, not in raw data
      ]);

      moduleArray.forEach((module) => {
        const actualFields = Object.keys(module);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(
            true
          );
        });
      });
    });
  });

  describe('Nested structures - character_module_mounts', () => {
    it('should have valid character_module_mounts array structure', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        expect(Array.isArray(mod.character_module_mounts)).toBe(true);
        (mod.character_module_mounts as Record<string, unknown>[]).forEach((mount) => {
          expect(mount).toHaveProperty('character_module_id');
          expect(mount).toHaveProperty('mount');
          expect(typeof mount.character_module_id).toBe('string');
          expect(typeof mount.mount).toBe('string');
        });
      });
    });

    it('should not have extra fields in character_module_mounts objects', () => {
      const allowedMountFields = new Set(['character_module_id', 'mount']);

      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        (mod.character_module_mounts as Record<string, unknown>[]).forEach((mount) => {
          const actualFields = Object.keys(mount);
          actualFields.forEach((field) => {
            expect(
              allowedMountFields.has(field),
              `Unexpected mount field: ${field}`
            ).toBe(true);
          });
        });
      });
    });
  });

  describe('Nested structures - module_scalars', () => {
    it('should have valid module_scalars object', () => {
      moduleArray.forEach((module) => {
        expect(module.module_scalars).toBeDefined();
        expect(typeof module.module_scalars).toBe('object');
      });
    });

    it('should have valid default_scalars when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        const scalars = mod.module_scalars as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(scalars, 'default_scalars')) {
          expect(typeof scalars.default_scalars).toBe('object');
        }
      });
    });

    it('should have valid primary_stat_id when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        const scalars = mod.module_scalars as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(scalars, 'primary_stat_id')) {
          expect(typeof scalars.primary_stat_id).toBe('string');
        }
      });
    });

    it('should have valid secondary_stat_id when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        const scalars = mod.module_scalars as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(scalars, 'secondary_stat_id')) {
          expect(typeof scalars.secondary_stat_id).toBe('string');
        }
      });
    });

    it('should have valid levels structure when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        const scalars = mod.module_scalars as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(scalars, 'levels')) {
          const levels = scalars.levels as Record<string, unknown>;
          expect(levels).toHaveProperty('constants');
          expect(typeof levels.constants).toBe('object');
          // variables is optional, but when present, it should be an array
          if (Object.prototype.hasOwnProperty.call(levels, 'variables')) {
            expect(Array.isArray(levels.variables)).toBe(
              true
            );
          }
        }
      });
    });

    it('should have valid module_name when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        const scalars = mod.module_scalars as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(scalars, 'module_name')) {
          expect(typeof scalars.module_name).toBe('string');
        }
      });
    });
  });

  describe('Nested structures - LocalizationKeys', () => {
    it('should have valid LocalizationKey structure for description when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(mod, 'description')) {
          const desc = mod.description as Record<string, unknown>;
          expect(desc).toBeDefined();
          expect(desc.Key).toBeDefined();
          expect(desc.TableNamespace).toBeDefined();
          expect(desc.en).toBeDefined();
          expect(typeof desc.Key).toBe('string');
          expect(typeof desc.TableNamespace).toBe('string');
          expect(typeof desc.en).toBe('string');
        }
      });
    });

    it('should have valid LocalizationKey array for text_tags when present', () => {
      moduleArray.forEach((module) => {
        const mod = module as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(mod, 'text_tags')) {
          expect(Array.isArray(mod.text_tags)).toBe(true);
          (mod.text_tags as Record<string, unknown>[]).forEach((tag) => {
            expect(tag).toHaveProperty('Key');
            expect(tag).toHaveProperty('TableNamespace');
            expect(tag).toHaveProperty('en');
            expect(typeof tag.Key).toBe('string');
            expect(typeof tag.TableNamespace).toBe('string');
            expect(typeof tag.en).toBe('string');
          });
        }
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = moduleArray.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      moduleArray.forEach((module) => {
        expect(module.id.length).toBeGreaterThan(0);
        expect(module.inventory_icon_path.length).toBeGreaterThan(0);
        expect(module.module_rarity_id.length).toBeGreaterThan(0);
        expect(module.faction_id.length).toBeGreaterThan(0);
        expect(module.module_type_id.length).toBeGreaterThan(0);
      });
    });

    it('should have valid inventory icon paths', () => {
      moduleArray.forEach((module) => {
        expect(module.inventory_icon_path.length).toBeGreaterThan(0);
        // Typically these paths contain 'Textures' or similar
        expect(module.inventory_icon_path).toMatch(/Textures|UI/);
      });
    });

    it('should have non-empty character_module_mounts array', () => {
      moduleArray.forEach((module) => {
        expect(module.character_module_mounts.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty module_classes_ids array', () => {
      moduleArray.forEach((module) => {
        expect(module.module_classes_ids.length).toBeGreaterThan(0);
      });
    });

    it('should have production_status "Ready" for most modules', () => {
      const readyModules = moduleArray.filter(
        (m) => m.production_status === 'Ready'
      );
      // Most modules should be Ready
      expect(readyModules.length).toBeGreaterThan(moduleArray.length * 0.5);
    });
  });
});
