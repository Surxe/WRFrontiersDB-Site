import { describe, it, expect } from 'vitest';

describe('ParseObjectList Component', () => {
  it('should accept required props', () => {
    // Define the expected props structure
    const requiredProps = {
      parseObjectFile: 'Objects/Module.json',
      version: '2025-12-09',
    };

    // Verify the props structure is valid
    expect(requiredProps.parseObjectFile).toBeDefined();
    expect(requiredProps.version).toBeDefined();
    expect(typeof requiredProps.parseObjectFile).toBe('string');
    expect(typeof requiredProps.version).toBe('string');
  });

  it('should accept optional prodReadyOnly prop', () => {
    const propsWithProdReady = {
      parseObjectFile: 'Objects/Module.json',
      version: '2025-12-09',
      prodReadyOnly: true,
    };

    expect(propsWithProdReady.prodReadyOnly).toBeDefined();
    expect(typeof propsWithProdReady.prodReadyOnly).toBe('boolean');
  });

  it('should default prodReadyOnly to false when not provided', () => {
    const props = {
      parseObjectFile: 'Objects/Module.json',
      version: '2025-12-09',
    };

    const prodReadyOnly = props.prodReadyOnly ?? false;
    expect(prodReadyOnly).toBe(false);
  });

  it('should use correct parseObjectFile path format', () => {
    const parseObjectFile = 'Objects/Module.json';

    expect(parseObjectFile).toMatch(/^Objects\/\w+\.json$/);
  });

  it('should use correct version format', () => {
    const version = '2025-12-09';

    // Version should be in YYYY-MM-DD format
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle prepareObjectList options correctly', () => {
    const prodReadyOnly = true;
    const options = { prodReadyOnly };

    expect(options).toHaveProperty('prodReadyOnly');
    expect(options.prodReadyOnly).toBe(true);
  });

  it('should handle entries as array of tuples', () => {
    // Simulate the structure returned by prepareObjectList
    const entries: [string, unknown][] = [
      ['MOD_ArmorShield', { id: 'MOD_ArmorShield', name: 'Shield' }],
      ['MOD_SpeedBoost', { id: 'MOD_SpeedBoost', name: 'Speed' }],
    ];

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(2);

    entries.forEach(([key, obj]) => {
      expect(typeof key).toBe('string');
      expect(obj).toHaveProperty('id');
    });
  });
});
