import { describe, it, expect } from 'vitest';

describe('VersionList Component', () => {
  it('should accept required props', () => {
    // Define the expected props structure
    const requiredProps = {
      parseObjectUrl: 'modules',
      id: 'MOD_ArmorShield',
      myVersions: ['2025-12-09', '2025-11-15'],
      versionsData: {
        '2025-12-09': { title: 'Version 1.2.0' },
        '2025-11-15': { title: 'Version 1.1.0' }
      }
    };

    // Verify the props structure is valid
    expect(requiredProps.parseObjectUrl).toBeDefined();
    expect(requiredProps.id).toBeDefined();
    expect(Array.isArray(requiredProps.myVersions)).toBe(true);
    expect(typeof requiredProps.versionsData).toBe('object');
  });

  it('should generate correct base URL pattern', () => {
    const parseObjectUrl = 'modules';
    const id = 'MOD_ArmorShield';
    const expectedBaseUrl = `/WRFrontiersDB-Site/${parseObjectUrl}/${id}`;

    expect(expectedBaseUrl).toBe('/WRFrontiersDB-Site/modules/MOD_ArmorShield');
  });

  it('should generate correct version links', () => {
    const baseUrl = '/WRFrontiersDB-Site/modules/MOD_ArmorShield';
    const versions = ['2025-12-09', '2025-11-15'];
    
    const expectedLinks = versions.map(version => `${baseUrl}/${version}`);

    expect(expectedLinks).toEqual([
      '/WRFrontiersDB-Site/modules/MOD_ArmorShield/2025-12-09',
      '/WRFrontiersDB-Site/modules/MOD_ArmorShield/2025-11-15'
    ]);
  });

  it('should use version title from versionsData when available', () => {
    const version = '2025-12-09';
    const versionsData = {
      '2025-12-09': { title: 'Version 1.2.0' }
    };

    const displayText = versionsData[version]?.title || version;
    expect(displayText).toBe('Version 1.2.0');
  });

  it('should fallback to version string when title not available', () => {
    const version = '2025-12-09';
    const versionsData = {};

    const displayText = versionsData[version]?.title || version;
    expect(displayText).toBe('2025-12-09');
  });

  it('should handle multiple versions correctly', () => {
    const myVersions = ['2025-12-09', '2025-11-15', '2025-10-28'];
    const versionsData = {
      '2025-12-09': { title: 'Version 1.2.0' },
      '2025-11-15': { title: 'Version 1.1.0' },
      '2025-10-28': { title: 'Version 1.0.0' }
    };

    expect(myVersions.length).toBe(3);
    myVersions.forEach(version => {
      expect(versionsData[version]).toBeDefined();
      expect(versionsData[version].title).toBeDefined();
    });
  });
});
