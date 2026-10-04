import type { APIRoute } from 'astro';
import { buildMetaDescriptionsDocument } from '../utils/object_meta_descriptions';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildMetaDescriptionsDocument()), {
    headers: { 'Content-Type': 'application/json' },
  });
