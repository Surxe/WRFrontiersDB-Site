#!/usr/bin/env node

/**
 * Build script to generate slug_map.json
 * Usage: npm run build:slugs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Import utilities
import { getParseObjects } from '../src/utils/parse_object.js';
import { generateSlugMap, type SlugMap } from '../src/utils/slug_generator.js';
import type { ParseObject } from '../src/types/parse_object.js';

// Object types to generate slugs for
const OBJECT_TYPES = [
  'Module',
  'Pilot',
  'PilotTalent',
  'PilotTalentType',
  'PilotClass',
  'PilotPersonality',
  'ModuleCategory',
  'ModuleGroup',
  'Rarity',
  'CharacterPreset',
  'FactoryBot',
  'AIBot',
  'Robot',
  'Currency',
];

async function buildSlugMap() {
  console.warn('Building slug map...');

  const slugMap: SlugMap = {};
  const allObjects: Record<string, ParseObject>[] = [];

  // Load all object types
  for (const objectType of OBJECT_TYPES) {
    try {
      const objects = getParseObjects(`Objects/${objectType}.json`);

      // Filter for production-ready objects
      const filteredObjects: Record<string, ParseObject> = {};
      for (const [objectId, object] of Object.entries(objects)) {
        // IMPORTANT: production_status logic:
        // - Modules: Only include if production_status === 'Ready' (missing = not ready)
        // - Other object types: Always include (never have production_status attribute)
        if (objectType === 'Module') {
          // Modules: Only include if production_status === 'Ready'
          const productionStatus = (object as { production_status?: string })
            .production_status;
          if (productionStatus === 'Ready') {
            filteredObjects[objectId] = object;
          }
        } else {
          // Other object types: Include all (they don't have production_status)
          filteredObjects[objectId] = object;
        }
      }

      allObjects.push(filteredObjects);
      console.warn(
        `Loaded ${Object.keys(filteredObjects).length} ${objectType} objects (${Object.keys(objects).length - Object.keys(filteredObjects).length} filtered out)`
      );
    } catch (error) {
      console.warn(`Warning: Could not load ${objectType} objects:`, error);
    }
  }

  // Generate slug map
  try {
    const generatedMap = generateSlugMap(allObjects);
    Object.assign(slugMap, generatedMap);
    console.warn(`Generated ${Object.keys(slugMap).length} slugs`);
  } catch (error) {
    console.error('Error generating slug map:', error);
    process.exit(1);
  }

  // Write slug map to public directory
  const publicDir = path.join(projectRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const slugMapPath = path.join(publicDir, 'slug_map.json');
  fs.writeFileSync(slugMapPath, JSON.stringify(slugMap, null, 2));

  console.warn(`Slug map written to: ${slugMapPath}`);
  console.warn('Build completed successfully!');
}

// Run the build
buildSlugMap().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
