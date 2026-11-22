/**
 * The Jump Jet, WRF's `USJetpackAbility` (findings step 5): not stock UE
 * jumping, but an ability that pushes the robot up with forces through the
 * stock CMC force accumulator. Three states (built in `0x145322fc0`):
 *
 * | State | Tick | Leaves when |
 * | --- | --- | --- |
 * | Inactive | fires Jump (on the ground) or Fly (falling) while the jump input is held and the entry condition holds (`0x1453366e0`, `0x1453156f0`) | the event fires |
 * | Jump | `JumpFuelCost` paid on entry; constant thrust for `JumpTime`; releasing the input does not stop it (`0x145336b60`) | the time has run out |
 * | Fly | gravity scale 0; thrust from the curve over vertical speed; drains `FuelUsagePerSecond` (`0x145336570`) | input released, fuel 0, or blocked |
 *
 * It runs once per movement update with the update's whole time, at the end
 * of PerformMovement (`ASCharacter::CharacterMovementUpdated`, after fuel
 * regeneration; robot_character.ts). The force it requests lands in the
 * next update's ApplyAccumulatedForces.
 *
 * No cooldown: jumping has none in game although the data carries 15 s
 * (Ethan, D16).
 */
import { f32, vec } from '../../math/vec';
import { evalCurve } from '../../data/rich_curve';
import type { JetpackData } from '../../data/jump_ability';
import type { GameplayResource } from '../fuel';
import type { TunedCharacterMovement } from '../tuned_movement';

export type JetpackState = 'inactive' | 'jump' | 'fly';

/** The blocker holder's name (the ability object in game). */
export const JETPACK_HOLDER = 'Jump Jet';

/** Who wrote the movement component's GravityScale last. */
export type GravityWriter =
  | 'BP_Character'
  | 'Jump exit'
  | 'Fly enter'
  | 'Fly exit';

/** FMath::Clamp (the upper bound wins when it is below the lower). */
const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x < hi ? x : hi;

export class Jetpack {
  state: JetpackState = 'inactive';
  /** Jump time remaining, s (`+0x4d8`, float). */
  jumpTimeRemaining = 0;
  /** "Enough fuel to jump" (`+0x4dd`), refreshed after each state tick;
   * the ground entry condition reads the previous update's value. */
  enoughFuelToJump = false;
  /** The ability's activation-held flag (`+0x290`): the jump input. */
  activationHeld = false;
  /** The ability is blocked (the Fly exit's check); nothing blocks it in
   * the MVP. */
  blocked = false;
  gravityWriter: GravityWriter = 'BP_Character';
  /** The last thrust request, cm/s^2 (debug readout and tests). */
  lastThrust = 0;
  /** BP_Character's GravityScale, restored for a new robot. */
  private readonly initialGravityScale: number;

  constructor(
    private readonly movement: TunedCharacterMovement,
    private readonly fuel: GameplayResource,
    readonly data: JetpackData
  ) {
    this.initialGravityScale = movement.params.gravityScale;
  }

  /**
   * The ability tick (`+0x320`, `0x145336f90`): the base ticks the state
   * machine, then the jetpack refreshes "enough fuel to jump".
   */
  tick(deltaSeconds: number): void {
    const dt = f32(deltaSeconds);
    this.lastThrust = 0;
    if (this.state === 'inactive') this.tickInactive();
    else if (this.state === 'jump') this.tickJump(dt);
    else this.tickFly(dt);
    this.enoughFuelToJump = f32(this.data.jumpFuelCost) <= this.fuel.value;
  }

  /** A new robot: Inactive, no blockers, BP_Character's gravity scale. */
  reset(): void {
    this.state = 'inactive';
    this.jumpTimeRemaining = 0;
    this.enoughFuelToJump = false;
    this.lastThrust = 0;
    this.fuel.regenBlockers.remove(JETPACK_HOLDER);
    this.movement.walkingModeBlockers.remove(JETPACK_HOLDER);
    this.movement.params.gravityScale = this.initialGravityScale;
    this.gravityWriter = 'BP_Character';
  }

  // ---- Inactive ----

  /** The entry condition (`0x1453156f0`): on the ground the previous
   * update's "enough fuel to jump"; falling, fuel at least
   * `FuelCostToStartAirborne` (a threshold, not deducted). */
  private canStart(): boolean {
    if (this.movement.isMovingOnGround()) return this.enoughFuelToJump;
    if (this.movement.isFalling())
      return this.fuel.value >= f32(this.data.fuelCostToStartAirborne);
    return false;
  }

