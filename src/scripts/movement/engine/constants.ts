/**
 * Engine constants of UE 5.4.4's character movement (not game tuning):
 * values hard-coded in Epic's source, with where each comes from.
 */

/** CharacterMovementComponent.cpp:88-92. */
export const MIN_TICK_TIME = 1e-6;
export const MIN_FLOOR_DIST = 1.9;
export const MAX_FLOOR_DIST = 2.4;
export const BRAKE_TO_STOP_VELOCITY = 10;
export const SWEEP_EDGE_REJECT_DISTANCE = 0.15;

/** CharacterMovementConstants, CharacterMovementComponent.cpp:82-84. */
export const MAX_STEP_SIDE_Z = 0.08;
export const VERTICAL_SLOPE_NORMAL_Z = 0.001;

/** MovementComponent.cpp: p.PenetrationPullbackDistance and
 * p.PenetrationOverlapCheckInflation CVar defaults. */
export const PENETRATION_PULLBACK_DISTANCE = 0.125;
export const PENETRATION_OVERLAP_CHECK_INFLATION = 0.1;

/** AWorldSettings Min/MaxUndilatedFrameTime (Engine/Config/BaseGame.ini:
 * 0.0005 and 0.4 s; WRF's config doesn't override them, 09-editor.md 2.6). */
export const MIN_UNDILATED_FRAME_TIME = 0.0005;
export const MAX_UNDILATED_FRAME_TIME = 0.4;

/** AWorldSettings::KillZ when a map sets none: -UE_OLD_HALF_WORLD_MAX1
 * (WorldSettings.cpp:87; EngineDefines.h: 1048576 - 1). */
export const DEFAULT_KILL_Z = -1048575;
