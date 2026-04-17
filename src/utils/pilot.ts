import { refToId } from './object_reference';
import { PILOT_TYPE_LEGENDARY_REF } from './constants';
import { getDefaultString } from './localization';
import type { PilotTalent, Pilot } from '../types/pilot';

interface PilotWithTalentInfo {
  pilot: Pilot;
  level: number; // Level where talent appears
  talentIndex: number; // Index within that level's talents
}

export interface EnrichedPilotTalent extends PilotTalent {
  pilots_with_this_talent: PilotWithTalentInfo[];
}

/**
 * Enriches pilot talents with their talent_type_id, level, and pilot information by scanning all pilots.
 * Hero pilots are always placed first in the pilots_with_this_talent array.
 *
 * For each talent, this function:
 * - Finds which pilot level offers the talent
 * - Extracts the talent_type_id from that level
 * - Determines the pilot level (1-based) where the talent appears
 * - Builds a list of all pilots that have this talent, with hero pilots sorted first
 *
 * @param pilotTalents - Record of all pilot talents
 * @param pilots - Record of all pilots to scan through
 * @returns Record of enriched talents with talent_type_id, level, and pilots_with_this_talent added
 */
export function enrichPilotTalents(
  pilotTalents: Record<string, PilotTalent>,
  pilots: Record<string, Pilot>
): Record<string, EnrichedPilotTalent> {
  const enriched: Record<string, EnrichedPilotTalent> = {} as Record<
    string,
    EnrichedPilotTalent
  >;

  // Initialize talent entries with empty pilots arrays
  for (const [talentId, talent] of Object.entries(pilotTalents)) {
    enriched[talentId] = {
      ...talent,
      pilots_with_this_talent: [],
    };
  }

  // Scan all pilots to find talent occurrences
  for (const pilot of Object.values(pilots)) {
    for (let levelIndex = 0; levelIndex < pilot.levels.length; levelIndex++) {
      const levelEntry = pilot.levels[levelIndex];

      for (
        let talentIndex = 0;
        talentIndex < (levelEntry.talents_refs?.length || 0);
        talentIndex++
      ) {
        const talentRef = levelEntry.talents_refs[talentIndex];
        const talentId = refToId(talentRef);

        if (enriched[talentId]) {
          enriched[talentId].pilots_with_this_talent.push({
            pilot,
            level: levelIndex + 1, // Levels are 1-based
            talentIndex,
          });

          // Set talent_type_id and level if not already set
          if (!enriched[talentId].talent_type_id) {
            enriched[talentId].talent_type_id = refToId(
              levelEntry.talent_type_ref
            );
          }
          if (!enriched[talentId].level) {
            enriched[talentId].level = levelIndex + 1;
          }
        }
      }
    }
  }

  // Sort pilots_with_this_talent arrays: hero pilots first, then by pilot name
  for (const [talentId, _talent] of Object.entries(enriched)) {
    enriched[talentId].pilots_with_this_talent.sort((a, b) => {
      // Hero pilots first
      const _isHeroA = a.pilot.pilot_type_ref === PILOT_TYPE_LEGENDARY_REF;
      const _isHeroB = b.pilot.pilot_type_ref === PILOT_TYPE_LEGENDARY_REF;

      if (_isHeroA && !_isHeroB) return -1;
      if (!_isHeroA && _isHeroB) return 1;

      // Then sort by pilot name alphabetically
      const _nameA = getDefaultString(a.pilot.first_name) || '';
      const _nameB = getDefaultString(b.pilot.first_name) || '';

      return _nameA.localeCompare(_nameB);
    });
  }

  return enriched;
}
