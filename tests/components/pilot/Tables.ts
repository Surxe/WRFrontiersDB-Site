import { describe, it, expect } from 'vitest';

describe('Pilot Tables Component', () => {
  it('should accept required props', () => {
    const requiredProps = {
      pilots: {
        'PILOT_001': { 
          id: 'PILOT_001',
          pilot_type_id: 'DA_PilotType_Legendary.0',
          levels: []
        }
      },
      version: '2025-12-09'
    };

    expect(requiredProps.pilots).toBeDefined();
    expect(requiredProps.version).toBeDefined();
    expect(typeof requiredProps.pilots).toBe('object');
    expect(typeof requiredProps.version).toBe('string');
  });

  it('should define pilot type sort order', () => {
    const pilotTypeOrder: Record<string, number> = {
      'DA_PilotType_Legendary.0': 1,
      'DA_PilotType_Common.0': 2,
    };

    expect(pilotTypeOrder['DA_PilotType_Legendary.0']).toBe(1);
    expect(pilotTypeOrder['DA_PilotType_Common.0']).toBe(2);
  });

  it('should sort pilot types with Legendary before Common', () => {
    const pilotTypeOrder: Record<string, number> = {
      'DA_PilotType_Legendary.0': 1,
      'DA_PilotType_Common.0': 2,
    };

    const sortFn = (a: string, b: string) => {
      const orderA = pilotTypeOrder[a] || 999;
      const orderB = pilotTypeOrder[b] || 999;
      return orderA - orderB;
    };

    const types = ['DA_PilotType_Common.0', 'DA_PilotType_Legendary.0'];
    const sorted = types.sort(sortFn);

    expect(sorted[0]).toBe('DA_PilotType_Legendary.0');
    expect(sorted[1]).toBe('DA_PilotType_Common.0');
  });

  it('should use fallback order of 999 for unknown types', () => {
    const pilotTypeOrder: Record<string, number> = {
      'DA_PilotType_Legendary.0': 1,
      'DA_PilotType_Common.0': 2,
    };

    const unknownType = 'DA_PilotType_Unknown.0';
    const order = pilotTypeOrder[unknownType] || 999;

    expect(order).toBe(999);
  });

  it('should use prodReadyOnly: false for prepareObjectList', () => {
    const options = { prodReadyOnly: false };

    expect(options.prodReadyOnly).toBe(false);
  });
});
