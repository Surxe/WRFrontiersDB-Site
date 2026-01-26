import path from 'path';
import fs from 'fs';
import { getAllVersions } from './parse_object';

/**
 * Gets the path to a summary file for a given object type
 * @param objectType - The object type (e.g., 'Module', 'Pilot', 'Ability')
 * @returns The full path to the summary file
 */
export function getSummaryPath(objectType: string): string {
  return path.join(
    import.meta.env.PWD,
    'WRFrontiersDB-Data/summaries',
    `${objectType}.json`
  );
}

/**
 * Gets the latest version for an object, falling back to the overall latest version if not found
 * @param objectId - The object ID
 * @param objectType - The object type (e.g., 'Module', 'Pilot', 'Ability')
 * @returns The latest version string (never null)
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
  }

  // Fallback to overall latest version
  const { latestVersion } = getAllVersions();
  return latestVersion;
}
