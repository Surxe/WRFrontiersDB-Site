/**
 * Build codes: a resolved build <-> a short string (`/models?a=<code>`).
 *
 * The codec and its registry (`index/build_codes.json`) belong to
 * WRFrontiersDB-Data (`tools/js/build_code.js`, format in its
 * `docs/build-codes.md`); this module only re-exports it with the Site's
 * types. Load the registry with `loadBuildCodec` (browser, robot/data.ts) or
 * `buildTimeBuildCodec` (Astro build, utils/build_codes.ts).
 */
import {
  BuildCodec,
  BuildCodeError,
  TooNew,
} from '../../../../WRFrontiersDB-Data/tools/js/build_code.js';
import type { BuildSelection } from './types';

export { BuildCodec, BuildCodeError, TooNew };

/** The parsed `index/build_codes.json`. */
export type BuildCodesDoc = ConstructorParameters<typeof BuildCodec>[0];

/** The code for a resolved selection, or null when it can't be encoded (an
 * unreleased module, or data newer than the registry). */
export function tryEncode(
  codec: BuildCodec,
  selection: BuildSelection
): string | null {
  try {
    return codec.encode(selection);
  } catch (err) {
    if (err instanceof BuildCodeError) return null;
    throw err;
  }
}
