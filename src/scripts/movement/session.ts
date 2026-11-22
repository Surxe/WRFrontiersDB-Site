/**
 * A drivable movement session: the tuned character movement for one
 * chassis on a collision world. Plain data in (parsed data tables, input
 * state, frame time), plain data out (positions, velocity, mode, timings),
 * so the map viewer's adapter only draws.
 *
 * Timestep: like the game (findings step 3), one movement update per frame
 * with that frame's time, which the engine splits into substeps of at most
 * MaxSimulationTimeStep. A fixed step (with interpolation) is available for
 * experiments.
 */
import { lerp, type Vec3 } from './math/vec';
import { parseChassis } from './data/chassis';
import { parseChassisLevel, type ChassisLevel } from './data/chassis_level';
import { parseMovementType, type MovementType } from './data/movement_type';
import type { Capsule, CollisionWorld, QueryStats } from './collision/world';
import type { StockParams } from './engine/stock_params';
import { inputVector, type InputState } from './input/input_state';
import { FixedStep } from './sim/fixed_step';
import {
  blendForMobility,
  MovementProperties,
} from './rules/movement_properties';
import {
  TunedCharacterMovement,
  UNAPPLIED,
  type TuningInput,
} from './rules/tuned_movement';
import type { UnappliedField, ValueProvenance } from './placeholders';

/** Frame time spent at most in one update (a hidden tab, a stall), s. Ours,
 * not the game's: it only keeps a long pause from launching the robot. */
const MAX_FRAME_SECONDS = 0.25;

export interface SessionOptions {
  collision: CollisionWorld;
  /** Parsed `Objects/MovementType.json`. */
  movementTypes: Readonly<Record<string, unknown>>;
  /** Parsed `Objects/CharacterModule.json`. */
  characterModules: Readonly<Record<string, unknown>>;
  /** Parsed `Objects/Module.json`. */
  modules: Readonly<Record<string, unknown>>;
  chassisId: string;
  /** The chassis module's upgrade level; null for its highest. */
  level: number | null;
  /** Use this one tier instead of the game's Mobility blend (experiments). */
  tierOverride: number | null;
  capsule: Capsule;
  /** Fixed step length, s; null steps once per frame, as the game does. */
  stepSeconds: number | null;
  /** Where the capsule's center starts, UE cm. */
  spawn: Vec3;
  /** Engine parameters that differ from UE's defaults. */
  params: Partial<StockParams>;
  /** Labelled values the caller chose (overrides, placeholders). */
  values: readonly ValueProvenance[];
}

export interface FrameStats {
  steps: number;
  alpha: number;
  /** Time spent simulating this frame, ms (queries included). */
  simMs: number;
  queries: QueryStats;
}

export class MovementSession {
  readonly movement: TunedCharacterMovement;
  readonly chassisId: string;
  readonly movementType: MovementType;
  readonly chassisLevel: ChassisLevel;
  private tierOverride: number | null;
  private readonly loop: FixedStep | null;
  private previous: Vec3;

  constructor(private readonly options: SessionOptions) {
    const chassis = parseChassis(options.characterModules, options.chassisId);
    this.chassisId = chassis.id;
    this.movementType = parseMovementType(
      options.movementTypes,
      chassis.movementTypeId
    );
    this.chassisLevel = parseChassisLevel(
      options.modules,
      options.chassisId,
      options.level
    );
    this.tierOverride = options.tierOverride;
    this.movement = new TunedCharacterMovement(
      options.collision,
      options.capsule,
      options.spawn,
      this.tuning(),
      options.params
    );
    this.movement.teleport(options.spawn);
    this.loop =
      options.stepSeconds === null ? null : new FixedStep(options.stepSeconds);
    this.previous = this.movement.location;
    options.collision.takeStats();
  }

  private tuning(): TuningInput {
    const type = this.movementType;
    const level = this.chassisLevel;
    const override = this.tierOverride;
    if (override !== null && (override < 0 || override >= type.tiers.length)) {
      throw new Error(`${type.id} has no tier ${override}`);
    }
    const blend =
      override === null
        ? blendForMobility(type, level.mobility)
        : { lower: override, upper: override, alpha: 0 };
    const properties = new MovementProperties(type, blend, level.maxSpeed);
    const tierSource: ValueProvenance =
      override === null
        ? {
            name: 'Tiers',
            value: properties.describe(),
            source: 'finding',
            note: `Mobility ${level.mobility} at level ${level.level} of ${level.maxLevel} (${level.moduleId}), blended (step 2)`,
          }
        : {
            name: 'Tiers',
            value: properties.describe(),
            source: 'placeholder',
            note: `override; the game blends by Mobility (${level.mobility} at level ${level.level}); key 0 returns to it`,
          };
    return { properties, tierSource };
  }

  /** Use one tier (null: back to the game's Mobility blend). */
  setTierOverride(index: number | null): void {
    if (
      index !== null &&
      (index < 0 || index >= this.movementType.tiers.length)
    )
      return;
    this.tierOverride = index;
    this.movement.setTuning(this.tuning());
  }

  /** Simulate `frameSeconds` with this frame's input. */
  update(frameSeconds: number, input: InputState): FrameStats {
    const began = performance.now();
    const direction = inputVector(input);
    const seconds = Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
    let steps = 0;
    let alpha = 1;
    if (this.loop) {
      ({ steps, alpha } = this.loop.advance(seconds, (step) => {
        this.previous = this.movement.location;
        this.movement.performMovement(step, direction);
      }));
    } else if (seconds > 0) {
      this.previous = this.movement.location;
      this.movement.performMovement(seconds, direction);
      steps = 1;
    }
    return {
      steps,
      alpha,
      simMs: performance.now() - began,
      queries: this.options.collision.takeStats(),
    };
  }

  /** The capsule's center to draw (between the last two fixed steps). */
  renderLocation(alpha: number): Vec3 {
    return lerp(this.previous, this.movement.location, alpha);
  }

  respawn(): void {
    this.movement.teleport(this.options.spawn);
    this.previous = this.options.spawn;
    this.loop?.reset();
  }

  /** "per frame" or the fixed step's length. */
  describeTimestep(): string {
    return this.loop
      ? `fixed ${(this.loop.stepSeconds * 1000).toFixed(1)} ms`
      : 'per frame';
  }

  values(): ValueProvenance[] {
    return [...this.movement.provenance(), ...this.options.values];
  }

  unapplied(): readonly UnappliedField[] {
    return UNAPPLIED;
  }
}
