import { describe, test, expect } from 'vitest';
import {
  MODULE_GROUPS,
  MODULE_TYPE_TO_GROUP,
} from '../src/utils/module_group_mapping';
import type { ModuleType } from '../src/types/module';
import { readFileSync } from 'fs';

// Load the module type data from the external data source
const moduleTypesData: Record<string, ModuleType> = JSON.parse(
  readFileSync('./WRFrontiersDB-Data/current/Objects/ModuleType.json', 'utf-8')
);

describe('Module Group Consistency', () => {
  test('module types within the same group should have consistent names and descriptions (except Supply Gear)', () => {
    // Group module types by their module group
    const typesByGroup: Record<string, string[]> = {};

    // Build the mapping from module group to module type IDs
    for (const [moduleTypeId, groupId] of Object.entries(
      MODULE_TYPE_TO_GROUP
    )) {
      if (!typesByGroup[groupId]) {
        typesByGroup[groupId] = [];
      }
      typesByGroup[groupId].push(moduleTypeId);
    }

    const inconsistencies: Array<{
      groupId: string;
      groupName: string;
      issue: 'name' | 'description';
      moduleTypes: string[];
      values: string[];
    }> = [];

    // Check each group for consistency
    for (const [groupId, moduleTypeIds] of Object.entries(typesByGroup)) {
      if (moduleTypeIds.length <= 1) {
        continue; // Skip groups with only one module type
      }

      const group = MODULE_GROUPS[groupId as keyof typeof MODULE_GROUPS];
      const groupName = group.name.en;

      // Check name consistency
      const namesByType: Record<string, string> = {};
      for (const typeId of moduleTypeIds) {
        const moduleType = moduleTypesData[typeId];
        if (moduleType && moduleType.name) {
          const nameObj = moduleType.name as { en?: string };
          namesByType[typeId] = nameObj.en || '';
        }
      }

      const uniqueNames = new Set(Object.values(namesByType));
      if (uniqueNames.size > 1) {
        inconsistencies.push({
          groupId,
          groupName,
          issue: 'name',
          moduleTypes: moduleTypeIds,
          values: Object.entries(namesByType).map(
            ([type, name]) => `${type}: "${name}"`
          ),
        });
      }

      // Check description consistency
      const descriptionsByType: Record<string, string> = {};
      for (const typeId of moduleTypeIds) {
        const moduleType = moduleTypesData[typeId];
        if (moduleType && moduleType.description) {
          const descObj = moduleType.description as { en?: string };
          descriptionsByType[typeId] = descObj.en || '';
        } else {
          descriptionsByType[typeId] = '[NO DESCRIPTION]';
        }
      }

      const uniqueDescriptions = new Set(Object.values(descriptionsByType));

      // Supply Gear is expected to have differing descriptions (Ability2 vs Ability3)
      if (groupId === 'supply-gear') {
        if (uniqueDescriptions.size <= 1) {
          inconsistencies.push({
            groupId,
            groupName,
            issue: 'description',
            moduleTypes: moduleTypeIds,
            values: [
              `Expected differing descriptions for Supply Gear, but found: ${Array.from(uniqueDescriptions).join(', ')}`,
            ],
          });
        }
      } else {
        // All other groups should have consistent descriptions
        if (uniqueDescriptions.size > 1) {
          inconsistencies.push({
            groupId,
            groupName,
            issue: 'description',
            moduleTypes: moduleTypeIds,
            values: Object.entries(descriptionsByType).map(
              ([type, desc]) => `${type}: "${desc}"`
            ),
          });
        }
      }
    }

    // Report inconsistencies
    if (inconsistencies.length > 0) {
      console.warn('\n=== Module Group Consistency Issues ===\n');

      for (const inconsistency of inconsistencies) {
        console.warn(
          `Group: ${inconsistency.groupName} (${inconsistency.groupId})`
        );
        console.warn(`Issue: ${inconsistency.issue} mismatch\n`);

        for (const value of inconsistency.values) {
          console.warn(`  ${value}`);
        }
        console.warn('');
      }

      console.warn(`Total inconsistencies found: ${inconsistencies.length}`);
    }

    // Fail if any inconsistencies occur other than the expected Supply Gear differences
    expect(inconsistencies.length).toBe(0);
  });

  test('all module types in mapping should exist in the data', () => {
    const missingTypes: string[] = [];

    for (const moduleTypeId of Object.keys(MODULE_TYPE_TO_GROUP)) {
      if (!moduleTypesData[moduleTypeId]) {
        missingTypes.push(moduleTypeId);
      }
    }

    if (missingTypes.length > 0) {
      console.warn('\n=== Missing Module Types ===\n');
      missingTypes.forEach((type) => console.warn(`Missing: ${type}`));
    }

    expect(missingTypes.length).toBe(0);
  });
});
