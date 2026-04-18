import * as fs from 'fs';
import * as path from 'path';
import type { StaticPathsResult, ParseObject } from '../types/parse_object';
import * as moduleTypes from '../types/module';
import * as pilotTypes from '../types/pilot';
import * as rarityTypes from '../types/rarity';
import * as characterPresetTypes from '../types/character_preset';

// Merge all exported constants from type modules
const allTypeExports = {
  ...moduleTypes,
  ...pilotTypes,
  ...rarityTypes,
  ...characterPresetTypes,
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
 * @returns true if the object exists and has production_status === 'Ready', false otherwise
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
    const obj = objects[objectId];
    return obj && obj.production_status === 'Ready';
  } catch {
    return false;
  }
}

// Generate static paths for objects in current version only
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

    for (const [objectId, obj] of Object.entries(allObjects)) {
      // Skip production filtering if needed
      if (
        prodReadyOnly &&
        (!obj.production_status ||
          obj.production_status !== 'Ready' ||
          !obj.name ||
          obj.name === '')
      ) {
        continue;
      }

      // Generate path for current version only
      paths.push({
        params: { id: objectId },
        props: {},
      });
    }
  }

  return paths;
}

// Generate static paths for object list pages (e.g., /modules, /pilots, etc.) - current version only
export function generateObjectListStaticPaths(
  objectType:
    | 'Module'
    | 'ModuleCategory'
    | 'Pilot'
    | 'PilotTalent'
    | 'PilotTalentType'
    | 'PilotClass'
    | 'PilotPersonality'
    | 'Rarity'
    | 'CharacterPreset',
  prodReadyOnly: boolean = false
): { params: { id: string } }[] {
  const objectPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/current',
    `Objects/${objectType}.json`
  );

  if (fs.existsSync(objectPath)) {
    try {
      const allObjects = readJsonFile(objectPath) as Record<
        string,
        ParseObject
      >;
      let objectIds = Object.keys(allObjects);

      // Apply production filtering if needed
      if (prodReadyOnly) {
        objectIds = objectIds.filter((id) => {
          const obj = allObjects[id];
          return (
            obj.production_status === 'Ready' &&
            obj.name != null &&
            obj.name !== ''
          );
        });
      }

      // Generate paths for filtered object IDs
      return objectIds.map((id) => ({
        params: { id },
      }));
    } catch (error) {
      console.warn(`Failed to read or parse data file: ${objectPath}`, error);
    }
  }

  // Fallback: return empty array if data file doesn't exist
  return [];
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
    | 'CharacterPreset',
  prodReadyOnly: boolean = false
): Array<{ params: { slug: string }; props: { id: string } }> {
  // Load slug map to generate slug-based paths
  const slugMapPath = path.join(process.cwd(), 'public', 'slug-map.json');
  
  try {
    const slugMapContent = fs.readFileSync(slugMapPath, 'utf-8');
    const slugMap = JSON.parse(slugMapContent);
    
    // Load objects to filter and get production-ready ones
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
    let objectIds = Object.keys(allObjects);

    // Apply production filtering if needed
    if (prodReadyOnly) {
      objectIds = objectIds.filter((id) => {
        const obj = allObjects[id];
        return (
          obj.production_status === 'Ready' &&
          obj.name != null &&
          obj.name !== ''
        );
      });
    }

    // Generate slug-based paths
    const paths = [];
    for (const objectId of objectIds) {
      const slug = slugMap[objectId];
      if (slug) {
        paths.push({
          params: { slug },
          props: { id: objectId }
        });
      } else {
        console.warn(`No slug found for ${objectType} object: ${objectId}`);
      }
    }

    return paths;
  } catch (error) {
    console.warn(`Could not load slug map for ${objectType}, falling back to ID-based paths:`, error);
    // Fallback to ID-based paths
    return generateObjectListStaticPaths(objectType, prodReadyOnly).map(({ params }) => ({
      params: { slug: params.id },
      props: { id: params.id }
    }));
  }
}
