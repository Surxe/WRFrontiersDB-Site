import { describe, it, expect } from 'vitest';
import type { PilotTalentType } from '../../../src/types/pilot';
import type { LocalizationKey } from '../../../src/types/localization';

describe('PilotTalentType', () => {
  it('should accept a valid PilotTalentType object with all required fields', () => {
    const validTalentType: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_Offensive',
      name: {
        Key: 'PTT_Offensive_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'Offensive'
      },
      image_path: 'WRFrontiers/Content/Sparrow/UI/Textures/Pilots/TalentTypes/T_Offensive'
    };

    expect(validTalentType.parseObjectClass).toBe('PilotTalentType');
    expect(validTalentType.id).toBe('PTT_Offensive');
    expect(validTalentType.name.en).toBe('Offensive');
    expect(validTalentType.image_path).toContain('T_Offensive');
  });

  it('should accept PilotTalentType with optional description', () => {
    const withDescription: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_Defensive',
      name: {
        Key: 'PTT_Defensive_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'Defensive'
      },
      description: {
        Key: 'PTT_Defensive_Desc',
        TableNamespace: 'PilotTalentTypes',
        en: 'Focuses on defensive capabilities'
      },
      image_path: 'WRFrontiers/Content/Sparrow/UI/Textures/Pilots/TalentTypes/T_Defensive'
    };

    expect(withDescription.description).toBeDefined();
    expect(withDescription.description?.en).toBe('Focuses on defensive capabilities');
  });

  it('should accept PilotTalentType without optional description', () => {
    const withoutDescription: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_Support',
      name: {
        Key: 'PTT_Support_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'Support'
      },
      image_path: 'WRFrontiers/Content/Sparrow/UI/Textures/Pilots/TalentTypes/T_Support'
    };

    expect(withoutDescription.description).toBeUndefined();
  });

  it('should accept PilotTalentType with production_status from ParseObject', () => {
    const withProductionStatus: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_Test',
      name: {
        Key: 'PTT_Test_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'Test'
      },
      image_path: 'WRFrontiers/Content/Test',
      production_status: 'Ready'
    };

    expect(withProductionStatus.production_status).toBe('Ready');
  });

  it('should support different production_status values', () => {
    const notReady: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_InDev',
      name: {
        Key: 'PTT_InDev_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'In Development'
      },
      image_path: 'WRFrontiers/Content/InDev',
      production_status: 'InDevelopment'
    };

    expect(notReady.production_status).toBe('InDevelopment');
  });

  it('should work in arrays', () => {
    const talentTypes: PilotTalentType[] = [
      {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_1',
        name: { Key: 'PTT_1_Name', TableNamespace: 'PilotTalentTypes', en: 'Type 1' },
        image_path: 'Path1'
      },
      {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_2',
        name: { Key: 'PTT_2_Name', TableNamespace: 'PilotTalentTypes', en: 'Type 2' },
        image_path: 'Path2'
      }
    ];

    expect(talentTypes).toHaveLength(2);
    expect(talentTypes[0].id).toBe('PTT_1');
    expect(talentTypes[1].name.en).toBe('Type 2');
  });

  it('should allow additional properties from ParseObject indexer', () => {
    const withAdditionalProps: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: 'PTT_Custom',
      name: {
        Key: 'PTT_Custom_Name',
        TableNamespace: 'PilotTalentTypes',
        en: 'Custom'
      },
      image_path: 'WRFrontiers/Content/Custom',
      custom_property: 'custom_value',
      another_field: 123
    };

    expect(withAdditionalProps.custom_property).toBe('custom_value');
    expect(withAdditionalProps.another_field).toBe(123);
  });

  it('should support empty string values', () => {
    const withEmptyStrings: PilotTalentType = {
      parseObjectClass: 'PilotTalentType',
      id: '',
      name: {
        Key: '',
        TableNamespace: '',
        en: ''
      },
      image_path: ''
    };

    expect(withEmptyStrings.id).toBe('');
    expect(withEmptyStrings.image_path).toBe('');
  });

  it('should support various image path formats', () => {
    const talentTypes = [
      {
        parseObjectClass: 'PilotTalentType' as const,
        id: 'PTT_1',
        name: { Key: 'K1', TableNamespace: 'NS', en: 'Name1' },
        image_path: 'WRFrontiers/Content/Sparrow/UI/Textures/Icon'
      },
      {
        parseObjectClass: 'PilotTalentType' as const,
        id: 'PTT_2',
        name: { Key: 'K2', TableNamespace: 'NS', en: 'Name2' },
        image_path: '/absolute/path/to/icon'
      },
      {
        parseObjectClass: 'PilotTalentType' as const,
        id: 'PTT_3',
        name: { Key: 'K3', TableNamespace: 'NS', en: 'Name3' },
        image_path: 'relative/path'
      }
    ];

    expect(talentTypes[0].image_path).toContain('WRFrontiers');
    expect(talentTypes[1].image_path).toContain('/absolute/');
    expect(talentTypes[2].image_path).toBe('relative/path');
  });

  it('should support filtering by production_status', () => {
    const allTalentTypes: PilotTalentType[] = [
      {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_Ready',
        name: { Key: 'K1', TableNamespace: 'NS', en: 'Ready Type' },
        image_path: 'Path1',
        production_status: 'Ready'
      },
      {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_InDev',
        name: { Key: 'K2', TableNamespace: 'NS', en: 'Dev Type' },
        image_path: 'Path2',
        production_status: 'InDevelopment'
      },
      {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_NoStatus',
        name: { Key: 'K3', TableNamespace: 'NS', en: 'No Status Type' },
        image_path: 'Path3'
      }
    ];

    const readyOnly = allTalentTypes.filter(t => t.production_status === 'Ready');
    expect(readyOnly).toHaveLength(1);
    expect(readyOnly[0].id).toBe('PTT_Ready');
  });
});
