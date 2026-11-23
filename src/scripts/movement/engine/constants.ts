/**
 * Engine constants of UE 5.4.4's character movement (not game tuning):
 * values hard-coded in Epic's source, with where each comes from.
 */

const f = Math.fround;

/** CharacterMovementComponent.cpp:88-92: `const float`s (1e-6f, 1.9f,
 * 2.4f, 10.f, 0.15f), so their float values. */
export const MIN_TICK_TIME = f(1e-6);
export const MIN_FLOOR_DIST = f(1.9);
export const MAX_FLOOR_DIST = f(2.4);
export const BRAKE_TO_STOP_VELOCITY = 10;
export const SWEEP_EDGE_REJECT_DISTANCE = f(0.15);

/** CharacterMovementConstants, CharacterMovementComponent.cpp:82-84
 * (floats). */
export const MAX_STEP_SIDE_Z = f(0.08);
export const VERTICAL_SLOPE_NORMAL_Z = f(0.001);

/** MovementComponent.cpp: p.PenetrationPullbackDistance and
 * p.PenetrationOverlapCheckInflation CVar defaults (floats). */
export const PENETRATION_PULLBACK_DISTANCE = 0.125;
export const PENETRATION_OVERLAP_CHECK_INFLATION = f(0.1);

/** AWorldSettings Min/MaxUndilatedFrameTime (Engine/Config/BaseGame.ini:
 * 0.0005 and 0.4 s; WRF's config doesn't override them, 09-editor.md 2.6). */
export const MIN_UNDILATED_FRAME_TIME = 0.0005;
export const MAX_UNDILATED_FRAME_TIME = 0.4;

/** AWorldSettings::KillZ when a map sets none: -UE_OLD_HALF_WORLD_MAX1
 * (WorldSettings.cpp:87; EngineDefines.h: 1048576 - 1). */
export const DEFAULT_KILL_Z = -1048575;
