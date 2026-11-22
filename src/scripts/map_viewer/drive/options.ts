/**
 * Drive mode's settings, read from the /maps URL (drive mode is a
 * prototype, reached only by query param):
 *
 *   drive     1 turns it on.
 *   level     the chassis module's upgrade level. Default: its highest
 *             (Ethan's decision; 13 for Loki's legs).
 *   tier      use this one speed tier instead of the game's blend by
 *             Mobility (an experiment; keys 1-6 and 0 do the same live).
 *   hz        a fixed simulation rate instead of one update per frame (the
 *             game's way); an experiment.
 *   capsule   radius,halfHeight in cm instead of the game's 600,700.
 *   lighting  the lighting variant part whose collision to load (e.g.
 *             CrashSite_Sunset_Light). The game picks one per match; the
 *             default is the heaviest weight.
 *
 * Without the last three, every value is the game's as far as the
 * reverse-engineering findings establish it. The chassis is the
 * prototype's, Loki's legs.
 */
import type { Capsule } from '../../movement/collision/world';
import type { StockParams } from '../../movement/engine/stock_params';
import { UE_DEFAULTS } from '../../movement/engine/stock_params';
import type { ValueProvenance } from '../../movement/placeholders';
import { ROBOT_CAPSULE } from '../../movement/rules/tuned_movement';

export const PROTOTYPE_CHASSIS = 'BP_Module_Loki_Chassis.0';

/**
 * `BP_Character`'s movement-component defaults (findings step 1, from a
 * 2026-09-28 export). They are Blueprint data, so under D3 they must come
 * from the exported data; the Parser doesn't export them yet. Until it does
 * they are labelled placeholders, kept here in the prototype's adapter and
 * out of the simulation code.
 */
const BP_CHARACTER_GRAVITY_SCALE = 1.2;
const BP_CHARACTER: Partial<StockParams> = {
  gravityZ: UE_DEFAULTS.gravityZ * BP_CHARACTER_GRAVITY_SCALE,
  maxStepHeight: 500,
  walkableFloorZ: 0.71,
  brakingFrictionFactor: 0.05,
  airControl: 0,
  airControlBoostMultiplier: 0,
  perchRadiusThreshold: 400,
  perchAdditionalHeight: 0,
  maintainHorizontalGroundVelocity: false,
};

export interface DriveOptions {
  level: number | null;
  tierOverride: number | null;
  /** Fixed rate, Hz; null for one update per frame. */
  hz: number | null;
  capsule: Capsule;
  params: Partial<StockParams>;
  /** Lighting variant part id; null for the heaviest weight. */
  lighting: string | null;
}

export function isDriveRequested(params: URLSearchParams): boolean {
  return params.get('drive') === '1';
}

function positiveNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function wholeNumber(raw: string | null): number | null {
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
}

export function readDriveOptions(params: URLSearchParams): DriveOptions {
  const [radius, halfHeight] = (params.get('capsule') ?? '')
    .split(',')
    .map(positiveNumber);
  const capsule =
    radius && halfHeight && halfHeight >= radius
      ? { radius, halfHeight }
      : { ...ROBOT_CAPSULE };
  const level = wholeNumber(params.get('level'));
  return {
    level: level !== null && level > 0 ? level : null,
    tierOverride: wholeNumber(params.get('tier')),
    hz: positiveNumber(params.get('hz')),
    capsule,
    params: { ...BP_CHARACTER },
    lighting: params.get('lighting') || null,
  };
}

/** The labelled values these options bring (the rest the session labels). */
export function optionValues(options: DriveOptions): ValueProvenance[] {
  const bp = (name: string, value: string): ValueProvenance => ({
    name,
    value,
    source: 'placeholder',
    note: 'BP_Character default (findings step 1, 2026-09-28 export); must come from exported data (D3)',
  });
  return [
    {
      name: 'Timestep',
      value:
        options.hz === null ? 'one update per frame' : `fixed ${options.hz} Hz`,
      source: options.hz === null ? 'finding' : 'placeholder',
      note:
        options.hz === null
          ? 'stock variable timestep (step 3)'
          : 'URL hz= experiment; the game updates once per frame',
    },
    bp('GravityScale', String(BP_CHARACTER_GRAVITY_SCALE)),
    bp('MaxStepHeight', `${BP_CHARACTER.maxStepHeight} cm`),
    bp('WalkableFloorZ', `${BP_CHARACTER.walkableFloorZ}`),
    bp(
      'PerchRadiusThreshold',
      `${BP_CHARACTER.perchRadiusThreshold} cm (PerchAdditionalHeight ${BP_CHARACTER.perchAdditionalHeight})`
    ),
    bp(
      'bMaintainHorizontalGroundVelocity',
      String(BP_CHARACTER.maintainHorizontalGroundVelocity)
    ),
    bp(
      'AirControl',
      `${BP_CHARACTER.airControl} (boost ${BP_CHARACTER.airControlBoostMultiplier})`
    ),
  ];
}
