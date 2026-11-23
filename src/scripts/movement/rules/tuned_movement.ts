/**
 * WRF's rules layer (D4): `USCharacterMovementComponent`'s overrides of
 * stock character movement, from the reverse-engineering findings steps 1
 * to 5 (build 5886399475557598571), as method overrides of the engine port.
 *
 * - getters (steps 2 to 4): GetMaxSpeed with the desired-yaw factor and the
 *   slope bonus, GetMaxAcceleration, GetMaxBrakingDeceleration;
 * - CalcVelocity on the ground (step 3, ground_velocity.ts);
 * - body rotation: PhysicsRotation with WRF's GetDeltaRotation and
 *   ComputeOrientToMovementRotation (step 3, rotation.ts);
 * - MoveAlongFloor with the wall-hit slowdown and the snap to face the
 *   slide (step 4, move_along_floor.ts);
 * - ComputeSlideVector (step 4), ConstrainInputAcceleration and the
 *   blockers (steps 1 and 4), the Jump Jet's air control (step 5).
 *
 * The capsule's facing (`yaw`) lives here: the engine port has no rotation.
 * What is not established is in RULES_KNOWN_GAPS (the H list).
 */
import {
  f32,
  isZero,
  safeNormal,
  safeNormal2D,
  scale,
  size,
  size2D,
  sizeSquared2D,
  ZERO,
  type Vec3,
} from '../math/vec';
import type { Capsule, CollisionWorld } from '../collision/world';
import {
  CharacterMovementComponent,
  type MovementMode,
  type StepDownResult,
} from '../engine/character_movement';
import type { HitResult } from '../engine/hit';
import type { StockParams } from '../engine/stock_params';
import type { JetpackAirControl } from '../data/jump_ability';
import type { UnappliedField, ValueProvenance } from '../placeholders';
import { Blockers } from './blockers';
import {
  CAPSULE_ROTATION_SPEED_THRESHOLD,
  calcVelocityGround,
  slopeAngle,
} from './ground_velocity';
import { MovementProperties } from './movement_properties';
import { moveAlongFloor, type WallHit } from './move_along_floor';
import { physicsRotation } from './rotation';
import { rotatorQuaternion } from '../math/rotator_quat';
import { normalizeAxis, yawVector } from './rotator';

/**
 * Every robot's movement capsule: a constant in the game's C++
 * (`ASCharacter` constructor `0x1455737e0`, robot setup `0x14559b8d0`;
 * findings step 4). The titan form's 1000 / 1000 is out of scope.
 */
export const ROBOT_CAPSULE: Readonly<Capsule> = {
  radius: 600,
  halfHeight: 700,
};

/** Tier fields loaded but not driving the simulation. */
export const UNAPPLIED: readonly UnappliedField[] = [
  {
    name: 'MeshRotationStiffnessDamping',
    why: "the visible mesh's spring-damper toward the capsule (`0x145580570`, step 3): no movement effect, and its formula is not in the findings (known gap)",
  },
  {
    name: 'StandingRotationThreshold, StandingVelocityThreshold, StandingRotationAngleDegrees',
    why: 'no native reader (findings step 2); animation only, if anything',
  },
];

/**
 * What the rules layer does not establish (the fidelity rule): shown in the
 * H list and the console, never filled in by estimate.
 */
export const RULES_KNOWN_GAPS: readonly string[] = [
  'Wall-hit slowdown values wait on firing-range W1 (the curve and no server override of Movement.DefaultMoveAlongFloor) and W2 (the snap to face the slide when walking backwards into a wall).',
  "Wall-hit slowdown on vertical walls: UE often takes StepUp's path where the port slides (engine gap, parallel contacts, D23/D25); the slowdown still applies (the foot ends within 1 cm) but its direction follows the port's slide.",
  "Mesh spring-damper (`0x145580570`, MeshRotationStiffnessDamping 8 / 0.85): its formula is not in the findings, so the visible mesh's lag behind the capsule is not modelled (robot posing, session 6).",
  'bForwardDirectionFromInput (+0x17e8): who sets it is unread; taken as false (forwards/backwards from the velocity).',
  "Body rotation target: whether ComputeOrientToMovementRotation re-runs DesiredYaw after the move or keeps CalcVelocity's choice is unread; the port re-runs it.",
  "CalcVelocity's integrate limit is ported as the finding writes it (|V| > MaxInputSpeed); stock uses IsExceedingMaxSpeed's 1 % tolerance there. Not re-read.",
  "GetMaxSpeed's slope bonus is also gated on `FUN_1455956a0` returning false (unread); the port takes it as false.",
  'Stat channels (MaxSpeed, MaxAcceleration, RotationRateYaw, Friction) pass values through unchanged: no buffs in the MVP (findings step 2).',
  "Spawn facing: the capsule starts at yaw 0 (the spawn pin's rotation is session 6's).",
  "Capsule rotation is kept as a yaw in doubles; UE stores the component's quaternion (rotator round trip, SCENECOMPONENT_QUAT_TOLERANCE): differences below 1e-6 degrees.",
];

