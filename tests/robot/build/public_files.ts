import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { APIContext } from 'astro';
import { GET as getCodec } from '../../../src/pages/build-code.js';
import { GET as getRegistry } from '../../../src/pages/build_codes.json';

// The build-code files other apps load from the Site are the data repo's own.
const data = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), 'WRFrontiersDB-Data', rel), 'utf8');

describe('public build-code files', () => {
  it.each([
    [
      '/build-code.js',
      getCodec,
      'tools/js/build_code.js',
      'application/javascript',
    ],
    [
      '/build_codes.json',
      getRegistry,
      'index/build_codes.json',
      'application/json',
    ],
  ])('%s is the data repo file', async (_url, get, rel, type) => {
    const response = await get({} as APIContext);
    expect(response.headers.get('Content-Type')).toBe(type);
    expect(await response.text()).toBe(data(rel));
  });
});
