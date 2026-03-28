import * as path from 'path';
import * as fs from 'fs';
import { getAllVersions } from './parse_object';

/**
 * Gets the path to a summary file for a given object type
 * @param objectType - The object type (e.g., 'Module', 'Pilot', 'Ability')
 * @returns The full path to the summary file
 */
export function getSummaryPath(objectType: string): string {
  return path.join(
    process.cwd(),
    'WRFrontiersDB-Data/summaries',
    `${objectType}.json`
  );
}

/**
 * Gets the earliest version from the versions config
 * @returns The earliest version string (first version in chronological order)
 */
export function getEarliestVersion(): string {
  const { versions } = getAllVersions();
  const versionKeys = Object.keys(versions);
  return versionKeys[versionKeys.length - 1]; // Last item is earliest since they're sorted DESC
}

/**
 * Gets the latest version for an object, falling back to the earliest version if not found
 * @param objectId - The object ID
 * @param objectType - The object type (e.g., 'Module', 'Pilot', 'Ability')
 * @returns The version string (never null)
 */
export function getLatestVersionForObject(
  objectId: string,
  objectType: string
): string {
  const summaryPath = getSummaryPath(objectType);

  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(
        fs.readFileSync(summaryPath, 'utf8')
      ) as Record<string, string[]>;
      const versions = summary[objectId];

      if (versions && versions.length > 0) {
        // Return the last item (latest version from summary)
        return versions[versions.length - 1];
      }
    } catch (error) {
      console.warn(
        `Failed to read or parse summary file: ${summaryPath}`,
        error
      );
    }
  } else {
    // Summary file doesn't exist, use earliest version for objects without summary
    console.warn(
      `Summary file not found for ${objectType}, using earliest version as fallback`
    );
  }

  // Fallback to earliest version when summary file doesn't exist
  return getEarliestVersion();
}
