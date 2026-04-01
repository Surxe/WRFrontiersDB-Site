#!/usr/bin/env node

/**
 * Interface Data Validator
 * Validates TypeScript interfaces against WRFrontiersDB-Data structure
 * Supports nested attribute checking and missing attribute detection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ValidationResult {
  present: number;
  missing: number;
  total: number;
  missingObjects: string[];
  missingObjectDetails: Array<{
    id: string;
    lineNumber: number;
    reason?: string;
  }>;
  percentage: number;
}

class InterfaceDataValidator {
  private dataPath: string;
  private typesPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'WRFrontiersDB-Data', 'current', 'Objects');
    this.typesPath = path.join(process.cwd(), 'src', 'types');
  }

  /**
   * Check if any objects are missing a specific attribute
   * Supports nested attributes using dot notation
   */
  async checkMissingAttribute(
    objectType: string,
    attributePath: string
  ): Promise<ValidationResult> {
    const dataFile = path.join(this.dataPath, `${objectType}.json`);
    
    if (!fs.existsSync(dataFile)) {
      throw new Error(`Data file not found: ${dataFile}`);
    }

    const rawData = fs.readFileSync(dataFile, 'utf8');
    const data = JSON.parse(rawData);
    const objects = Object.values(data);
    
    const result: ValidationResult = {
      present: 0,
      missing: 0,
      total: objects.length,
      missingObjects: [],
      missingObjectDetails: [],
      percentage: 0
    };

    // Track line numbers for object references
    const lines = rawData.split('\n');
    let currentLine = 0;
    let currentObjectId = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('"id":')) {
        const match = line.match(/"id":\s*"([^"]+)"/);
        if (match) {
          currentObjectId = match[1];
          currentLine = i + 1; // 1-based line numbering
        }
      }

      // Check if this object has the attribute
      if (currentObjectId && objects.some((obj: any) => obj.id === currentObjectId)) {
        const obj = objects.find((obj: any) => obj.id === currentObjectId);
        const hasAttribute = this.hasNestedAttribute(obj, attributePath);
        
        if (!hasAttribute) {
          result.missing++;
          result.missingObjects.push(currentObjectId);
          result.missingObjectDetails.push({
            id: currentObjectId,
            lineNumber: currentLine
          });
        } else {
          result.present++;
        }
      }
    }

    result.percentage = (result.present / result.total) * 100;
    return result;
  }

  /**
   * Check if an object has a nested attribute using dot notation
   */
  private hasNestedAttribute(obj: any, path: string): boolean {
    if (!obj || typeof obj !== 'object') return false;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      // Handle array indices
      if (part.includes('[') && part.includes(']')) {
        const [arrayName, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        if (!current[arrayName] || !Array.isArray(current[arrayName])) {
          return false;
        }
        
        if (index >= current[arrayName].length) {
          return false;
        }
        
        current = current[arrayName][index];
      } else {
        if (!current || !Object.prototype.hasOwnProperty.call(current, part)) {
          return false;
        }
        current = current[part];
      }
    }

    return current !== undefined && current !== null;
  }

  /**
   * Generate a comprehensive interface completeness report
   */
  async generateInterfaceReport(objectType: string): Promise<void> {
    console.log(`📋 INTERFACE COMPLETENESS REPORT: ${objectType}\n`);

    try {
      // Load interface definition
      const interfaceFile = path.join(this.typesPath, `${objectType.toLowerCase()}.ts`);
      if (!fs.existsSync(interfaceFile)) {
        console.log(`❌ Interface file not found: ${interfaceFile}`);
        return;
      }

      const interfaceContent = fs.readFileSync(interfaceFile, 'utf8');
      const interfaceFields = this.extractInterfaceFields(interfaceContent);

      // Load actual data
      const dataFile = path.join(this.dataPath, `${objectType}.json`);
      const rawData = fs.readFileSync(dataFile, 'utf8');
      const data = JSON.parse(rawData);
      const objects = Object.values(data);

      console.log(`**Total Objects**: ${objects.length}`);
      console.log(`**Interface Fields**: ${interfaceFields.length}\n`);

      // Check each field
      for (const field of interfaceFields) {
        const result = await this.checkMissingAttribute(objectType, field.name);
        
        if (field.optional) {
          console.log(`🔹 **${field.name}** (optional): ${result.present}/${result.total} objects (${result.percentage.toFixed(1)}%)`);
          if (result.missing > 0) {
            console.log(`   Missing from: ${result.missingObjects.slice(0, 5).join(', ')}${result.missingObjects.length > 5 ? '...' : ''}`);
          }
        } else {
          if (result.missing === 0) {
            console.log(`✅ **${field.name}** (required): Present in all objects`);
          } else {
            console.log(`❌ **${field.name}** (required): Missing from ${result.missing} objects!`);
            console.log(`   Missing from: ${result.missingObjects.slice(0, 5).join(', ')}${result.missingObjects.length > 5 ? '...' : ''}`);
          }
        }
      }

      // Look for extra fields in data
      const dataFields = this.extractDataFields(objects);
      const interfaceFieldNames = new Set(interfaceFields.map(f => f.name));
      const extraFields = dataFields.filter(field => !interfaceFieldNames.has(field));

      if (extraFields.length > 0) {
        console.log(`\n⚠️  **Extra Fields in Data**: ${extraFields.join(', ')}`);
      }

    } catch (error) {
      console.error(`❌ Error generating report: ${error}`);
    }
  }

  /**
   * Extract field names from TypeScript interface
   */
  private extractInterfaceFields(content: string): Array<{name: string, optional: boolean}> {
    const fields: Array<{name: string, optional: boolean}> = [];
    
    // Match interface properties
    const propertyRegex = /(\w+)(\??):\s*[^;]+;/g;
    let match;
    
    while ((match = propertyRegex.exec(content)) !== null) {
      fields.push({
        name: match[1],
        optional: match[2] === '?'
      });
    }
    
    return fields;
  }

  /**
   * Extract all field names from data objects
   */
  private extractDataFields(objects: any[]): string[] {
    const allFields = new Set<string>();
    
    for (const obj of objects) {
      for (const key of Object.keys(obj)) {
        allFields.add(key);
      }
    }
    
    return Array.from(allFields);
  }

  /**
   * Print detailed missing attribute report
   */
  async printMissingAttributeReport(objectType: string, attributePath: string): Promise<void> {
    try {
      const result = await this.checkMissingAttribute(objectType, attributePath);
      
      console.log(`🔍 ATTRIBUTE ANALYSIS: ${attributePath}\n`);
      console.log(`**Presence**: ${result.present}/${result.total} objects (${result.percentage.toFixed(1)}%)`);
      console.log(`**Missing Objects**: ${result.missing} objects`);
      console.log(`**Missing Percentage**: ${(100 - result.percentage).toFixed(1)}%\n`);

      if (result.missingObjects.length > 0) {
        console.log(`**Missing Object IDs**:`);
        result.missingObjects.slice(0, 10).forEach(id => {
          console.log(`- ${id}`);
        });
        
        if (result.missingObjects.length > 10) {
          console.log(`... and ${result.missingObjects.length - 10} more`);
        }

        console.log(`\n**File References**:`);
        console.log(`WRFrontiersDB-Data/current/Objects/${objectType}.json`);
        console.log(`Lines: ${result.missingObjectDetails.slice(0, 10).map(d => d.lineNumber).join(', ')}`);

        console.log(`\n**Analysis**:`);
        if (result.percentage > 95) {
          console.log(`This attribute appears in nearly all objects. Consider making it required in the interface.`);
        } else if (result.percentage < 5) {
          console.log(`This attribute is very rare. Verify if it should be optional or if these are special cases.`);
        } else {
          console.log(`This attribute has moderate presence. Current optional/required status appears appropriate.`);
        }
      } else {
        console.log(`✅ All objects have this attribute.`);
      }

    } catch (error) {
      console.error(`❌ Error checking attribute: ${error}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node validate.js <objectType> <attributePath>  # Check specific attribute');
    console.log('  node validate.js <objectType> report           # Generate full report');
    console.log('');
    console.log('Examples:');
    console.log('  node validate.js Module faction_ref');
    console.log('  node validate.js Module "module_scalars.primary_stat_ref"');
    console.log('  node validate.js Module "character_module_mounts.0.mount"');
    console.log('  node validate.js Module report');
    process.exit(1);
  }

  const validator = new InterfaceDataValidator();
  const objectType = args[0];

  if (args[1] === 'report') {
    await validator.generateInterfaceReport(objectType);
  } else {
    const attributePath = args[1];
    await validator.printMissingAttributeReport(objectType, attributePath);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { InterfaceDataValidator };
