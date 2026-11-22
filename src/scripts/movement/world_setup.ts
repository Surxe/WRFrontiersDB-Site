/**
 * The engine parameters the exported data sets (D3): the pawn Blueprint's
 * CharacterMovementComponent defaults (`Character.json`) and the map's
 * world physics (`Map.json` `physics`), with where each comes from for the
 * details list. Values WRF's rules layer overrides through its getters
 * (MaxWalkSpeed, MaxAcceleration) are not applied here.
 */
import type { CharacterMovementDefaults } from './data/character';
import type { MapPhysics } from './data/map_physics';
import { DEFAULT_KILL_Z } from './engine/constants';
import type { StockParams } from './engine/stock_params';
import type { ValueProvenance } from './placeholders';

export interface WorldSetup {
  params: Partial<StockParams>;
  /** AWorldSettings::KillZ, cm: below it the pawn falls out of the world. */
  killZ: number;
  values: ValueProvenance[];
}

/** The engine side of a drive: pawn defaults plus the map's physics. */
export function worldSetup(
  pawn: CharacterMovementDefaults,
  physics: MapPhysics,
  mapId: string
): WorldSetup {
  const bp = `Character.json ${pawn.id}.movement_component`;
  const data = (
    name: string,
    value: string,
    note: string = bp
  ): ValueProvenance => ({ name, value, source: 'data', note });
  const killZ = physics.killZ ?? DEFAULT_KILL_Z;
  return {
    params: {
      gravityZ: physics.gravityZ,
      gravityScale: pawn.GravityScale,
      terminalVelocity: physics.terminalVelocity,
      maxStepHeight: pawn.MaxStepHeight,
      walkableFloorZ: pawn.WalkableFloorZ,
      brakingFrictionFactor: pawn.BrakingFrictionFactor,
      airControl: pawn.AirControl,
      airControlBoostMultiplier: pawn.AirControlBoostMultiplier,
      perchRadiusThreshold: pawn.PerchRadiusThreshold,
      perchAdditionalHeight: pawn.PerchAdditionalHeight,
      maintainHorizontalGroundVelocity: pawn.bMaintainHorizontalGroundVelocity,
      rotationRateYaw: pawn.RotationRateYaw,
      orientRotationToMovement: pawn.bOrientRotationToMovement,
    },
    killZ,
    values: [
      data(
        'World gravity',
        `${physics.gravityZ} cm/s2`,
        `Map.json ${mapId}.physics.GravityZ (the game's PhysicsSettings.DefaultGravityZ)`
      ),
      {
        name: 'GravityScale',
        value: `${pawn.GravityScale} (effective ${Math.round(physics.gravityZ * pawn.GravityScale)} cm/s2)`,
        source: 'assumed',
        note: `${bp}; known gap: whether it still applies before the first jump and after the jetpack writes 0 / 1.0 is unmeasured (firing range G1, G2)`,
      },
      data(
        'TerminalVelocity',
        `${physics.terminalVelocity} cm/s`,
        `Map.json ${mapId}.physics.TerminalVelocity`
      ),
      data(
        'KillZ',
        `${killZ} cm`,
        physics.killZ === null
          ? `none in Map.json ${mapId}.physics: the engine default (-UE_OLD_HALF_WORLD_MAX1)`
          : `Map.json ${mapId}.physics.KillZ`
      ),
      data('MaxStepHeight', `${pawn.MaxStepHeight} cm`),
      data('WalkableFloorZ', `${pawn.WalkableFloorZ}`),
      data(
        'PerchRadiusThreshold',
        `${pawn.PerchRadiusThreshold} cm (PerchAdditionalHeight ${pawn.PerchAdditionalHeight})`
      ),
      data(
        'bMaintainHorizontalGroundVelocity',
        String(pawn.bMaintainHorizontalGroundVelocity)
      ),
      data('BrakingFrictionFactor', `${pawn.BrakingFrictionFactor}`),
      data(
        'RotationRate.Yaw',
        `${pawn.RotationRateYaw} deg/s (bOrientRotationToMovement ${pawn.bOrientRotationToMovement})`
      ),
      data(
        'AirControl',
        `${pawn.AirControl} (boost ${pawn.AirControlBoostMultiplier})`,
        `${bp}; replaced by the chassis's Jump Jet entry when it overrides air control (findings step 5)`
      ),
    ],
  };
}
