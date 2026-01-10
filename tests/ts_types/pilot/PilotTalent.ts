import { describe, it, expect } from 'vitest';
import type { PilotTalent } from '../../../src/types/pilot';
import fs from 'fs';
import path from 'path';

describe('PilotTalent interface', () => {
  let pilotTalents: Record<string, any>;
  let pilotTalentArray: any[];

  // Load real data from the latest version
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const pilotTalentPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'PilotTalent.json'
  );

  pilotTalents = JSON.parse(fs.readFileSync(pilotTalentPath, 'utf-8'));
  pilotTalentArray = Object.values(pilotTalents);

  describe('Required fields', () => {
    it('should have "id" field in every object', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent).toHaveProperty('id');
        expect(typeof talent.id).toBe('string');
      });
    });

    it('should have "name" field in every object', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent).toHaveProperty('name');
        expect(talent.name).toHaveProperty('Key');
        expect(talent.name).toHaveProperty('TableNamespace');
        expect(talent.name).toHaveProperty('en');
        expect(typeof talent.name.Key).toBe('string');
        expect(typeof talent.name.TableNamespace).toBe('string');
        expect(typeof talent.name.en).toBe('string');
      });
    });

    it('should have "description" field in every object', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent).toHaveProperty('description');
        expect(talent.description).toHaveProperty('Key');
        expect(talent.description).toHaveProperty('TableNamespace');
        expect(talent.description).toHaveProperty('en');
        expect(typeof talent.description.Key).toBe('string');
        expect(typeof talent.description.TableNamespace).toBe('string');
        expect(typeof talent.description.en).toBe('string');
      });
    });

    it('should have "image_path" field in every object', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent).toHaveProperty('image_path');
        expect(typeof talent.image_path).toBe('string');
      });
    });

    it('should have "stats" array field in every object', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent).toHaveProperty('stats');
        expect(Array.isArray(talent.stats)).toBe(true);
      });
    });
  });

  describe('Optional fields', () => {
    it('should have at least one object with "ui_description" field', () => {
      const withUIDescription = pilotTalentArray.filter((t) =>
        t.hasOwnProperty('ui_description')
      );
      expect(withUIDescription.length).toBeGreaterThan(0);
      withUIDescription.forEach((talent) => {
        expect(talent.ui_description).toHaveProperty('Key');
        expect(talent.ui_description).toHaveProperty('TableNamespace');
        expect(talent.ui_description).toHaveProperty('en');
        expect(typeof talent.ui_description.Key).toBe('string');
        expect(typeof talent.ui_description.TableNamespace).toBe('string');
        expect(typeof talent.ui_description.en).toBe('string');
      });
    });

    it('should have at least one object with "short_ui_description" field', () => {
      const withShortUIDescription = pilotTalentArray.filter((t) =>
        t.hasOwnProperty('short_ui_description')
      );
      expect(withShortUIDescription.length).toBeGreaterThan(0);
      withShortUIDescription.forEach((talent) => {
        expect(talent.short_ui_description).toHaveProperty('Key');
        expect(talent.short_ui_description).toHaveProperty('TableNamespace');
        expect(talent.short_ui_description).toHaveProperty('en');
        expect(typeof talent.short_ui_description.Key).toBe('string');
        expect(typeof talent.short_ui_description.TableNamespace).toBe(
          'string'
        );
        expect(typeof talent.short_ui_description.en).toBe('string');
      });
    });

    it('should have at least one object with "buffs" field', () => {
      const withBuffs = pilotTalentArray.filter((t) =>
        t.hasOwnProperty('buffs')
      );
      expect(withBuffs.length).toBeGreaterThan(0);
      withBuffs.forEach((talent) => {
        expect(Array.isArray(talent.buffs)).toBe(true);
      });
    });

    it('should have at least one object with "target_buffs" field', () => {
      const withTargetBuffs = pilotTalentArray.filter((t) =>
        t.hasOwnProperty('target_buffs')
      );
      expect(withTargetBuffs.length).toBeGreaterThan(0);
      withTargetBuffs.forEach((talent) => {
        expect(Array.isArray(talent.target_buffs)).toBe(true);
      });
    });

    it('should have at least one object with "default_properties" field', () => {
      const withDefaultProperties = pilotTalentArray.filter((t) =>
        t.hasOwnProperty('default_properties')
      );
      expect(withDefaultProperties.length).toBeGreaterThan(0);
      withDefaultProperties.forEach((talent) => {
        expect(typeof talent.default_properties).toBe('object');
      });
    });

    it('should note that talent_type_id and level are enriched at build time', () => {
      // These fields are added during build time, not in raw data
      // This test documents that they won't be in the source data
      expect(true).toBe(true);
    });
  });

  describe('No extra fields', () => {
    it('should only have fields defined in the interface', () => {
      const allowedFields = new Set([
        'id',
        'name',
        'description',
        'ui_description',
        'short_ui_description',
        'image_path',
        'stats',
        'buffs',
        'target_buffs',
        'cooldown',
        'reactivation_policy',
        'buff_class',
        'default_properties',
        // talent_type_id and level are enriched at build time, not in raw data
        // parseObjectClass is added at build time, not in raw data
      ]);

      pilotTalentArray.forEach((talent) => {
        const actualFields = Object.keys(talent);
        actualFields.forEach((field) => {
          expect(allowedFields.has(field), `Unexpected field: ${field}`).toBe(
            true
          );
        });
      });
    });
  });

  describe('Nested structures - LocalizationKeys', () => {
    it('should have valid LocalizationKey structure for name', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent.name).toBeDefined();
        expect(talent.name.Key).toBeDefined();
        expect(talent.name.TableNamespace).toBeDefined();
        expect(talent.name.en).toBeDefined();
        expect(typeof talent.name.Key).toBe('string');
        expect(typeof talent.name.TableNamespace).toBe('string');
        expect(typeof talent.name.en).toBe('string');
      });
    });

    it('should have valid LocalizationKey structure for description', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent.description).toBeDefined();
        expect(talent.description.Key).toBeDefined();
        expect(talent.description.TableNamespace).toBeDefined();
        expect(talent.description.en).toBeDefined();
        expect(typeof talent.description.Key).toBe('string');
        expect(typeof talent.description.TableNamespace).toBe('string');
        expect(typeof talent.description.en).toBe('string');
      });
    });

    it('should have valid LocalizationKey structure for ui_description when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('ui_description')) {
          expect(talent.ui_description).toBeDefined();
          expect(talent.ui_description.Key).toBeDefined();
          expect(talent.ui_description.TableNamespace).toBeDefined();
          expect(talent.ui_description.en).toBeDefined();
          expect(typeof talent.ui_description.Key).toBe('string');
          expect(typeof talent.ui_description.TableNamespace).toBe('string');
          expect(typeof talent.ui_description.en).toBe('string');
        }
      });
    });

    it('should have valid LocalizationKey structure for short_ui_description when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('short_ui_description')) {
          expect(talent.short_ui_description).toBeDefined();
          expect(talent.short_ui_description.Key).toBeDefined();
          expect(talent.short_ui_description.TableNamespace).toBeDefined();
          expect(talent.short_ui_description.en).toBeDefined();
          expect(typeof talent.short_ui_description.Key).toBe('string');
          expect(typeof talent.short_ui_description.TableNamespace).toBe(
            'string'
          );
          expect(typeof talent.short_ui_description.en).toBe('string');
        }
      });
    });
  });

  describe('Nested structures - stats array', () => {
    it('should have valid stats array structure', () => {
      pilotTalentArray.forEach((talent) => {
        expect(Array.isArray(talent.stats)).toBe(true);
        talent.stats.forEach((stat: any) => {
          expect(stat).toHaveProperty('stat_id');
          expect(stat).toHaveProperty('value');
          expect(typeof stat.stat_id).toBe('string');
          expect(typeof stat.value).toBe('number');
        });
      });
    });

    it('should not have extra fields in stats objects', () => {
      const allowedStatFields = new Set(['stat_id', 'value']);

      pilotTalentArray.forEach((talent) => {
        talent.stats.forEach((stat: any) => {
          const actualFields = Object.keys(stat);
          actualFields.forEach((field) => {
            expect(
              allowedStatFields.has(field),
              `Unexpected stat field: ${field}`
            ).toBe(true);
          });
        });
      });
    });
  });

  describe('Nested structures - buffs array', () => {
    it('should have valid buffs array structure when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('buffs')) {
          expect(Array.isArray(talent.buffs)).toBe(true);
          talent.buffs.forEach((buff: any) => {
            expect(typeof buff).toBe('object');
          });
        }
      });
    });

    it('should have valid Modifier field when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('buffs')) {
          talent.buffs.forEach((buff: any) => {
            if (buff.hasOwnProperty('Modifier')) {
              expect(typeof buff.Modifier).toBe('number');
            }
          });
        }
      });
    });

    it('should have valid Modifiers array when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('buffs')) {
          talent.buffs.forEach((buff: any) => {
            if (buff.hasOwnProperty('Modifiers')) {
              expect(Array.isArray(buff.Modifiers)).toBe(true);
              buff.Modifiers.forEach((modifier: any) => {
                expect(modifier).toHaveProperty('what');
                expect(modifier).toHaveProperty('operator');
                expect(modifier).toHaveProperty('value');
                expect(typeof modifier.what).toBe('string');
                expect(typeof modifier.operator).toBe('string');
                expect(['Grow', 'Multiply'].includes(modifier.operator)).toBe(
                  true
                );
                expect(typeof modifier.value).toBe('number');
              });
            }
          });
        }
      });
    });

    it('should have valid AbilitySelectors array when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('buffs')) {
          talent.buffs.forEach((buff: any) => {
            if (buff.hasOwnProperty('AbilitySelectors')) {
              expect(Array.isArray(buff.AbilitySelectors)).toBe(true);
              buff.AbilitySelectors.forEach((selector: any) => {
                expect(selector).toHaveProperty('allowed_placement_types');
                expect(Array.isArray(selector.allowed_placement_types)).toBe(
                  true
                );

                if (selector.hasOwnProperty('module_tags')) {
                  expect(Array.isArray(selector.module_tags)).toBe(true);
                  selector.module_tags.forEach((tag: any) => {
                    expect(tag).toHaveProperty('module_tag_id');
                    expect(typeof tag.module_tag_id).toBe('string');
                  });
                }
              });
            }
          });
        }
      });
    });

    it('should have valid module_tag_selector when present', () => {
      pilotTalentArray.forEach((talent) => {
        if (talent.hasOwnProperty('buffs')) {
          talent.buffs.forEach((buff: any) => {
            if (buff.hasOwnProperty('module_tag_selector')) {
              expect(buff.module_tag_selector).toHaveProperty('list_operator');
              expect(buff.module_tag_selector).toHaveProperty('module_tags');
              expect(typeof buff.module_tag_selector.list_operator).toBe(
                'string'
              );
              expect(Array.isArray(buff.module_tag_selector.module_tags)).toBe(
                true
              );

              buff.module_tag_selector.module_tags.forEach((tag: any) => {
                expect(tag).toHaveProperty('module_tag_id');
                expect(typeof tag.module_tag_id).toBe('string');
              });
            }
          });
        }
      });
    });
  });

  describe('Data integrity', () => {
    it('should have unique IDs', () => {
      const ids = pilotTalentArray.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have non-empty required string fields', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent.id.length).toBeGreaterThan(0);
        expect(talent.name.en.length).toBeGreaterThan(0);
        expect(talent.image_path.length).toBeGreaterThan(0);
      });
    });

    it('should have valid image paths', () => {
      pilotTalentArray.forEach((talent) => {
        expect(talent.image_path.length).toBeGreaterThan(0);
        // Typically these paths contain 'Textures' in them
        expect(talent.image_path).toMatch(/Textures/);
      });
    });

    it('should have non-empty stats array in most objects', () => {
      const withStats = pilotTalentArray.filter((t) => t.stats.length > 0);
      // Most talents should have stats
      expect(withStats.length).toBeGreaterThan(pilotTalentArray.length * 0.8);
    });

    it('should have buffs or target_buffs in most objects', () => {
      const withBuffsOrTargetBuffs = pilotTalentArray.filter(
        (t) =>
          (t.hasOwnProperty('buffs') && t.buffs.length > 0) ||
          (t.hasOwnProperty('target_buffs') && t.target_buffs.length > 0)
      );
      // Most talents should have buffs or target_buffs
      expect(withBuffsOrTargetBuffs.length).toBeGreaterThan(
        pilotTalentArray.length * 0.5
      );
    });
  });
});
