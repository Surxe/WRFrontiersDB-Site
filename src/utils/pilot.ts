import { refToId, idToRef } from './object_reference';
import type { PilotTalent, Pilot } from '../types/pilot';

/**
 * Enriches pilot talents with their talent_type_id and level by scanning all pilots.
 *
 * For each talent, this function:
 * - Finds which pilot level offers the talent
 * - Extracts the talent_type_id from that level
 * - Determines the pilot level (1-based) where the talent appears
 *
 * @param pilotTalents - Record of all pilot talents
 * @param pilots - Record of all pilots to scan through
 * @returns Record of enriched talents with talent_type_id and level added
 */
export function enrichPilotTalents(
  pilotTalents: Record<string, PilotTalent>,
  pilots: Record<string, Pilot>
): Record<string, PilotTalent> {
  const enriched: Record<string, PilotTalent> = {};

  for (const [talentId, talent] of Object.entries(pilotTalents)) {
    let levelFound: number = -1;
    let talentTypeId: string = '';

    // Search through all pilots
    for (const pilot of Object.values(pilots)) {
      let found = false;

      // Check each level in pilot
      for (let i = 0; i < pilot.levels.length; i++) {
        const levelEntry = pilot.levels[i];
        
        // Convert talentId to full reference format for comparison
        const talentFullRef = idToRef(talentId, 'PilotTalent');
        
        if (levelEntry.talents_refs.includes(talentFullRef)) {
          levelFound = i + 1; // Levels are 1-based
          talentTypeId = refToId(levelEntry.talent_type_ref);
          found = true;
          break;
        }
      }

      if (found) break;
    }

    enriched[talentId] = {
      ...talent,
      talent_type_id: talentTypeId,
      level: levelFound,
    };
  }

  return enriched;
}
