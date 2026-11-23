/**
 * UCharacterMovementComponent's walking and falling, ported from UE 5.4.4
 * (Engine/Private/Components/CharacterMovementComponent.cpp, tag
 * 5.4.4-release). This class holds the state and the virtual methods; their
 * bodies live in floor.ts, velocity.ts, walking.ts, step_up.ts and
 * falling.ts, which call back through `this` so a subclass (the rules
 * layer) can override any of them the way SCharacterMovementComponent
 * overrides UE's.
 *
 * Left out, and why:
 * - Custom gravity directions (new in 5.4): gravity is always -Z, so every
 *   RotateWorldToGravity / RotateGravityToWorld is the identity.
 * - Networking, root motion, movement bases, avoidance, path following,
 *   crouching, swimming, flying, nav walking, stock jumping (WRF jumps with
 *   forces, the Jump Jet ability in the rules layer), LaunchCharacter.
 * - PhysicsRotation: the prototype draws a capsule, which doesn't turn.
 * - HandleImpact: only notifies and pushes physics objects.
 * - Ledge checks (GetLedgeMove): only used when bCanWalkOffLedges is false.
 */
import {
  add,
  clampedToMaxSize,
  dot,
  f32,
  isZero,
  planeProject,
  safeNormal2D,
  scale,
  SMALL_NUMBER,
  UP,
  withZ,
  ZERO,
  type Vec3,
} from '../math/vec';
import type { Capsule, CollisionWorld } from '../collision/world';
import { MIN_FLOOR_DIST, MIN_TICK_TIME } from './constants';
import { FindFloorResult, HitResult } from './hit';
import { MovementComponent } from './movement_component';
import { UE_DEFAULTS, type StockParams } from './stock_params';
import * as floor from './floor';
import * as velocity from './velocity';
import * as walking from './walking';
import * as stepUp from './step_up';
import * as falling from './falling';

export type MovementMode = 'none' | 'walking' | 'falling';

/** FStepDownResult. */
export interface StepDownResult {
  computedFloor: boolean;
  floorResult: FindFloorResult;
}

export class CharacterMovementComponent extends MovementComponent {
  params: StockParams;
  movementMode: MovementMode = 'none';
  velocity: Vec3 = ZERO;
  /** Current acceleration (input scaled by max acceleration), cm/s^2. */
  acceleration: Vec3 = ZERO;
  analogInputModifier = 0;
  currentFloor = new FindFloorResult();
  justTeleported = true;
  forceNextFloorCheck = true;
  numJumpApexAttempts = 0;
  /** PendingImpulseToApply, cm/s (impulses already divided by Mass). */
  pendingImpulseToApply: Vec3 = ZERO;
  /** PendingForceToApply, cm/s^2 (forces already divided by Mass). */
  pendingForceToApply: Vec3 = ZERO;

  constructor(
    collision: CollisionWorld,
    capsule: Capsule,
    location: Vec3,
    params: Partial<StockParams> = {}
  ) {
    super(collision, capsule, location);
    this.params = floatParams({ ...UE_DEFAULTS, ...params });
  }

  // ---- Simulation entry points ----

  /**
   * One movement update, the parts of ControlledCharacterMove and
   * PerformMovement this port keeps: turn the input vector into an
   * acceleration, then run the current movement mode for `deltaSeconds`.
   * `inputVector` is the requested direction, length up to 1.
   */
  performMovement(deltaSecondsIn: number, inputVector: Vec3): void {
    // UCharacterMovementComponent::TickComponent(float DeltaTime).
    const deltaSeconds = f32(deltaSecondsIn);
    this.acceleration = this.scaleInputAcceleration(
      this.constrainInputAcceleration(inputVector)
    );
    this.analogInputModifier = this.computeAnalogInputModifier();
    // PerformMovement: no movement in MOVE_None, and pending forces are
    // dropped.
    if (this.movementMode === 'none') {
      this.clearAccumulatedForces();
      return;
    }
    // Forces requested since the last update (e.g. at the end of it, in
    // OnCharacterMovementUpdated) land now, with this update's time
    // (09-editor.md 2.3). No root motion or pending launch in this port.
    this.applyAccumulatedForces(deltaSeconds);
    this.clearAccumulatedForces();
    this.numJumpApexAttempts = 0;
    this.startNewPhysics(deltaSeconds, 0);
  }

