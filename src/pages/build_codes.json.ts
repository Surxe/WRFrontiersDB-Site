import type { APIRoute } from 'astro';
import { readBuildCodeFile } from '../utils/build_codes';

/** The data repo's build-code registry, read by `/build-code.js` here and in
 * other apps (its docs/build-codes.md). */
export const GET: APIRoute = () =>
  new Response(readBuildCodeFile('registry'), {
    headers: { 'Content-Type': 'application/json' },
  });