export interface TuningInput {
  properties: MovementProperties;
  /** How the tiers were chosen, labelled. */
  tierSource: ValueProvenance;
  /** The chassis's Jump Jet air control (null: none loaded). */
  airControl: JetpackAirControl | null;
}

export class TunedCharacterMovement extends CharacterMovementComponent {
  /** Capsule yaw, degrees in (-180, 180]. */
  yaw = 0;
  /** In a forced turn (+0x18c8), toward `forcedTurnDir` (+0x18d0). */
  forcedTurn = false;
  forcedTurnDir: Vec3 = ZERO;
  forcedTurnRotationRatio = 0;
  /** MaxSpeedDependenceOnDesiredYaw factor (+0xf88). */
  speedFactor = 1;
  /** The friction step's flag (+0x1d21, constructor 1). */
  frictionEnabled = true;
  /** LastUpdateVelocity: the velocity at the end of the last update. */
  lastUpdateVelocity: Vec3 = ZERO;
  /** The input ConsumeInputVector kept (+0x11f0). */
  consumedInput: Vec3 = ZERO;
  /** The last move's saved hit (+0x1d28). */
  lastMoveHit: HitResult | null = null;
  /** The last wall-hit slowdown (debug readout and tests). */
  lastWallHit: WallHit | null = null;
  readonly airControlBlockers = new Blockers();
  readonly walkingModeBlockers = new Blockers();
  readonly movementInputBlockers = new Blockers();
  /** OnCharacterMovementUpdated, which PerformMovement broadcasts at its
   * end: WRF binds `ASCharacter::CharacterMovementUpdated` to it (fuel
   * regeneration, ability ticks; robot_character.ts). */
  onMovementUpdated: ((deltaSeconds: number) => void) | null = null;

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

  /** RotationRate.Yaw through RotationRateYawChannel (no buffs). */
  get rotationRateYaw(): number {
    return this.params.rotationRateYaw;
  }

  setTuning(tuning: TuningInput): void {
    this.tuning = tuning;
    this.applyTuning();
  }

  private applyTuning(): void {
    // In the air braking uses the stock FallingLateralFriction (0); on the
    // ground WRF's CalcVelocity brakes with friction 0 (step 3, item 10).
    this.params.useSeparateBrakingFriction = true;
    this.params.brakingFriction = 0;
    const air = this.tuning.airControl;
    if (air?.overrideAirControl) {
      // The Jump Jet's setup writes them into the CMC once (step 5).
      this.params.airControl = f32(air.airControl);
      this.params.airControlBoostMultiplier = f32(
        air.airControlBoostMultiplier
      );
      this.params.airControlBoostVelocityThreshold = f32(
        air.airControlBoostVelocityThreshold
      );
    }
  }

  // ---- Facing ----

  forwardVector(): Vec3 {
    return yawVector(this.yaw);
  }

  /** Set the capsule's rotation (MoveUpdatedComponent with a zero delta
   * and no sweep: rotation only, 09-editor.md 2.2). */
  setYaw(yaw: number): void {
    this.yaw = normalizeAxis(yaw);
    // The component quaternion every move sweeps with (D27): the rotator
    // UE hands MoveUpdatedComponent, converted by FRotator::Quaternion.
    this.setComponentRotation(rotatorQuaternion(0, yaw, 0));
  }

  startForcedTurn(dir: Vec3): void {
    this.forcedTurn = true;
    this.forcedTurnDir = dir;
  }

  endForcedTurn(): void {
    this.forcedTurn = false;
    this.forcedTurnRotationRatio = 0;
  }

  // ---- The update ----

  /**
   * ConsumeInputVector (WRF `0x145589150`: keeps the previous input while
   * MovementInputBlockers holds on the ground), the stock update, then
   * PhysicsRotation with the frame's time and LastUpdateVelocity, then
   * OnCharacterMovementUpdated.
   */
  override performMovement(deltaSeconds: number, inputVector: Vec3): void {
    if (!(this.movementInputBlockers.active && this.isMovingOnGround()))
      this.consumedInput = inputVector;
    super.performMovement(deltaSeconds, this.consumedInput);
    if (this.params.orientRotationToMovement)
      physicsRotation(this, f32(deltaSeconds));
    this.lastUpdateVelocity = this.velocity;
    this.onMovementUpdated?.(f32(deltaSeconds));
  }

  override teleport(location: Vec3): void {
    super.teleport(location);
    this.endForcedTurn();
    this.lastMoveHit = null;
    this.lastWallHit = null;
    this.lastUpdateVelocity = ZERO;
  }