  // ---- Forces ----

  /** UCharacterMovementComponent::AddForce: applied by the next update's
   * ApplyAccumulatedForces. */
  addForce(force: Vec3): void {
    if (isZero(force) || this.movementMode === 'none') return;
    if (this.params.mass > SMALL_NUMBER)
      this.pendingForceToApply = add(
        this.pendingForceToApply,
        scale(force, 1 / this.params.mass)
      );
  }

  /** UCharacterMovementComponent::AddImpulse. */
  addImpulse(impulse: Vec3, velocityChange: boolean): void {
    if (isZero(impulse) || this.movementMode === 'none') return;
    let final = impulse;
    if (!velocityChange) {
      if (this.params.mass <= SMALL_NUMBER) return;
      final = scale(impulse, 1 / this.params.mass);
    }
    this.pendingImpulseToApply = add(this.pendingImpulseToApply, final);
  }

  /** UCharacterMovementComponent::ApplyAccumulatedForces: walking turns
   * to falling only when the upward push beats gravity over the update. */
  applyAccumulatedForces(deltaSeconds: number): void {
    const impulse = this.pendingImpulseToApply;
    const force = this.pendingForceToApply;
    if (impulse.z !== 0 || force.z !== 0) {
      if (
        this.isMovingOnGround() &&
        impulse.z + force.z * deltaSeconds + this.getGravityZ() * deltaSeconds >
          SMALL_NUMBER
      )
        this.setMovementMode('falling');
    }
    this.velocity = add(
      this.velocity,
      add(impulse, scale(force, deltaSeconds))
    );
    this.pendingImpulseToApply = ZERO;
    this.pendingForceToApply = ZERO;
  }

  /** UCharacterMovementComponent::ClearAccumulatedForces. */
  clearAccumulatedForces(): void {
    this.pendingImpulseToApply = ZERO;
    this.pendingForceToApply = ZERO;
  }

  /** UCharacterMovementComponent::StartNewPhysics. */
  startNewPhysics(deltaTime: number, iterations: number): void {
    if (
      deltaTime < MIN_TICK_TIME ||
      iterations >= this.params.maxSimulationIterations
    )
      return;
    if (this.movementMode === 'walking')
      this.physWalking(deltaTime, iterations);
    else if (this.movementMode === 'falling')
      this.physFalling(deltaTime, iterations);
  }

  /** SetMovementMode + OnMovementModeChanged (the walking/falling parts). */
  setMovementMode(mode: MovementMode): void {
    if (mode === this.movementMode) return;
    this.movementMode = mode;
    if (mode === 'walking') {
      // Walking uses only XY velocity and must be on a walkable floor.
      this.velocity = planeProject(this.velocity, UP);
      this.findFloor(this.location, this.currentFloor, false);
      this.adjustFloorHeight();
    } else {
      this.currentFloor.clear();
    }
  }

  /** Put the capsule at `location` and drop it from there. */
  teleport(location: Vec3): void {
    this.location = location;
    this.velocity = ZERO;
    this.acceleration = ZERO;
    this.justTeleported = true;
    this.forceNextFloorCheck = true;
    this.clearAccumulatedForces();
    this.movementMode = 'none';
    this.setMovementMode('falling');
  }

  // ---- Queries ----

  isMovingOnGround(): boolean {
    return this.movementMode === 'walking';
  }

  isFalling(): boolean {
    return this.movementMode === 'falling';
  }

  /** GetGravityZ: the physics volume's gravity (the world's) times
   * GravityScale, a float product (`Super::GetGravityZ() * GravityScale`). */
  getGravityZ(): number {
    return f32(this.params.gravityZ * this.params.gravityScale);
  }

