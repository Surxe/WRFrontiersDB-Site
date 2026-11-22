/**
 * The prototype's rules layer: stock UE character movement, with the
 * getters War Robots overrides to read its tuning (from the
 * reverse-engineering findings, steps 2 to 4, build 5886399475557598571).
 * WRF's rewrites of whole functions (its ground CalcVelocity with sideways
 * friction, steering and forced turns; its MoveAlongFloor with the wall-hit
 * slowdown; body rotation) are specified in the findings but are the MVP's
 * work; until then the stock functions run, and what stands in for them is
 * labelled in `provenance()`.
 */
import { size, size2D, type Vec3 } from '../math/vec';
import type { Capsule, CollisionWorld } from '../collision/world';
import { CharacterMovementComponent } from '../engine/character_movement';
import type { StockParams } from '../engine/stock_params';
import type { UnappliedField, ValueProvenance } from '../placeholders';
import { MovementProperties } from './movement_properties';

/**
 * Every robot's movement capsule: a constant in the game's C++
 * (`ASCharacter` constructor `0x1455737e0`, robot setup `0x14559b8d0`;
 * findings step 4). The titan form's 1000 / 1000 is out of scope.
 */
export const ROBOT_CAPSULE: Readonly<Capsule> = {
  radius: 600,
  halfHeight: 700,
};

/** Tier fields and WRF rules the prototype doesn't apply yet. */
export const UNAPPLIED: readonly UnappliedField[] = [
  {
    name: 'FrictionVector, FrictionVelocityCompensationMultiplier',
    why: "WRF's sideways friction model (findings step 3, CalcVelocity step 8); stock steering friction stands in",
  },
  {
    name: 'AccelerationDependenceOnPitch',
    why: 'slope acceleration and top-speed bonus (step 3)',
  },
  {
    name: 'EmergencyDecelerationDependenceOnInputOpposition',
    why: 'emergency deceleration on opposing input (step 3)',
  },
  {
    name: 'MaxSpeedDependenceOnDesiredYaw, MaxAngleToMoveForwards*, MovingForcedTurn*',
    why: 'walking backwards, steering and forced turns (step 3)',
  },
  {
    name: 'YawRateDependenceOnSpeed, MeshRotationStiffnessDamping, Standing*',
    why: 'body rotation (step 3); the capsule has no facing',
  },
  {
    name: 'VelocityMultiplierOnWallAngleHit',
    why: "WRF MoveAlongFloor's wall-hit slowdown (step 4, partly established)",
  },
];

export interface TuningInput {
  properties: MovementProperties;
  /** How the tiers were chosen, labelled. */
  tierSource: ValueProvenance;
}

export class TunedCharacterMovement extends CharacterMovementComponent {
  constructor(
    collision: CollisionWorld,
    capsule: Capsule,
    location: Vec3,
    private tuning: TuningInput,
    params: Partial<StockParams> = {}
  ) {
    super(collision, capsule, location, params);
    this.applyTuning();
  }

  get properties(): MovementProperties {
    return this.tuning.properties;
  }

  setTuning(tuning: TuningInput): void {
    this.tuning = tuning;
    this.applyTuning();
  }

  private applyTuning(): void {
    // On the ground WRF brakes with friction 0 (findings step 3, item 10);
    // in the air the stock FallingLateralFriction, also 0.
    this.params.useSeparateBrakingFriction = true;
    this.params.brakingFriction = 0;
    // Stand-in (assumed): stock CalcVelocity's steering friction in place of
    // WRF's sideways friction, which uses FrictionVector.Y.
    this.params.groundFriction = this.tuning.properties.frictionVector.y;
  }

  /** WRF GetMaxSpeed (`0x145591a80`): the chassis MaxSpeed on the ground
   * (before the slope bonus and desired-yaw factor, not applied), the
   * blended MaxFallingSpeed in the air (findings steps 3 and 4). */
  override getMaxSpeed(): number {
    if (this.movementMode === 'falling') return this.properties.maxFallingSpeed;
    if (this.movementMode === 'walking') return this.properties.maxWalkingSpeed;
    return 0;
  }

  /** WRF max acceleration (`0x145592ff0`): AccelerationDependenceOnSpeed at
   * the current speed on the ground, FallingAcceleration in the air. */
  override getMaxAcceleration(): number {
    if (this.movementMode === 'falling')
      return this.properties.fallingAcceleration;
    return this.properties.accelerationAtSpeed(size(this.velocity));
  }

  /** WRF GetMaxBrakingDeceleration (`0x145591920`). */
  override getMaxBrakingDeceleration(): number {
    if (this.movementMode === 'walking') {
      return this.properties.brakingDecelerationAtSpeed(size(this.velocity));
    }
    if (this.movementMode === 'falling') {
      const p = this.properties;
      return size2D(this.velocity) > p.fallingBrakingVelocityThreshold
        ? p.fallingBrakingDeceleration
        : 0;
    }
    return 0;
  }

  /** Where each value the simulation uses comes from. */
  provenance(): ValueProvenance[] {
    const p = this.properties;
    const s = this.params;
    const speed = size(this.velocity);
    const robotCapsule =
      this.capsule.radius === ROBOT_CAPSULE.radius &&
      this.capsule.halfHeight === ROBOT_CAPSULE.halfHeight;
    return [
      this.tuning.tierSource,
      {
        name: 'Max speed (ground)',
        value: `${p.maxWalkingSpeed.toFixed(1)} cm/s`,
        source: 'finding',
        note: "chassis module's per-level MaxSpeed (step 2)",
      },
      {
        name: 'Max acceleration',
        value: `${Math.round(this.getMaxAcceleration())} cm/s2 now`,
        source: 'finding',
        note: `AccelerationDependenceOnSpeed at ${Math.round(speed)} cm/s, ${p.describe()}; FallingAcceleration in the air`,
      },
      {
        name: 'Braking (ground)',
        value: `${Math.round(p.brakingDecelerationAtSpeed(speed))} cm/s2 now`,
        source: 'finding',
        note: 'BrakingDecelerationDependenceOnSpeed, friction 0 (step 3)',
      },
      {
        name: 'Air speed limit',
        value: `${Math.round(p.maxFallingSpeed)} cm/s`,
        source: 'finding',
        note: 'MaxFallingSpeed (step 4)',
      },
      {
        name: 'Air braking',
        value: `${Math.round(p.fallingBrakingDeceleration)} above ${Math.round(p.fallingBrakingVelocityThreshold)} cm/s`,
        source: 'finding',
        note: 'FallingBrakingDeceleration / Threshold (step 4)',
      },
      {
        name: 'Capsule',
        value: `r ${this.capsule.radius} / half-height ${this.capsule.halfHeight} cm`,
        source: robotCapsule ? 'finding' : 'placeholder',
        note: robotCapsule
          ? 'C++ constant (step 4)'
          : 'URL override; the game uses 600 / 700 (step 4)',
      },
      {
        name: 'Substeps',
        value: `${s.maxSimulationTimeStep} s x ${s.maxSimulationIterations}`,
        source: 'finding',
        note: 'stock limits, online play (step 3; standalone uses 0.2 s x 2)',
      },
      {
        name: 'Steering friction',
        value: s.groundFriction.toFixed(2),
        source: 'assumed',
        note: "FrictionVector.Y through stock CalcVelocity, standing in for WRF's sideways friction",
      },
      // World gravity, GravityScale, TerminalVelocity and the other
      // Blueprint defaults: data, labelled by world_setup.ts.
    ];
  }
}
