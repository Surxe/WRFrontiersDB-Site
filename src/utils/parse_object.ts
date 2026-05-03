import * as fs from 'fs';
import * as path from 'path';
import type { StaticPathsResult, ParseObject } from '../types/parse_object';
import * as moduleTypes from '../types/module';
import * as pilotTypes from '../types/pilot';
import * as rarityTypes from '../types/rarity';
import * as characterPresetTypes from '../types/character_preset';
import * as virtualBotTypes from '../types/virtual_bot';
import * as moduleGroupTypes from '../types/module_group';
import * as currencyTypes from '../types/currency';
import * as moduleTagTypes from '../types/module_tag';

// import { generateSlugForObject } from './slug_generator';

// Merge all exported constants from type modules
const allTypeExports = {
  ...moduleTypes,
  ...pilotTypes,
  ...rarityTypes,
  ...characterPresetTypes,
  ...virtualBotTypes,
  ...moduleGroupTypes,
  ...currencyTypes,
  ...moduleTagTypes,
};

/**
 * Simple file reader
 */
function readJsonFile(filePath: string): Record<string, ParseObject> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`Failed to read JSON file: ${filePath}`, error);
    return null;
  }
}

/**
 * Load parse objects from the current directory
 * Set each object's parseObjectClass attr based on the file name
 * @param parseObjectFile - The object file (e.g., "Objects/Module.json")
 * @returns Object containing parse objects, or empty object if loading fails
 */
export function getParseObjects<T = ParseObject>(
  parseObjectFile: string
): Record<string, T> {
  try {
    const objectsPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/current',
      parseObjectFile
    );
    if (fs.existsSync(objectsPath)) {
      const data = readJsonFile(objectsPath);

      if (!data) {
        return {};
      }

      // Extract parseObjectClass from parseObjectFile (e.g., "Objects/Module.json" -> "Module")
      const fileName = parseObjectFile.split('/').pop() || '';
      const parseObjectClass = fileName.split('.')[0];

      // Dynamically derive URL constant name: "ModuleStat" -> "MODULESTAT_URL"
      const urlConstName = parseObjectClass.toUpperCase() + '_URL';
      const parseObjectUrl = allTypeExports[
        urlConstName as keyof typeof allTypeExports
      ] as string;

      // Add parseObjectClass and parseObjectUrl to each object
      const objectsWithType: Record<string, T> = {};
      for (const [key, value] of Object.entries(data)) {
        objectsWithType[key] = {
          ...(value as object),
          parseObjectClass,
          parseObjectUrl,
        } as T;
      }

      return objectsWithType;
    }
  } catch {
    console.warn(`Could not load ${parseObjectFile}`);
  }
  return {};
}

// Get a specific parse object by ID
export function getParseObject<T = ParseObject>(
  id: string,
  parseObjectFile: string = 'Objects/Module.json'
): T {
  const objects = getParseObjects(parseObjectFile);
  const parseObject = objects[id];

  if (!parseObject) {
    throw new Error(`Object ${id} not found in ${parseObjectFile}`);
  }

  return parseObject as T;
}

/**
 * Checks if an object is production ready
 * @param objectId - The object ID to check
 * @param parseObjectPath - Path to the object file (e.g., 'Objects/Module.json')
 * @returns true if the object exists and meets production criteria, false otherwise
 * Note: Only Modules require production_status === 'Ready'. All other parse object classes are always production ready.
 */
export function isObjectProductionReady(
  objectId: string,
  parseObjectPath: string
): boolean {
  try {
    const objectPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/current',
      parseObjectPath
    );

    if (!fs.existsSync(objectPath)) {
      return false;
    }

    const objects = readJsonFile(objectPath) as Record<string, ParseObject>;
    // Extract object type from path to determine production criteria
    const isModule = parseObjectPath.includes('Module.json');
    const obj = objects[objectId];

    if (!obj) {
      return false;
    }

    // Only Modules require production_status === 'Ready'
    if (isModule) {
      return obj.production_status === 'Ready';
    }

    // All other parse object classes are always production ready
    return true;
  } catch {
    return false;
  }
}

