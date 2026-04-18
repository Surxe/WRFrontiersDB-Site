/**
 * Slug resolution utilities for converting between IDs and slugs
 */

import type { SlugMap } from './slug_generator';

// Build-time slug map (will be populated during build)
let slugMap: SlugMap = {};
let reverseSlugMap: Map<string, string> = new Map();

/**
 * Initialize slug map (for build-time usage)
 */
export function initializeSlugMap(map: SlugMap): void {
  slugMap = map;
  reverseSlugMap.clear();

  for (const [id, slug] of Object.entries(map)) {
    reverseSlugMap.set(slug, id);
  }
}

/**
 * Load slug map for runtime usage (browser)
 */
async function loadSlugMap(): Promise<SlugMap> {
  if (typeof window !== 'undefined' && Object.keys(slugMap).length === 0) {
    try {
      const response = await globalThis.fetch('/slug-map.json');
      const map = await response.json();
      slugMap = map;

      // Build reverse map
      reverseSlugMap.clear();
      for (const [id, slug] of Object.entries(map)) {
        reverseSlugMap.set(slug as string, id);
      }
    } catch (error) {
      console.error('Error loading slug map:', error);
      slugMap = {};
    }
  }
  return slugMap;
}

/**
 * Convert object ID to slug
 */
export async function idToSlug(id: string): Promise<string | undefined> {
  if (Object.keys(slugMap).length === 0) {
    await loadSlugMap();
  }
  return slugMap[id];
}

/**
 * Convert slug to object ID
 */
export async function slugToId(slug: string): Promise<string | undefined> {
  if (reverseSlugMap.size === 0) {
    await loadSlugMap();
  }
  return reverseSlugMap.get(slug);
}

/**
 * Check if an ID has a corresponding slug
 */
export async function hasSlug(id: string): Promise<boolean> {
  return (await idToSlug(id)) !== undefined;
}

/**
 * Get all slugs for a given object type
 */
export async function getSlugsByType(objectType: string): Promise<string[]> {
  const map = await loadSlugMap();
  const slugs: string[] = [];

  for (const [id, slug] of Object.entries(map)) {
    if (id.includes(objectType)) {
      slugs.push(slug);
    }
  }

  return slugs;
}