  /** The physics volume's TerminalVelocity. */
  getTerminalVelocity(): number {
    return this.params.terminalVelocity;
  }

  /** GetMaxSpeed, for the modes this port has. */
  getMaxSpeed(): number {
    return this.movementMode === 'walking' || this.movementMode === 'falling'
      ? this.params.maxWalkSpeed
      : 0;
  }

  getMaxAcceleration(): number {
    return this.params.maxAcceleration;
  }

  /** GetMaxBrakingDeceleration. */
  getMaxBrakingDeceleration(): number {
    if (this.movementMode === 'walking')
      return this.params.brakingDecelerationWalking;
    if (this.movementMode === 'falling')
      return this.params.brakingDecelerationFalling;
    return 0;
  }

  /** GetMinAnalogSpeed. */
  getMinAnalogSpeed(): number {
    return this.movementMode === 'none' ? 0 : this.params.minAnalogWalkSpeed;
  }

  getGroundFriction(): number {
    return this.params.groundFriction;
  }

  canWalkOffLedges(): boolean {
    return this.params.canWalkOffLedges;
  }

  // ---- Input ----

  /** ConstrainInputAcceleration: walking or falling ignores up/down. */
  constrainInputAcceleration(input: Vec3): Vec3 {
    if (
      Math.abs(input.z) > 1e-8 &&
      (this.isMovingOnGround() || this.isFalling())
    ) {
      return withZ(input, 0);
    }
    return input;
  }

  /** ScaleInputAcceleration (`float GetMaxAcceleration()`). */
  scaleInputAcceleration(input: Vec3): Vec3 {
    return scale(clampedToMaxSize(input, 1), f32(this.getMaxAcceleration()));
  }

  computeAnalogInputModifier(): number {
    return velocity.computeAnalogInputModifier(this);
  }

  // ---- Velocity (velocity.ts) ----

  calcVelocity(
    deltaTime: number,
    friction: number,
    fluid: boolean,
    brakingDeceleration: number
  ): void {
    velocity.calcVelocity(
      this,
      deltaTime,
      friction,
      fluid,
      brakingDeceleration
    );
  }

  applyVelocityBraking(
    deltaTime: number,
    friction: number,
    brakingDeceleration: number
  ): void {
    velocity.applyVelocityBraking(
      this,
      deltaTime,
      friction,
      brakingDeceleration
    );
  }

  isExceedingMaxSpeed(maxSpeed: number): boolean {
    return velocity.isExceedingMaxSpeed(this, maxSpeed);
  }

  // ---- Floor (floor.ts) ----

  findFloor(
    capsuleLocation: Vec3,
    out: FindFloorResult,
    canUseCachedLocation: boolean,
    downwardSweep: HitResult | null = null
  ): void {
    floor.findFloor(
      this,
      capsuleLocation,
      out,
      canUseCachedLocation,
      downwardSweep
    );
  }

  computeFloorDist(
    capsuleLocation: Vec3,
    lineDistance: number,
    sweepDistance: number,
    out: FindFloorResult,
    sweepRadius: number,
    downwardSweep: HitResult | null = null
  ): void {
    floor.computeFloorDist(
      this,
      capsuleLocation,
      lineDistance,
      sweepDistance,
      out,
      sweepRadius,
      downwardSweep
    );
  }

  isWalkable(hit: HitResult): boolean {
    return floor.isWalkable(this, hit);
  }

  isWithinEdgeTolerance(
    capsuleLocation: Vec3,
    testImpactPoint: Vec3,
    capsuleRadius: number
  ): boolean {
    return floor.isWithinEdgeTolerance(
      capsuleLocation,
      testImpactPoint,
      capsuleRadius
    );
  }

  getPerchRadiusThreshold(): number {
    return Math.max(0, this.params.perchRadiusThreshold);
  }

  // ---- Walking (walking.ts, step_up.ts) ----

  physWalking(deltaTime: number, iterations: number): void {
    walking.physWalking(this, deltaTime, iterations);
  }