// Generate static paths for objects
export async function generateObjectStaticPaths(
  parseObjectPath: string = 'Objects/Module.json',
  prodReadyOnly: boolean = false
): Promise<StaticPathsResult[]> {
  const objectsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/current',
    parseObjectPath
  );

  const paths: StaticPathsResult[] = [];

  if (fs.existsSync(objectsPath)) {
    const allObjects = readJsonFile(objectsPath) as Record<string, ParseObject>;

    for (const [objectId, object] of Object.entries(allObjects)) {
      // Skip production filtering if needed
      if (
        prodReadyOnly &&
        parseObjectPath.includes('Module.json') &&
        (!object.production_status ||
          object.production_status !== 'Ready' ||
          !object.name ||
          object.name === '')
      ) {
        continue;
      }

      // Generate path
      paths.push({
        params: { id: objectId },
        props: {},
      });
    }
  }

  return paths;
}

// Generate slug-based static paths for object detail pages
export function generateSlugBasedStaticPaths(
  objectType:
    | 'Module'
    | 'ModuleCategory'
    | 'Pilot'
    | 'PilotTalent'
    | 'PilotTalentType'
    | 'PilotClass'
    | 'PilotPersonality'
    | 'Rarity'
    | 'CharacterPreset'
    | 'VirtualBot'
    | 'ModuleGroup'
    | 'Currency'
): Array<{ params: { slug: string }; props: { id: string } }> {
  // Load slug map to generate slug-based paths
  const slugMapPath = path.join(process.cwd(), 'public', 'slug_map.json');

  try {
    const slugMapContent = fs.readFileSync(slugMapPath, 'utf-8');
    const slugMap = JSON.parse(slugMapContent);

    // Load objects and generate slug-based paths
    const objectPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/current',
      `Objects/${objectType}.json`
    );

    if (!fs.existsSync(objectPath)) {
      console.warn(`Object file not found: ${objectPath}`);
      return [];
    }

    const allObjects = readJsonFile(objectPath) as Record<string, ParseObject>;

    // Generate slug-based paths for production-ready objects only
    const paths = [];
    for (const [objectId, object] of Object.entries(allObjects)) {
      // Apply production status filtering only to Modules
      // All other parse object classes are always production ready
      if (
        objectType === 'Module' &&
        (!object.production_status || object.production_status !== 'Ready')
      ) {
        continue;
      }

      // Use original slug map logic for static path generation
      let slug = slugMap[objectId];

      if (!slug) {
        throw new Error(
          `No slug found for ${objectType} object with ID ${objectId}. All production objects must have a valid slug entry in the slug map.`
        );
      }
      paths.push({
        params: { slug },
        props: { id: objectId },
      });
    }

    return paths;
  } catch (error) {
    throw new Error(
      `Could not load slug map for ${objectType}. Slug map must exist for build to succeed: ${error}`
    );
  }
}

/**
 * Get all parse objects from all object types, grouped by object type
 * @returns Object containing all parse objects keyed by object type
 */
export function getAllParseObjects(): Record<
  string,
  Record<string, ParseObject>
> {
  const objectsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/current/Objects'
  );
  const allObjects: Record<string, Record<string, ParseObject>> = {};

  try {
    if (fs.existsSync(objectsPath)) {
      const files = fs.readdirSync(objectsPath);

      // Filter for JSON files and extract object type from filename
      const objectFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of objectFiles) {
        const objectType = file.replace('.json', '');

        try {
          const objects = getParseObjects<ParseObject>(`Objects/${file}`);
          allObjects[objectType] = objects;
        } catch (error) {
          console.warn(`Could not load ${objectType} objects:`, error);
          allObjects[objectType] = {};
        }
      }
    }
  } catch (error) {
    console.warn('Could not read Objects directory:', error);
  }

  return allObjects;
}
