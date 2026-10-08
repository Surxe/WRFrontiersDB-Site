import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  BuildCodec,
  BuildCodeError,
  TooNew,
  tryEncode,
  type BuildCodesDoc,
} from '../../../src/scripts/robot/build/code';

// The data repo's codec, through the Site's wrapper, against the data repo's
// vectors: the real registry, and the synthetic one that reaches the two- and
// three-character tiers.
const data = path.join(process.cwd(), 'WRFrontiersDB-Data');
const read = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(data, rel), 'utf8')) as T;

interface Vectors {
  vectors: { code: string; build: Record<string, string>; name?: string }[];
  encode_errors: { build: Record<string, string>; error: string }[];
  decode_errors: { code: string; error: string }[];
}

const suites: Record<string, [string, string]> = {
  real: ['index/build_codes.json', 'index/build_code_vectors.json'],
  synthetic: [
    'tests/fixtures/build_codes/registry.json',
    'tests/fixtures/build_codes/vectors.json',
  ],
};

for (const [suite, [registryPath, vectorsPath]] of Object.entries(suites)) {
  describe(`build codes: ${suite} vectors`, () => {
    const codec = new BuildCodec(read<BuildCodesDoc>(registryPath));
    const vectors = read<Vectors>(vectorsPath);

    it('encode and decode every vector', () => {
      expect(vectors.vectors.length).toBeGreaterThan(0);
      for (const v of vectors.vectors) {
        expect(codec.encode(v.build), v.name ?? v.code).toBe(v.code);
        expect(codec.decode(v.code), v.name ?? v.code).toEqual(v.build);
      }
    });

    it('rejects the encode errors (tryEncode gives null)', () => {
      for (const v of vectors.encode_errors) {
        expect(() => codec.encode(v.build)).toThrow(BuildCodeError);
        expect(tryEncode(codec, v.build)).toBeNull();
      }
    });

    it('rejects the decode errors with the right class', () => {
      for (const v of vectors.decode_errors) {
        let caught: unknown = null;
        try {
          codec.decode(v.code);
        } catch (err) {
          caught = err;
        }
        expect(caught, v.code).toBeInstanceOf(BuildCodeError);
        expect((caught as Error).name, v.code).toBe(v.error);
        if (v.error === 'TooNew') expect(caught).toBeInstanceOf(TooNew);
      }
    });
  });
}