  /** Inactive tick (`0x1453366e0`): event `10 + IsMovingOnGround` while
   * the input is held. */
  private tickInactive(): void {
    if (!this.activationHeld || !this.canStart()) return;
    this.transition(this.movement.isMovingOnGround() ? 'jump' : 'fly');
  }

  private transition(to: JetpackState): void {
    if (this.state === 'inactive') this.exitInactive();
    else if (this.state === 'jump') this.exitJump();
    else this.exitFly();
    this.state = to;
    if (to === 'inactive') this.enterInactive();
    else if (to === 'jump') this.enterJump();
    else this.enterFly();
  }

  /** `0x14532c3c0`: regeneration and landing allowed again; walking at
   * once if nothing else blocks it and the vertical speed is exactly 0. */
  private enterInactive(): void {
    this.fuel.regenBlockers.remove(JETPACK_HOLDER);
    this.movement.walkingModeBlockers.remove(JETPACK_HOLDER);
    if (
      !this.movement.walkingModeBlockers.active &&
      this.movement.velocity.z === 0
    )
      this.movement.setMovementMode('walking');
  }

  /** `0x14532d000`: no regeneration, no landing. */
  private exitInactive(): void {
    this.fuel.regenBlockers.add(JETPACK_HOLDER);
    this.movement.walkingModeBlockers.add(JETPACK_HOLDER);
  }

  // ---- Jump ----

  /** `0x14532c480`. */
  private enterJump(): void {
    this.fuel.add(-this.data.jumpFuelCost);
    this.jumpTimeRemaining = f32(this.data.jumpTime);
    this.movement.setMovementMode(this.data.jumpMovementMode);
    this.movement.addImpulse(
      vec(0, 0, f32(this.data.jetpackStartVerticalImpulse)),
      false
    );
  }

  /** `0x145336b60`. */
  private tickJump(dt: number): void {
    if (this.jumpTimeRemaining <= 0) {
      this.transition('inactive');
      return;
    }
    let frac = 1;
    if (this.jumpTimeRemaining < dt) {
      if (this.jumpTimeRemaining < f32(this.data.jumpTime)) {
        this.jumpTimeRemaining = 0;
        return;
      }
      // Only when JumpTime is shorter than the first update.
      frac = f32(this.jumpTimeRemaining / dt);
    }
    this.jumpTimeRemaining = f32(this.jumpTimeRemaining - dt);
    this.thrust(dt, frac, true);
  }

  /** `0x14532d0d0`. */
  private exitJump(): void {
    this.movement.setMovementMode('falling');
    this.setGravityScale(1, 'Jump exit');
  }

  // ---- Fly ----

  /** `0x14532c240`. */
  private enterFly(): void {
    this.movement.setMovementMode('falling');
    this.setGravityScale(0, 'Fly enter');
  }

  /** `0x145336570`. */
  private tickFly(dt: number): void {
    const want = f32(f32(this.data.fuelUsagePerSecond) * dt);
    // FMath::SafeDivide: 0 when the divisor is 0.
    const frac = want === 0 ? 0 : f32(Math.min(want, this.fuel.value) / want);
    this.fuel.add(-want);
    this.thrust(dt, frac, false);
    if (this.fuel.value <= 0 || !this.activationHeld || this.blocked)
      this.transition('inactive');
  }

  /** `0x14532cea0`. */
  private exitFly(): void {
    this.setGravityScale(1, 'Fly exit');
  }

  // ---- Shared ----

  /**
   * The thrust request (`0x145310d00`): the vertical speed after forces
   * already queued, the Jump's constant force or the Fly curve at it,
   * capped at `JetpackMaxVerticalSpeed`, then stock AddForce. With no curve
   * neither state thrusts.
   */
  private thrust(dt: number, frac: number, jump: boolean): void {
    const curve = this.data.verticalAccelerationForceCurve;
    if (!curve) return;
    const m = this.movement;
    const mass = m.params.mass;
    const vz =
      m.velocity.z + m.pendingImpulseToApply.z + m.pendingForceToApply.z * dt;
    const force = jump
      ? f32(this.data.jetpackJumpAccelerationForce)
      : evalCurve(curve, vz);
    const dv = clamp(
      (force / mass) * dt * frac,
      0,
      f32(this.data.jetpackMaxVerticalSpeed) - vz
    );
    this.lastThrust = dv / dt;
    m.addForce(vec(0, 0, (dv * mass) / dt));
  }

  private setGravityScale(scale: number, writer: GravityWriter): void {
    this.movement.params.gravityScale = f32(scale);
    this.gravityWriter = writer;
  }
}