  /** WRF SetMovementMode (`0x1455a2d00`: no walking while
   * WalkingModeBlockers holds) and OnMovementModeChanged (`0x14559acb0`:
   * clears the forced turn). */
  override setMovementMode(mode: MovementMode): void {
    if (mode === 'walking' && this.walkingModeBlockers.active) return;
    if (mode !== this.movementMode) this.endForcedTurn();
    super.setMovementMode(mode);
  }

  // ---- Getters (steps 2 to 4) ----

  /** WRF GetMaxSpeed (`0x145591a80`): the chassis MaxSpeed on the ground
   * plus the downhill bonus, MaxFallingSpeed in the air, times the
   * desired-yaw factor (+0xf88). */
  override getMaxSpeed(): number {
    const p = this.properties;
    let base: number;
    if (this.movementMode === 'walking') {
      base = f32(p.maxWalkingSpeed);
      const n = this.currentFloor.hitResult.impactNormal.z;
      if (
        this.currentFloor.isWalkableFloor() &&
        n > 1e-4 &&
        n < 0.9999 &&
        size2D(this.velocity) > 1e-4
      ) {
        base = f32(
          base + Math.max(0, f32(p.accelerationAtPitch(-slopeAngle(this))))
        );
      }
    } else if (this.movementMode === 'falling') {
      base = f32(p.maxFallingSpeed);
    } else {
      return 0;
    }
    return f32(base * this.speedFactor);
  }

  /** WRF max acceleration (`0x145592ff0`): AccelerationDependenceOnSpeed
   * at the current speed on the ground, FallingAcceleration in the air. */
  override getMaxAcceleration(): number {
    if (this.movementMode === 'falling')
      return f32(this.properties.fallingAcceleration);
    if (this.movementMode === 'walking')
      return f32(this.properties.accelerationAtSpeed(size(this.velocity)));
    return this.params.maxAcceleration;
  }

  /** WRF GetMaxBrakingDeceleration (`0x145591920`). */
  override getMaxBrakingDeceleration(): number {
    const p = this.properties;
    if (this.movementMode === 'walking') {
      return f32(p.brakingDecelerationAtSpeed(size(this.velocity)));
    }
    if (this.movementMode === 'falling') {
      return size2D(this.velocity) > p.fallingBrakingVelocityThreshold &&
        !this.airControlBlockers.active
        ? f32(p.fallingBrakingDeceleration)
        : 0;
    }
    return 0;
  }

  // ---- Input ----

  /** WRF ConstrainInputAcceleration (`0x145589020`): falling makes the
   * input horizontal but keeps its length. */
  override constrainInputAcceleration(input: Vec3): Vec3 {
    if (this.isFalling()) return scale(safeNormal2D(input), size(input));
    return super.constrainInputAcceleration(input);
  }

  // ---- Velocity ----

  /** WRF CalcVelocity (`0x145582780`): the rewrite on the ground, stock
   * elsewhere. */
  override calcVelocity(
    deltaTime: number,
    friction: number,
    fluid: boolean,
    brakingDeceleration: number
  ): void {
    if (this.isMovingOnGround()) {
      calcVelocityGround(this, deltaTime, brakingDeceleration);
      return;
    }
    super.calcVelocity(deltaTime, friction, fluid, brakingDeceleration);
  }

  /** Stock GetFallingLateralAcceleration with WRF GetAirControl
   * (`0x14558f570`: zero while AirControlBlockers holds). */
  override getFallingLateralAcceleration(deltaTime: number): Vec3 {
    if (this.airControlBlockers.active && sizeSquared2D(this.acceleration) > 0)
      return ZERO;
    return super.getFallingLateralAcceleration(deltaTime);
  }

  /** WRF IsValidLandingSpot (`0x145595ba0`). */
  override isValidLandingSpot(capsuleLocation: Vec3, hit: HitResult): boolean {
    if (this.walkingModeBlockers.active) return false;
    return super.isValidLandingSpot(capsuleLocation, hit);
  }

  // ---- Walking ----

  override moveAlongFloor(
    inVelocity: Vec3,
    deltaSeconds: number,
    outStepDown: StepDownResult | null
  ): void {
    moveAlongFloor(this, inVelocity, deltaSeconds, outStepDown);
  }

  /** WRF MoveUpdatedComponentImpl (`0x145598800`): while falling, the
   * move's hit is saved (+0x1d28). */
  override moveUpdatedComponent(
    delta: Vec3,
    sweep: boolean,
    outHit: HitResult | null = null,
    neverIgnoreBlockingOverlaps = false
  ): boolean {
    const moved = super.moveUpdatedComponent(
      delta,
      sweep,
      outHit,
      neverIgnoreBlockingOverlaps
    );
    if (outHit && this.isFalling()) this.lastMoveHit = outHit.clone();
    return moved;
  }

