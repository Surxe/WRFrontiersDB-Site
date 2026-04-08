import { describe, it, expect } from 'vitest';
import { getParseObjects } from '../../../src/utils/parse_object';
import { enrichPilotTalents } from '../../../src/utils/pilot';
import type { PilotTalentType, PilotTalent, Pilot } from '../../../src/types/pilot';

describe('pilot talent type talent count', () => {
  it('should have either 3 or 5+ pilot talents for each pilot talent type', () => {
    // Load all the data
    const pilotTalentTypes = getParseObjects<PilotTalentType>('Objects/PilotTalentType.json');
    const pilots = getParseObjects<Pilot>('Objects/Pilot.json');
    const pilotTalents = getParseObjects<PilotTalent>('Objects/PilotTalent.json');
    const enrichedTalents = enrichPilotTalents(pilotTalents, pilots);

    // Group talents by talent type
    const talentsByType: Record<string, typeof enrichedTalents> = {};
    
    Object.entries(enrichedTalents).forEach(([talentId, talent]) => {
      if (talent.talent_type_id) {
        if (!talentsByType[talent.talent_type_id]) {
          talentsByType[talent.talent_type_id] = {};
        }
        talentsByType[talent.talent_type_id][talentId] = talent;
      }
    });

    // Check each pilot talent type has either 3 talents or 5+ talents
    Object.entries(pilotTalentTypes).forEach(([typeId, _talentType]) => {
      const talentsForType = talentsByType[typeId] || {};
      const talentCount = Object.keys(talentsForType).length;
      
      if (typeId === 'DA_TalentType_Ult.0') {
        expect(talentCount).toBeGreaterThanOrEqual(5);
      } else {
        expect(talentCount).toBe(3);
      }
    });

    // Also verify we have the expected number of talent types
    const expectedTalentTypeCount = Object.keys(pilotTalentTypes).length;
    const actualTalentTypeCount = Object.keys(talentsByType).length;
    
    expect(actualTalentTypeCount).toBe(expectedTalentTypeCount);
  });

  it('should list the talent counts for verification', () => {
    // Load all the data
    const pilotTalentTypes = getParseObjects<PilotTalentType>('Objects/PilotTalentType.json');
    const pilots = getParseObjects<Pilot>('Objects/Pilot.json');
    const pilotTalents = getParseObjects<PilotTalent>('Objects/PilotTalent.json');
    const enrichedTalents = enrichPilotTalents(pilotTalents, pilots);

    // Group talents by talent type
    const talentsByType: Record<string, typeof enrichedTalents> = {};
    
    Object.entries(enrichedTalents).forEach(([talentId, talent]) => {
      if (talent.talent_type_id) {
        if (!talentsByType[talent.talent_type_id]) {
          talentsByType[talent.talent_type_id] = {};
        }
        talentsByType[talent.talent_type_id][talentId] = talent;
      }
    });

    // Log the counts for manual verification
    console.warn('Pilot Talent Type Talent Counts:');
    Object.entries(pilotTalentTypes).forEach(([typeId, _talentType]) => {
      const talentsForType = talentsByType[typeId] || {};
      const talentCount = Object.keys(talentsForType).length;
      const talentNames = Object.values(talentsForType).map(t => t.name?.Key || t.id);
      
      console.warn(`${typeId}: ${talentCount} talents - ${talentNames.join(', ')}`);
    });
  });
});