  moveAlongFloor(
    inVelocity: Vec3,
    deltaSeconds: number,
    outStepDown: StepDownResult | null
  ): void {
    walking.moveAlongFloor(this, inVelocity, deltaSeconds, outStepDown);
  }

  computeGroundMovementDelta(
    delta: Vec3,
    rampHit: HitResult,
    hitFromLineTrace: boolean
  ): Vec3 {
    return walking.computeGroundMovementDelta(
      this,
      delta,
      rampHit,
      hitFromLineTrace
    );
  }

  maintainHorizontalGroundVelocity(): void {
    walking.maintainHorizontalGroundVelocity(this);
  }

  adjustFloorHeight(): void {
    walking.adjustFloorHeight(this);
  }

  checkFall(
    oldFloor: FindFloorResult,
    hit: HitResult,
    delta: Vec3,
    oldLocation: Vec3,
    remainingTime: number,
    timeTick: number,
    iterations: number,
    mustJump: boolean
  ): boolean {
    return walking.checkFall(
      this,
      oldFloor,
      hit,
      delta,
      oldLocation,
      remainingTime,
      timeTick,
      iterations,
      mustJump
    );
  }

  startFalling(
    iterations: number,
    remainingTime: number,
    timeTick: number,
    delta: Vec3,
    subLoc: Vec3
  ): void {
    walking.startFalling(
      this,
      iterations,
      remainingTime,
      timeTick,
      delta,
      subLoc
    );
  }

  canStepUp(hit: HitResult): boolean {
    return stepUp.canStepUp(this, hit);
  }

  stepUp(
    gravDir: Vec3,
    delta: Vec3,
    hit: HitResult,
    outStepDown: StepDownResult | null
  ): boolean {
    return stepUp.stepUp(this, gravDir, delta, hit, outStepDown);
  }

  // ---- Falling (falling.ts) ----

  physFalling(deltaTime: number, iterations: number): void {
    falling.physFalling(this, deltaTime, iterations);
  }

  getFallingLateralAcceleration(deltaTime: number): Vec3 {
    return falling.getFallingLateralAcceleration(this, deltaTime);
  }

  newFallVelocity(
    initialVelocity: Vec3,
    gravity: Vec3,
    deltaTime: number
  ): Vec3 {
    return falling.newFallVelocity(this, initialVelocity, gravity, deltaTime);
  }

  limitAirControl(
    deltaTime: number,
    fallAcceleration: Vec3,
    hit: HitResult,
    checkForValidLandingSpot: boolean
  ): Vec3 {
    return falling.limitAirControl(
      this,
      deltaTime,
      fallAcceleration,
      hit,
      checkForValidLandingSpot
    );
  }

  isValidLandingSpot(capsuleLocation: Vec3, hit: HitResult): boolean {
    return falling.isValidLandingSpot(this, capsuleLocation, hit);
  }

  shouldCheckForValidLandingSpot(
    deltaTime: number,
    delta: Vec3,
    hit: HitResult
  ): boolean {
    return falling.shouldCheckForValidLandingSpot(this, deltaTime, delta, hit);
  }

  processLanded(
    hit: HitResult,
    remainingTime: number,
    iterations: number
  ): void {
    falling.processLanded(this, hit, remainingTime, iterations);
  }

  // ---- UMovementComponent overrides ----

  /**
   * UCharacterMovementComponent::GetSimulationTimeStep, in float as UE runs
   * it: a 0.3 s frame is 5 x 0.05 + 2 x 0.025 (7 sub-steps), where doubles
   * give 6 (09-editor.md 2.6).
   */
  getSimulationTimeStep(remainingTime: number, iterations: number): number {
    let time = f32(remainingTime);
    if (
      time > this.params.maxSimulationTimeStep &&
      iterations < this.params.maxSimulationIterations
    ) {
      time = Math.min(this.params.maxSimulationTimeStep, f32(time * 0.5));
    }
    return Math.max(f32(MIN_TICK_TIME), time);
  }