  /**
   * WRF ComputeSlideVector (`0x145588e10`, findings steps 1 and 4): falling,
   * the plain projection onto the hit plane (no slope-boost guard); other
   * modes, the stock direction at the move's full length |D| x t.
   */
  override computeSlideVector(
    delta: Vec3,
    time: number,
    normal: Vec3,
    hit: HitResult
  ): Vec3 {
    if (this.isFalling()) {
      const d = delta;
      const dn = d.x * normal.x + d.y * normal.y + d.z * normal.z;
      return scale(
        {
          x: d.x - normal.x * dn,
          y: d.y - normal.y * dn,
          z: d.z - normal.z * dn,
        },
        time
      );
    }
    const stock = super.computeSlideVector(delta, time, normal, hit);
    if (isZero(stock)) return stock;
    return scale(safeNormal(stock), size(delta) * time);
  }

  // ---- Details list ----

  /** Where each value the simulation uses comes from. */
  provenance(): ValueProvenance[] {
    const p = this.properties;
    const s = this.params;
    const speed = size(this.velocity);
    const robotCapsule =
      this.capsule.radius === ROBOT_CAPSULE.radius &&
      this.capsule.halfHeight === ROBOT_CAPSULE.halfHeight;
    const air = this.tuning.airControl;
    const wallKey = p.wallHitCurveKey();
    const wall = this.lastWallHit;
    return [
      this.tuning.tierSource,
      {
        name: 'Max speed (ground)',
        value: `${p.maxWalkingSpeed.toFixed(1)} cm/s, now ${Math.round(this.isMovingOnGround() ? this.getMaxSpeed() : p.maxWalkingSpeed)}`,
        source: 'finding',
        note: "chassis module's per-level MaxSpeed (step 2), + downhill AccelerationDependenceOnPitch bonus, x MaxSpeedDependenceOnDesiredYaw (step 3)",
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
        name: 'Ground velocity',
        value: `forwards within ${p.maxAngleToMoveForwards} deg; steering limit ${s.rotationRateYaw} deg/s above ${CAPSULE_ROTATION_SPEED_THRESHOLD} cm/s`,
        source: 'finding',
        note: 'WRF CalcVelocity (step 3): DesiredYaw, steering, forced turns, emergency deceleration, slope acceleration, braking',
      },
      {
        name: 'Sideways friction',
        value: `FrictionVector (${p.frictionVector.x.toFixed(2)}, ${p.frictionVector.y.toFixed(2)}), compensation ${p.frictionVelocityCompensationMultiplier.toFixed(3)}`,
        source: 'finding',
        note: 'per-world-axis weighting |g_i| g_i (step 3, item 8)',
      },
      {
        name: 'Forced turn',
        value: `above ${Math.round(p.forcedTurnSpeedThreshold)} cm/s backwards, at ${p.movingForcedTurnRate} deg/s${this.forcedTurn ? ' (turning now)' : ''}`,
        source: 'finding',
        note: 'min(MaxSpeed x MovingForcedTurnVelocityMaxSpeedRatio, MovingForcedTurnVelocityThreshold); MovingForcedTurnRate (C++ default 360 unless exported)',
      },
      {
        name: 'Body rotation',
        value: `yaw ${this.yaw.toFixed(1)}, ${s.rotationRateYaw} deg/s x YawRateDependenceOnSpeed (${p.yawRateScaleAtSpeed(speed).toFixed(3)} now)`,
        source: 'finding',
        note: 'PhysicsRotation toward the steered acceleration, away from it when walking backwards; the velocity in the air (step 3)',
      },
      {
        name: 'Wall-hit slowdown',
        value:
          `curve ${wallKey ?? 'none'}` +
          (wall
            ? `; last: ${wall.angle.toFixed(1)} deg x ${wall.multiplier.toFixed(3)}, ${Math.round(wall.speedBefore)} to ${Math.round(wall.speedAfter)} cm/s`
            : ''),
        source: 'finding',
        note: 'VelocityMultiplierOnWallAngleHit keyed nearest the chassis MaxSpeed (step 4); firing-range W1 and W2 confirm it',
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
      air?.overrideAirControl
        ? {
            name: 'Air control',
            value: `${s.airControl}, x ${s.airControlBoostMultiplier} below ${s.airControlBoostVelocityThreshold} cm/s`,
            source: 'data',
            note: `Ability.json ${air.id} (the Jump Jet's override, written into the CMC for all falling; step 5)`,
          }
        : {
            name: 'Air control',
            value: `${s.airControl}`,
            source: air ? 'data' : 'placeholder',
            note: air
              ? `${air.id} does not override air control: BP_Character's value`
              : "the chassis's Jump Jet entry was not loaded",
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
      // World gravity, GravityScale, TerminalVelocity and the other
      // Blueprint defaults: data, labelled by world_setup.ts.
    ];
  }
}
