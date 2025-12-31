import fs from 'fs';
import path from 'path';

export interface StaticPathsResult {
  params: { id: string; version: string };
  props: { moduleVersions: string[] };
}

export function getParseObject<T = any>(
  id: string,
  version: string,
  parseObjectPath: string = "Objects/Module.json"
): T {
  try {
    const objectsPath = path.join(process.cwd(), `WRFrontiersDB-Data/archive/${version}/${parseObjectPath}`);
    const objects = JSON.parse(fs.readFileSync(objectsPath, 'utf8'));
    const object = objects[id];
    
    if (!object) {
      throw new Error(`Object ${id} not found`);
    }
    
    return object as T;
  } catch (error) {
    throw new Error(`Object not found for version ${version}: ${error}`);
  }
}

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