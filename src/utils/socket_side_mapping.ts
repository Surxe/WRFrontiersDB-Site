/**
 * Socket to Side Mapping Utility
 *
 * Maps weapon socket names to their corresponding side (Left/Right) for display purposes.
 * Used when Titans have different weapons on different shoulders.
 */

// Socket side constants
export const SOCKET_SIDE_MAPPING: Record<string, string> = {
  'Shoulder_L': 'Socket_Left',
  'Shoulder_R': 'Socket_Right',
};

/**
 * Get the locale key for a socket's side
 * @param parentSocketName - The parent socket name from CharacterPreset.json
 * @returns The locale key for the side or undefined if not found
 */
export function getSocketSideLocaleKey(parentSocketName: string): string | undefined {
  return SOCKET_SIDE_MAPPING[parentSocketName];
}
