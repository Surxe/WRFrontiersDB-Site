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
 * reverse-engineering findings and the exported data establish it (the
 * pawn's movement defaults and the map's physics: movement/world_setup.ts). The chassis is the
 * prototype's, Loki's legs.
 */
import type { Capsule } from '../../movement/collision/world';
import type { ValueProvenance } from '../../movement/placeholders';
import { ROBOT_CAPSULE } from '../../movement/rules/tuned_movement';

export const PROTOTYPE_CHASSIS = 'BP_Module_Loki_Chassis.0';

export interface DriveOptions {
  level: number | null;
  tierOverride: number | null;
  /** Fixed rate, Hz; null for one update per frame. */
  hz: number | null;
  capsule: Capsule;
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
    lighting: params.get('lighting') || null,
  };
}

/** The labelled values these options bring (the rest the session and
 * movement/world_setup.ts label). */
export function optionValues(options: DriveOptions): ValueProvenance[] {
  return [
    {
      name: 'Timestep',
      value:
        options.hz === null ? 'one update per frame' : `fixed ${options.hz} Hz`,
      source: options.hz === null ? 'finding' : 'placeholder',
      note:
        options.hz === null
          ? 'stock variable timestep (step 3); the world clamps a frame to 0.4 s, sub-steps split in float (09-editor.md 2.6)'
          : 'URL hz= experiment; the game updates once per frame',
    },
  ];
}
