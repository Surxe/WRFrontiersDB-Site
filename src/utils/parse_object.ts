import * as fs from 'fs';
import * as path from 'path';
import type { StaticPathsResult, ParseObject } from '../types/parse_object';
import * as moduleTypes from '../types/module';
import * as pilotTypes from '../types/pilot';
import * as rarityTypes from '../types/rarity';

// File cache to avoid repeated reads
const fileCache = new Map<string, Record<string, any>>();

// Merge all exported constants from type modules
const allTypeExports = {
  ...moduleTypes,
  ...pilotTypes,
  ...rarityTypes,
};

/**
 * Cached file reader to reduce file handle usage
 */
function readJsonFile(filePath: string): any {
  if (fileCache.has(filePath)) {
    return fileCache.get(filePath);
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fileCache.set(filePath, data);
    return data;
  } catch (error) {
    console.warn(`Failed to read JSON file: ${filePath}`, error);
    return null;
  }
}

/**
 * Load parse objects from a specific version
 * Set each object's parseObjectClass attr based on the file name
 * @param parseObjectFile - The object file (e.g., "Objects/Module.json")
 * @param version - The version date string (e.g., "2025-03-04")
 * @returns Object containing parse objects, or empty object if loading fails
 */
export function getParseObjects<T = ParseObject>(
  parseObjectFile: string,
  version: string
): Record<string, T> {
  try {
    const objectsPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/archive',
      version,
      parseObjectFile
    );
    if (fs.existsSync(objectsPath)) {
      const data = readJsonFile(objectsPath);

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
    console.warn(`Could not load ${parseObjectFile} for version ${version}`);
  }
  return {};
}

// Get the latest version only
export function getLatestVersion(): string {
  const versionsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/versions.json'
  );
  const versions = readJsonFile(versionsPath) as Record<string, any>;
  return Object.keys(versions)[0]; // First in the object since they're sorted by date DESC
}


// Get a specific parse object by ID and version
export function getParseObject<T = ParseObject>(
  id: string,
  version: string,
  parseObjectFile: string = 'Objects/Module.json'
): T {
  const objects = getParseObjects(parseObjectFile, version);
  const parseObject = objects[id];

  if (!parseObject) {
    throw new Error(
      `Object ${id} not found in ${parseObjectFile} for version ${version}`
    );
  }

  return parseObject as T;
}

/**
 * Checks if an object is production ready
 * @param objectId - The object ID to check
 * @param version - The version to check in
 * @param parseObjectPath - Path to the object file (e.g., 'Objects/Module.json')
 * @returns true if the object exists and has production_status === 'Ready', false otherwise
 */
export function isObjectProductionReady(
  objectId: string,
  version: string,
  parseObjectPath: string
): boolean {
  const cacheKey = `${parseObjectPath}/${version}`;
  
  if (fileCache.has(cacheKey)) {
    const objects = fileCache.get(cacheKey);
    if (objects) {
      const obj = objects[objectId];
      return obj && obj.production_status === 'Ready';
    }
    return false;
  }

  try {
    const objectPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/archive',
      version,
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

// Generate static paths for objects in latest version only
export async function generateObjectStaticPaths(
  parseObjectPath: string = 'Objects/Module.json',
  prodReadyOnly: boolean = false
): Promise<StaticPathsResult[]> {
  const latestVersion = getLatestVersion();
  const objectsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/archive',
    latestVersion,
    parseObjectPath
  );

  const paths: StaticPathsResult[] = [];

  if (fs.existsSync(objectsPath)) {
    const allObjects = readJsonFile(objectsPath) as Record<string, ParseObject>;

    for (const [objectId, obj] of Object.entries(allObjects)) {
      // Skip production filtering if needed
      if (
        prodReadyOnly &&
        (!obj.production_status || obj.production_status !== 'Ready')
      ) {
        continue;
      }

      // Generate path for latest version only
      paths.push({
        params: { id: objectId, version: latestVersion },
        props: {
          objectVersions: [latestVersion],
        },
      });
    }
  }

  return paths;
}

// Generate static paths for object list pages (e.g., /modules, /pilots, etc.) - latest version only
export function generateObjectListStaticPaths(
  objectType: string
): { params: { id: string } }[] {
  const latestVersion = getLatestVersion();
  const objectPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/archive',
    latestVersion,
    `Objects/${objectType}.json`
  );

  if (fs.existsSync(objectPath)) {
    try {
      const allObjects = readJsonFile(objectPath) as Record<string, ParseObject>;

      // Generate paths for all object IDs
      return Object.keys(allObjects).map((id) => ({
        params: { id },
      }));
    } catch (error) {
      console.warn(
        `Failed to read or parse data file: ${objectPath}`,
        error
      );
    }
  }

  // Fallback: return empty array if data file doesn't exist
  return [];
}
