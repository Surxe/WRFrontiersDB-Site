/**
 * Base slug utilities used across the application
 */

/**
 * Convert string to slug format
 * - Lowercase
 * - Replace special characters with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes first
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Alias for toSlug to match naming in other parts of the app
 */
export const slugify = toSlug;

/**
 * Convert camelCase/PascalCase to kebab-case and strip common prefixes
 * Map abbreviated difficulty levels to full words
 */
export function camelToKebab(str: string): string {
  return (
    str
      .replace(/^DA_Preset_/i, '') // Strip DA_Preset_ prefix
      .replace(/\.[0-9]+$/, '') // Strip version suffixes like .0
      .replace(/_/g, '-') // Replace underscores with hyphens FIRST so \b works later
      .replace(/([a-z])([A-Z])/g, '$1-$2') // Add hyphens before capitals
      .toLowerCase()
      // Map abbreviated difficulty levels to full words
      .replace(/\badv\b/g, 'advanced')
      .replace(/\bbegin\b/g, 'beginner')
      .replace(/\binterm\b/g, 'intermediate')
      .replace(/\bpro\b/g, 'pro')
      .replace(/^(bot|devbot)-/i, '') // Strip bot/devbot prefix at start
      .replace(/-(bot|devbot)-/gi, '-') // Strip bot/devbot prefix in middle
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Remove consecutive hyphens
      .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
  );
}
