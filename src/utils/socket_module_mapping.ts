/**
 * Socket to Module Group Mapping Utility
 *
 * Maps weapon socket names from CharacterPreset.json to module groups.
 * Only weapon sockets (Shoulder_Weapon or Torso_Weapon) are mapped.
 */

// Weapon socket constants
export const WEAPON_SOCKET_PREFIXES = {
  SHOULDER_WEAPON: 'Shoulder_Weapon',
  TORSO_WEAPON: 'Torso_Weapon',
} as const;

// Socket to module group mapping (only for weapon sockets)
export const WEAPON_SOCKET_TO_MODULE_GROUP: Record<string, string> = {
  // Shoulder weapons map to Shoulder group
  [WEAPON_SOCKET_PREFIXES.SHOULDER_WEAPON]: 'non-titan-shoulder',
  // Torso weapons map to Torso group
  [WEAPON_SOCKET_PREFIXES.TORSO_WEAPON]: 'non-titan-torsos',
};

/**
 * Check if a socket name is a weapon socket
 * @param socketName - The socket name from CharacterPreset.json
 * @returns True if it's a weapon socket
 */
export function isWeaponSocket(socketName: string): boolean {
  return (
    socketName.startsWith(WEAPON_SOCKET_PREFIXES.SHOULDER_WEAPON) ||
    socketName.startsWith(WEAPON_SOCKET_PREFIXES.TORSO_WEAPON)
  );
}

/**
 * Get the module group ID for a given weapon socket name
 * @param socketName - The weapon socket name from CharacterPreset.json
 * @returns The module group ID or undefined if not found
 */
export function getModuleGroupForWeaponSocket(
  socketName: string
): string | undefined {
  if (!isWeaponSocket(socketName)) {
    return undefined;
  }

  // Find the matching prefix and return its module group
  for (const [prefix, groupId] of Object.entries(
    WEAPON_SOCKET_TO_MODULE_GROUP
  )) {
    if (socketName.startsWith(prefix)) {
      return groupId;
    }
  }

  return undefined;
}
