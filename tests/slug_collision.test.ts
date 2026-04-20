/**
 * Tests for slug collision detection across different object types
 */

import { describe, it, expect } from 'vitest';
import { getAllParseObjects } from '../src/utils/parse_object';
import fs from 'fs';

describe('slug_collision', () => {
  it('should not have slug collisions within the same object type', () => {
    // Load all object types at once
    const allObjects = getAllParseObjects();

    // Load slug map
    const slugMap = JSON.parse(fs.readFileSync('public/slug_map.json', 'utf8'));

    // Group slugs by object type dynamically using all keys from getAllParseObjects
    const slugsByType: Record<string, Record<string, string>> = {};

    // Map objects to their slugs by type using the allObjects structure
    Object.entries(allObjects).forEach(([objectType, objects]) => {
      slugsByType[objectType] = {};
      Object.entries(objects).forEach(([id]) => {
        if (slugMap[id]) {
          slugsByType[objectType][id] = slugMap[id];
        }
      });
    });

    // Check for collisions within each object type
    const collisions: Array<{ type: string; slug: string; objects: string[] }> =
      [];

    Object.entries(slugsByType).forEach(([objectType, slugs]) => {
      const slugCounts: Record<string, string[]> = {};

      Object.entries(slugs).forEach(([objectId, slug]) => {
        if (!slugCounts[slug]) {
          slugCounts[slug] = [];
        }
        slugCounts[slug].push(objectId);
      });

      // Find collisions (slugs used by multiple objects of the same type)
      Object.entries(slugCounts).forEach(([slug, objectIds]) => {
        if (objectIds.length > 1) {
          collisions.push({
            type: objectType,
            slug: slug as string,
            objects: objectIds,
          });
        }
      });
    });

    // Error on all collisions within the same object type
    if (collisions.length > 0) {
      const collisionReport = collisions
        .map(
          (c) =>
            `${c.type}: "${c.slug}" used by ${c.objects.length} objects: ${c.objects.slice(0, 3).join(', ')}${c.objects.length > 3 ? '...' : ''}`
        )
        .join('\n');

      throw new Error(
        `Slug collisions detected within object types:\n${collisionReport}`
      );
    }

    // Verify titan shoulder enhancement worked
    const titanShoulderSlugs = Object.entries(slugsByType.Module)
      .filter(([, slug]) => (slug as string).includes('titan-shoulder'))
      .map(([id, slug]) => ({ id, slug: slug as string }));

    // Should have distinct left/right slugs
    const leftShoulders = titanShoulderSlugs.filter(({ slug }) =>
      slug.includes('left')
    );
    const rightShoulders = titanShoulderSlugs.filter(({ slug }) =>
      slug.includes('right')
    );

    expect(leftShoulders.length).toBeGreaterThan(0);
    expect(rightShoulders.length).toBeGreaterThan(0);

    // Verify no overlapping titan shoulder slugs
    const titanSlugCounts: Record<string, number> = {};
    titanShoulderSlugs.forEach(({ slug }) => {
      titanSlugCounts[slug] = (titanSlugCounts[slug] || 0) + 1;
    });

    const titanCollisions = Object.entries(titanSlugCounts).filter(
      ([_, count]) => count > 1
    );

    expect(titanCollisions).toHaveLength(0);
  });
});
