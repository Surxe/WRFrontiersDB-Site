/**
 * `Objects/Map.json` `<Map>.physics`: the world's movement physics as the
 * Parser exports it (Parser PR #138):
 * - `GravityZ`: the world gravity, the game's `DefaultEngine.ini`
 *   `PhysicsSettings.DefaultGravityZ` unless the map's world settings
 *   override it (none do today: -1400 everywhere);
 * - `TerminalVelocity`: `PhysicsSettings.DefaultTerminalVelocity` (40000);
 *   the maps' only physics volumes are kill volumes, which keep it;
 * - `KillZ`: the world settings' kill height, only on maps that set one.
 *
 * GravityZ and TerminalVelocity are required (fail loudly); KillZ is null
 * where the map leaves the engine default.
 */

export interface MapPhysics {
  /** cm/s^2, negative is down. */
  gravityZ: number;
  /** cm/s. */
  terminalVelocity: number;
  /** cm; null: the map sets none. */
  killZ: number | null;
}

/** Read one `Map.json` entry's `physics`; `mapId` names it in errors. */
export function parseMapPhysics(raw: unknown, mapId: string): MapPhysics {
  if (!raw || typeof raw !== 'object')
    throw new Error(`Map.json ${mapId}: no physics`);
  const physics = raw as Record<string, unknown>;
  const required = (name: string): number => {
    const value = physics[name];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(
        `Map.json ${mapId}.physics.${name}: missing or not a number`
      );
    return value;
  };
  const killZ = physics.KillZ;
  if (
    killZ !== undefined &&
    (typeof killZ !== 'number' || !Number.isFinite(killZ))
  )
    throw new Error(`Map.json ${mapId}.physics.KillZ: not a number`);
  return {
    gravityZ: required('GravityZ'),
    terminalVelocity: required('TerminalVelocity'),
    killZ: killZ === undefined ? null : killZ,
  };
}
