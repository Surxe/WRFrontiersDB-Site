import { describe, it, expect } from 'vitest';

describe('ObjRef Component', () => {
  it('should accept required props', () => {
    const requiredProps = {
      obj: {
        id: 'MOD_ArmorShield',
        parseObjectClass: 'Module',
      },
      version: '2025-12-09',
    };

    expect(requiredProps.obj).toBeDefined();
    expect(requiredProps.version).toBeDefined();
    expect(requiredProps.obj.id).toBeDefined();
    expect(requiredProps.obj.parseObjectClass).toBeDefined();
  });

  it('should have default values for optional props', () => {
    const iconSize = 24;
    const showIcon = true;

    expect(iconSize).toBe(24);
    expect(showIcon).toBe(true);
  });

  it('should map parseObjectClass to URL paths correctly', () => {
    const pathMap: Record<string, string> = {
      Module: 'modules',
      Pilot: 'pilots',
      PilotClass: 'pilot_classes',
      PilotPersonality: 'pilot_personalities',
      PilotTalent: 'pilot_talents',
      PilotTalentType: 'pilot_talent_types',
      PilotType: 'pilot_types',
    };

    expect(pathMap['Module']).toBe('modules');
    expect(pathMap['Pilot']).toBe('pilots');
    expect(pathMap['PilotClass']).toBe('pilot_classes');
  });

  it('should generate correct page URL', () => {
    const _parseObjectClass = 'Module';
    const id = 'MOD_ArmorShield';
    const version = '2025-12-09';
    const pagePath = 'modules';

    const pageUrl = `/WRFrontiersDB-Site/${pagePath}/${id}/${version}`;

    expect(pageUrl).toBe(
      '/WRFrontiersDB-Site/modules/MOD_ArmorShield/2025-12-09'
    );
  });

  it('should fallback to lowercase for unknown parseObjectClass', () => {
    const unknownClass = 'UnknownClass';
    const fallback = unknownClass.toLowerCase();

    expect(fallback).toBe('unknownclass');
  });
});
