import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Module } from '../../../src/types/module';
import type { ParseObject } from '../../../src/types/parse_object';

describe('Module interface vs data structure', () => {
  const dataPath = join(process.cwd(), 'WRFrontiersDB-Data', 'archive', '2025-12-09', 'Objects', 'Module.json');
  const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const realObjects = Object.values(rawData) as Record<string, unknown>[];

  // Dynamically determine inherited fields from ParseObject interface
  const parseObjectPath = join(process.cwd(), 'src', 'types', 'parse_object.ts');
  const parseObjectSource = readFileSync(parseObjectPath, 'utf-8');
  
  // Extract fields from ParseObject interface (excluding 'id' since it's required in child types)
  const parseObjectMatch = parseObjectSource.match(/export interface ParseObject \{([^}]+)\}/);
  const inheritedFields: string[] = [];
  
  if (parseObjectMatch) {
    const interfaceBody = parseObjectMatch[1];
    // Match field names (excluding indexer signature and 'id')
    const fieldMatches = interfaceBody.matchAll(/(\w+)(\?)?:/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];
      if (fieldName !== 'id') {
        inheritedFields.push(fieldName);
      }
    }
  }

  // Dynamically determine which fields are required vs optional
  const allFieldsInData = new Set<string>();
  realObjects.forEach(obj => {
    Object.keys(obj).forEach(key => allFieldsInData.add(key));
  });

  const requiredFields: string[] = [];
  const optionalFields: string[] = [];

  allFieldsInData.forEach(field => {
    if (inheritedFields.includes(field)) {
      return; // Skip inherited fields
    }

    const objectsWithField = realObjects.filter(obj => obj[field] !== undefined);
    if (objectsWithField.length === realObjects.length) {
      requiredFields.push(field);
    } else {
      optionalFields.push(field);
    }
  });

  const allKnownFields = [...requiredFields, ...optionalFields, ...inheritedFields];

  it('should ensure every object has all required fields', () => {
    expect(realObjects.length).toBeGreaterThan(0);
    expect(requiredFields.length).toBeGreaterThan(0);

    console.log('Dynamically detected required fields:', requiredFields);
    console.log('Dynamically detected optional fields:', optionalFields);

    realObjects.forEach((obj, index) => {
      requiredFields.forEach(field => {
        expect(obj[field], `Object at index ${index} (id: ${obj.id}) is missing required field: ${field}`).toBeDefined();
      });

      // Additional validation for nested required fields
      if (obj.character_module_mounts) {
        expect(Array.isArray(obj.character_module_mounts), `Object at index ${index} character_module_mounts should be an array`).toBe(true);
      }

      if (obj.module_scalars) {
        expect(typeof obj.module_scalars, `Object at index ${index} module_scalars should be an object`).toBe('object');
      }

      if (obj.module_classes_ids) {
        expect(Array.isArray(obj.module_classes_ids), `Object at index ${index} module_classes_ids should be an array`).toBe(true);
      }
    });
  });

  it('should flag if none of the objects have any optional field', () => {
    optionalFields.forEach(optionalField => {
      const objectsWithField = realObjects.filter(obj => obj[optionalField] !== undefined);
      
      expect(
        objectsWithField.length,
        `WARNING: No objects have the optional field '${optionalField}'. This might indicate the interface is out of sync with the data.`
      ).toBeGreaterThan(0);
    });
  });

  it('should flag if there are keys in data that are not in the interface', () => {
    const unexpectedKeys = new Set<string>();

    realObjects.forEach(obj => {
      Object.keys(obj).forEach(key => {
        if (!allKnownFields.includes(key)) {
          unexpectedKeys.add(key);
        }
      });
    });

    expect(
      Array.from(unexpectedKeys),
      `Found unexpected keys in data that are not defined in Module interface. Consider adding these to the interface or using the ParseObject indexer.`
    ).toEqual([]);
  });
});
