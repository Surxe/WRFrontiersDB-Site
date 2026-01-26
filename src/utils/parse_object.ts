import fs from 'fs';
import path from 'path';
import type { VersionsData, VersionInfo } from '../types/version';
import type { StaticPathsResult, ParseObject } from '../types/parse_object';
import * as moduleTypes from '../types/module';
import * as pilotTypes from '../types/pilot';
import * as rarityTypes from '../types/rarity';

// Merge all exported constants from type modules
const allTypeExports = {
  ...moduleTypes,
  ...pilotTypes,
  ...rarityTypes,
};

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
      const data = JSON.parse(fs.readFileSync(objectsPath, 'utf8'));

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

// Get all versions and the latest version
export function getAllVersions(): {
  versions: Record<string, VersionInfo>;
  latestVersion: string;
} {
  const versionsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/versions.json'
  );
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8')) as Record<
    string,
    VersionInfo
  >;
  const latestVersion = Object.keys(versions)[0]; // First in the object since they're sorted by date DESC

  return { versions, latestVersion };
}

// Get all versions data from versions.json and the specific version element
// Having all versions is necessary for listing the versions the ParseObject exists in
export function getVersionsData(version: string): VersionsData {
  const versionsPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/versions.json'
  );
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8')) as Record<
    string,
    VersionInfo
  >;
  const versionInfo = versions[version];

  return { versions, versionInfo };
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

    const objects = JSON.parse(fs.readFileSync(objectPath, 'utf8')) as Record<
      string,
      ParseObject
    >;

    const obj = objects[objectId];
    return obj && obj.production_status === 'Ready';
  } catch {
    return false;
  }
}

// Generate static paths for all parse objects across versions
export async function generateObjectStaticPaths(
  parseObjectPath: string = 'Objects/Module.json',
  prodReadyOnly: boolean = false
): Promise<StaticPathsResult[]> {
  // Extract object type from path (e.g., "Objects/Module.json" -> "Module")
  const objectType = path.basename(parseObjectPath, '.json');

  // Load the precomputed summary for this object type
  const summaryPath = path.join(
    process.cwd(),
    'WRFrontiersDB-Data/summaries',
    `${objectType}.json`
  );

  let objectChangeVersions: Record<string, string[]> = {};
  let summaryExists = false;

  if (fs.existsSync(summaryPath)) {
    objectChangeVersions = JSON.parse(
      fs.readFileSync(summaryPath, 'utf8')
    ) as Record<string, string[]>;
    summaryExists = true;
  } else {
    console.warn(`Summary file not found: ${summaryPath}`);
  }

  const paths: StaticPathsResult[] = [];
  const { latestVersion } = getAllVersions();
  const processedObjects = new Set<string>();

  // Process objects from summary file
  if (summaryExists) {
    // For each object in the summary, create paths for each version it was changed in
    for (const [objectId, versions] of Object.entries(objectChangeVersions)) {
      processedObjects.add(objectId);

      for (const version of versions) {
        // Load the specific object to check production status if needed
        if (
          prodReadyOnly &&
          !isObjectProductionReady(objectId, version, parseObjectPath)
        ) {
          continue;
        }

        paths.push({
          params: { id: objectId, version },
          props: {
            objectVersions: versions, // Use the change versions from summary
          },
        });
      }
    }
  }

  // Process objects not in summary file (fallback to latest version only)
  try {
    const latestObjectPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/archive',
      latestVersion,
      parseObjectPath
    );

    if (fs.existsSync(latestObjectPath)) {
      const allObjects = JSON.parse(
        fs.readFileSync(latestObjectPath, 'utf8')
      ) as Record<string, ParseObject>;

      for (const [objectId, obj] of Object.entries(allObjects)) {
        if (!processedObjects.has(objectId)) {
          // Skip production filtering if needed
          if (
            prodReadyOnly &&
            (!obj.production_status || obj.production_status !== 'Ready')
          ) {
            continue;
          }

          paths.push({
            params: { id: objectId, version: latestVersion },
            props: {
              objectVersions: [latestVersion], // Only latest version
            },
          });
        }
      }
    }
  } catch (error) {
    console.warn(
      `Could not load objects from latest version ${latestVersion} for fallback processing: ${error}`
    );
  }

  return paths;
}
