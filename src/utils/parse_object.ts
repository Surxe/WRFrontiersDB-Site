import fs from 'fs';
import path from 'path';

export interface StaticPathsResult {
  params: { id: string; version: string };
  props: { moduleVersions: string[] };
}

export interface VersionsData {
  versions: Record<string, any>;
  versionInfo: any;
}

/**
 * Load parse objects from a specific version
 * @param parseObjectClass - The object type (e.g., "Module", "Pilot")
 * @param version - The version date string (e.g., "2025-03-04")
 * @returns Object containing parse objects, or empty object if loading fails
 */
export function getParseObjects(parseObjectClass: string, version: string): Record<string, any> {
  try {
    const objectsPath = path.join(process.cwd(), `WRFrontiersDB-Data/archive/${version}/Objects/${parseObjectClass}.json`);
    if (fs.existsSync(objectsPath)) {
      return JSON.parse(fs.readFileSync(objectsPath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Could not load ${parseObjectClass} for version ${version}`);
  }
  return {};
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
  parseObjectClass: string = "Module"
): T {
  const objects = getParseObjects(parseObjectClass, version);
  const parseObject = objects[id];
  
  if (!parseObject) {
    throw new Error(`Object ${id} not found in ${parseObjectClass} for version ${version}`);
  }
  
  return parseObject as T;
}

// Generate static paths for all parse objects across versions
export async function generateObjectStaticPaths(
  parseObjectPath: string = "Objects/Module.json",
  prodReadyOnly: boolean = true
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
              moduleVersions: objectVersionsMap.get(objectId) || [] 
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
      moduleVersions: objectVersionsMap.get(pathItem.params.id) || []
    }
  }));
}