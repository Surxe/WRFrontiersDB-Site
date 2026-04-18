#!/usr/bin/env node

/**
 * Build script to generate slug-map.json
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
import { MODULE_GROUPS } from '../src/utils/module_group_mapping.js';

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
];

async function buildSlugMap() {
  console.log('Building slug map...');
  
  const slugMap: SlugMap = {};
  const allObjects: Record<string, any>[] = [];

  // Load all object types
  for (const objectType of OBJECT_TYPES) {
    try {
      const objects = getParseObjects(`Objects/${objectType}.json`);
      allObjects.push(objects);
      console.log(`Loaded ${Object.keys(objects).length} ${objectType} objects`);
    } catch (error) {
      console.warn(`Warning: Could not load ${objectType} objects:`, error);
    }
  }

  // Generate slug map
  try {
    const generatedMap = generateSlugMap(allObjects);
    Object.assign(slugMap, generatedMap);
    console.log(`Generated ${Object.keys(slugMap).length} slugs`);
  } catch (error) {
    console.error('Error generating slug map:', error);
    process.exit(1);
  }

  // Generate slugs for module groups (using plural names)
  for (const [groupId, groupData] of Object.entries(MODULE_GROUPS)) {
    const slug = groupData.name.en.toLowerCase().replace(/\s+/g, '-');
    slugMap[groupId] = slug;
  }
  console.log(`Added ${Object.keys(MODULE_GROUPS).length} module group slugs`);

  // Write slug map to public directory
  const publicDir = path.join(projectRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const slugMapPath = path.join(publicDir, 'slug-map.json');
  fs.writeFileSync(slugMapPath, JSON.stringify(slugMap, null, 2));
  
  console.log(`Slug map written to: ${slugMapPath}`);
  console.log('Build completed successfully!');
}

// Run the build
buildSlugMap().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
