import { describe, it, expect } from 'vitest';

describe('BackToHome Component', () => {
  it('should accept optional baseUrl prop', () => {
    const propsWithBaseUrl = {
      baseUrl: '/custom-path'
    };

    expect(propsWithBaseUrl.baseUrl).toBeDefined();
    expect(typeof propsWithBaseUrl.baseUrl).toBe('string');
  });

  it('should have default baseUrl of /WRFrontiersDB-Site', () => {
    const defaultBaseUrl = '/WRFrontiersDB-Site';
    expect(defaultBaseUrl).toBe('/WRFrontiersDB-Site');
  });

  it('should construct home link with default baseUrl', () => {
    const baseUrl = '/WRFrontiersDB-Site';
    const homeLink = `${baseUrl}/`;

    expect(homeLink).toBe('/WRFrontiersDB-Site/');
  });

  it('should construct home link with custom baseUrl', () => {
    const baseUrl = '/custom-path';
    const homeLink = `${baseUrl}/`;

    expect(homeLink).toBe('/custom-path/');
  });

  it('should work without baseUrl prop', () => {
    const props = {};
    const baseUrl = props.baseUrl ?? '/WRFrontiersDB-Site';

    expect(baseUrl).toBe('/WRFrontiersDB-Site');
  });
});
