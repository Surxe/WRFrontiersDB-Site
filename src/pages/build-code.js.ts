import type { APIRoute } from 'astro';
import { readBuildCodeFile } from '../utils/build_codes';

/** The data repo's build-code codec, for other apps (its docs/build-codes.md). */
export const GET: APIRoute = () =>
  new Response(readBuildCodeFile('codec'), {
    headers: { 'Content-Type': 'application/javascript' },
  });
