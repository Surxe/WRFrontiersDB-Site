#!/usr/bin/env node

/**
 * Interface Data Validator - CommonJS version
 * Validates TypeScript interfaces against WRFrontiersDB-Data structure
 */

const fs = require('fs');
const path = require('path');

class InterfaceDataValidator {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'WRFrontiersDB-Data', 'current', 'Objects');
    this.typesPath = path.join(process.cwd(), 'src', 'types');
  }

  /**
   * Check if any objects are missing a specific attribute
   * Supports nested attributes using dot notation
   */
  async checkMissingAttribute(objectType, attributePath) {
    const dataFile = path.join(this.dataPath, `${objectType}.json`);
    
    if (!fs.existsSync(dataFile)) {
      throw new Error(`Data file not found: ${dataFile}`);
    }

    const rawData = fs.readFileSync(dataFile, 'utf8');
    const data = JSON.parse(rawData);
    const objects = Object.values(data);
    
    const result = {
      present: 0,
      missing: 0,
      total: objects.length,
      missingObjects: [],
      missingObjectDetails: [],
      percentage: 0
    };

    // Process each object once
    for (const obj of objects) {
      const hasAttribute = this.hasNestedAttribute(obj, attributePath);
      
      if (!hasAttribute) {
        result.missing++;
        result.missingObjects.push(obj.id);
        // Find line number for this object
        const lineNumber = this.findObjectLineNumber(rawData, obj.id);
        result.missingObjectDetails.push({
          id: obj.id,
          lineNumber: lineNumber
        });
      } else {
        result.present++;
      }
    }

    result.percentage = (result.present / result.total) * 100;
    return result;
  }

  /**
   * Find the line number where an object's ID appears in the JSON file
   */
  findObjectLineNumber(rawData, objectId) {
    const lines = rawData.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"id": "${objectId}"`)) {
        return i + 1; // 1-based line numbering
      }
    }
    return 0;
  }

  /**
   * Check if an object has a nested attribute using dot notation
   */
  hasNestedAttribute(obj, path) {
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
   * Print detailed missing attribute report
   */
  async printMissingAttributeReport(objectType, attributePath) {
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
    console.log('  node validate.cjs <objectType> <attributePath>  # Check specific attribute');
    console.log('');
    console.log('Examples:');
    console.log('  node validate.cjs Module faction_ref');
    console.log('  node validate.cjs Module "module_scalars.primary_stat_ref"');
    console.log('  node validate.cjs Module "character_module_mounts.0.mount"');
    process.exit(1);
  }

  const validator = new InterfaceDataValidator();
  const objectType = args[0];
  const attributePath = args[1];

  await validator.printMissingAttributeReport(objectType, attributePath);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { InterfaceDataValidator };