  /** UCharacterMovementComponent::GetPenetrationAdjustment. */
  override getPenetrationAdjustment(hit: HitResult): Vec3 {
    return clampedToMaxSize(
      super.getPenetrationAdjustment(hit),
      this.params.maxDepenetrationWithGeometry
    );
  }

  /** UCharacterMovementComponent::ResolvePenetrationImpl. */
  override resolvePenetration(adjustment: Vec3, hit: HitResult): boolean {
    this.justTeleported =
      super.resolvePenetration(adjustment, hit) || this.justTeleported;
    return this.justTeleported;
  }

  /** UCharacterMovementComponent::SlideAlongSurface. */
  override slideAlongSurface(
    delta: Vec3,
    time: number,
    inNormal: Vec3,
    hit: HitResult,
    handleImpact = false
  ): number {
    if (!hit.blockingHit) return 0;
    let normal = inNormal;
    if (this.isMovingOnGround()) {
      if (normal.z > 0) {
        // Don't get pushed up an unwalkable surface.
        if (!this.isWalkable(hit)) normal = safeNormal2D(normal);
      } else if (normal.z < -1e-4) {
        // Don't push down into the floor when the impact is on the upper
        // portion of the capsule.
        if (
          this.currentFloor.floorDist < MIN_FLOOR_DIST &&
          this.currentFloor.blockingHit
        ) {
          const floorNormal = this.currentFloor.hitResult.normal;
          const floorOpposedToMovement =
            dot(delta, floorNormal) < 0 && floorNormal.z < 1 - 0.00001;
          if (floorOpposedToMovement) normal = floorNormal;
          normal = safeNormal2D(normal);
        }
      }
    }
    return super.slideAlongSurface(delta, time, normal, hit, handleImpact);
  }

  /** UCharacterMovementComponent::TwoWallAdjust. */
  override twoWallAdjust(
    worldDelta: Vec3,
    hit: HitResult,
    oldHitNormal: Vec3
  ): Vec3 {
    let delta = super.twoWallAdjust(worldDelta, hit, oldHitNormal);
    if (this.isMovingOnGround()) {
      if (delta.z > 0) {
        // Allow slides up walkable surfaces, not unwalkable ones.
        const hitNormal = hit.normal;
        if (
          (hitNormal.z >= this.params.walkableFloorZ || this.isWalkable(hit)) &&
          hitNormal.z > Math.fround(1e-4)
        ) {
          // Maintain horizontal velocity (float Time).
          const time = Math.fround(1 - hit.time);
          delta = scale(
            { x: delta.x, y: delta.y, z: delta.z / hitNormal.z },
            time
          );
          // Never exceed MaxStepHeight vertically.
          if (delta.z > this.params.maxStepHeight) {
            delta = scale(
              delta,
              Math.fround(this.params.maxStepHeight / delta.z)
            );
          }
        } else {
          delta = withZ(delta, 0);
        }
      } else if (delta.z < 0) {
        // Don't push down into the floor.
        if (
          this.currentFloor.floorDist < MIN_FLOOR_DIST &&
          this.currentFloor.blockingHit
        ) {
          delta = withZ(delta, 0);
        }
      }
    }
    return delta;
  }

  /** UCharacterMovementComponent::ComputeSlideVector. */
  override computeSlideVector(
    delta: Vec3,
    time: number,
    normal: Vec3,
    hit: HitResult
  ): Vec3 {
    const result = super.computeSlideVector(delta, time, normal, hit);
    return this.isFalling()
      ? falling.handleSlopeBoosting(this, result, delta, time, normal, hit)
      : result;
  }
}

/** Every number in StockParams is a `float` UPROPERTY in UE (int32 for
 * MaxSimulationIterations, which is exact either way). */
function floatParams(p: StockParams): StockParams {
  const out = { ...p } as Record<string, number | boolean>;
  for (const [k, v] of Object.entries(out))
    if (typeof v === 'number') out[k] = f32(v);
  return out as unknown as StockParams;
}
