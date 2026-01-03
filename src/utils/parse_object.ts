import fs from 'fs';
import path from 'path';
import type { VersionsData } from '../types/version';
import type { StaticPathsResult } from '../types/parse_object';

/**
 * Load parse objects from a specific version
 * @param parseObjectFile - The object file (e.g., "Objects/Module.json")
 * @param version - The version date string (e.g., "2025-03-04")
 * @returns Object containing parse objects, or empty object if loading fails
 */
export function getParseObjects<T = any>(parseObjectFile: string, version: string): Record<string, T> {
  try {
    const objectsPath = path.join(process.cwd(), `WRFrontiersDB-Data/archive/${version}/${parseObjectFile}`);
    if (fs.existsSync(objectsPath)) {
      return JSON.parse(fs.readFileSync(objectsPath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Could not load ${parseObjectFile} for version ${version}`);
  }
  return {};
}

// Get all versions and the latest version
export function getAllVersions(): { versions: Record<string, any>; latestVersion: string } {
  const versionsPath = path.join(process.cwd(), 'WRFrontiersDB-Data/versions.json');
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
  const latestVersion = Object.keys(versions)[0]; // First in the object since they're sorted by date DESC
  
  return { versions, latestVersion };
}

// Get all versions data from versions.json and the specific version element
// Having all versions is necessary for listing the versions the ParseObject exists in
export function getVersionsData(version: string): VersionsData {
  const versionsPath = path.join(process.cwd(), 'WRFrontiersDB-Data/versions.json');
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
  const versionInfo = versions[version];
  
  return { versions, versionInfo };
}

// Get a specific parse object by ID and version
export function getParseObject<T = any>(
  id: string,
  version: string,
  parseObjectFile: string = "Objects/Module.json"
): T {
  const objects = getParseObjects(parseObjectFile, version);
  const parseObject = objects[id];
  
  if (!parseObject) {
    throw new Error(`Object ${id} not found in ${parseObjectFile} for version ${version}`);
  }
  
  return parseObject as T;
}

// Generate static paths for all parse objects across versions
export async function generateObjectStaticPaths(
  parseObjectPath: string = "Objects/Module.json",
  prodReadyOnly: boolean = false
): Promise<StaticPathsResult[]> {
  const versionsPath = path.join(process.cwd(), 'WRFrontiersDB-Data/versions.json');
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
  
  const paths: StaticPathsResult[] = [];
  const objectVersionsMap = new Map<string, string[]>(); // Build lookup table once
  
  // For each version, load its objects and create paths
  for (const version of Object.keys(versions)) {
    try {
      const objectsPath = path.join(process.cwd(), `WRFrontiersDB-Data/archive/${version}/${parseObjectPath}`);
      if (fs.existsSync(objectsPath)) {
        const objects = JSON.parse(fs.readFileSync(objectsPath, 'utf8'));
        
        // For each object in this version, create a path and track versions
        for (const [objectId, obj] of Object.entries(objects)) {
          // Skip objects that are not ready for production if prodReadyOnly is true
          if (prodReadyOnly && (!(obj as any).production_status || (obj as any).production_status !== 'Ready')) {
            continue;
          }
          
          paths.push({ 
            params: { id: objectId, version },
            props: { 
              objectVersions: objectVersionsMap.get(objectId) || [] 
            }
          });
          
          // Build reverse lookup: which versions have this object
          if (!objectVersionsMap.has(objectId)) {
            objectVersionsMap.set(objectId, []);
          }
          objectVersionsMap.get(objectId)!.push(version);
        }
      }
    } catch (error) {
      console.warn(`Could not load objects for version ${version} from ${parseObjectPath}`);
    }
  }
  
  // Update paths with complete version lists
  return paths.map(pathItem => ({
    ...pathItem,
    props: {
      objectVersions: objectVersionsMap.get(pathItem.params.id) || []
    }
  }));
}