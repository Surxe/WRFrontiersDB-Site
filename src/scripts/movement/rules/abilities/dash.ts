/**
 * Dash Thrusters, WRF's `USDashAbility` (findings step 6; MVP session 5).
 * It runs on the base ability's state machine (base_ability.ts): a press
 * starts it from Idle when the fuel condition holds, it stays active for
 * `InitialDuration`, and its cooldown starts at activation.
 *
 * While active, once per movement update (`0x1453027d0`, after the state
 * machine's tick, so the activation update already runs it):
 * 1. every action's tick (dash_action below), in data order;
 * 2. the lateral force (`0x145580290`, stock AddForce);
 * 3. the fuel drain `UsageFuelCost x min(1, dt / FuelConsumptionDuration)`;
 * 4. the input interrupt check (`0x1452fee90`);
 * 5. end (event 8) when interrupted or out of fuel.
 * Every update it refreshes "can dash" (`+0x499`): fuel at least
 * `MinimumDuration / FuelConsumptionDuration x UsageFuelCost`.
 *
 * On activation (`DoActivate` `0x1452ef390`) it records whether the robot
 * is on the ground and resets the actions; when the active state starts
 * (`0x1452ddd40`) it computes the direction, blocks fuel regeneration and
 * switches WRF's ground friction step off; when it ends (`0x1452de2b0`)
 * both are restored and the direction cleared; `DoDeactivate`
 * (`0x1452ee720`) finishes every action still running.
 */
import {
  add,
  f32,
  isNearlyZero,
  safeNormal,
  scale,
  vec,
  ZERO,
  UP,
  type Vec3,
} from '../../math/vec';
import {
  rotateAngleAxis,
  rotatorRotateVector,
  vectorRotation,
} from '../../math/ue_rotation';
import type { DashAction, DashData } from '../../data/dash_ability';
import type { GameplayResource } from '../fuel';
import type { TunedCharacterMovement } from '../tuned_movement';
import { BaseAbility } from './base_ability';
import { dashDirection } from './dash_direction';

/** The regen blocker's holder name (the ability object in game). */
export const DASH_HOLDER = 'Dash Thrusters';

/** One action's blocker and modifier holder name. */
const actionHolder = (index: number): string => `Dash action ${index}`;

/** `USDashAction`'s runtime state (`+0x28` started, `+0x29` finished,
 * `+0x2c` the time waited for MinSpeedToStartAction). */
export class DashActionState {
  started = false;
  finished = false;
  wait = 0;

  constructor(
    readonly data: DashAction,
    private readonly dash: DashAbility
  ) {}

  /** Reset on activation (`0x1452c05d0`): started and finished only; the
   * wait time is kept (it is zeroed only when a started action finishes). */
  reset(): void {
    this.started = false;
    this.finished = false;
  }

  /** The action tick (`0x1452c2200`). */
  tick(dt: number): void {
    if (this.finished) return;
    const d = this.data;
    const m = this.dash.movement;
    const t = this.dash.elapsed();
    const durationDone =
      d.hasDuration &&
      this.started &&
      !(t < f32(f32(this.wait + f32(d.startDelay)) + f32(d.duration)));
    let minSpeedReached = f32(d.minSpeedToStartAction) === 0;
    const dir = this.dash.direction;
    const v = m.velocity;
    const along = dir.y * v.y + dir.x * v.x + dir.z * v.z;
    if (along > 0) {
      const k = along / (dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      const px = dir.x * k;
      const py = dir.y * k;
      const speedSq = py * py + px * px;
      const threshold = f32(d.velocityThreshold);
      const velocityDone =
        d.hasVelocityThreshold && !(speedSq <= f32(threshold * threshold));
      const minSpeed = f32(d.minSpeedToStartAction);
      minSpeedReached = f32(minSpeed * minSpeed) <= speedSq;
      if (durationDone || velocityDone) {
        this.finished = true;
        if (!this.started) return;
        this.release();
        this.wait = 0;
        return;
      }
    }
    if (!this.started) {
      if (f32(d.startDelay) <= t) {
        if (minSpeedReached) this.start();
        else this.wait = f32(dt + this.wait);
      }
      if (!this.started) return;
    }
    // Running: stock AddImpulse (divided by Mass), landing next update.
    const mass = f32(m.params.mass);
    const vertical = f32(d.verticalAcceleration);
    const dtMass = f32(dt * mass);
    m.addImpulse(
      vec(
        UP.x * vertical * dtMass,
        UP.y * vertical * dtMass,
        vertical * UP.z * dtMass
      ),
      false
    );
    const push = f32(f32(f32(d.requestedDirectionAcceleration) * mass) * dt);
    m.addImpulse(scale(dir, push), false);
  }

  /** The action start (`0x1452c16d0`): ground/air eligibility from the
   * activation, then the top-speed modifier, the start impulse in `D`'s
   * frame added to the velocity, falling, and the air-control blocker. */
  private start(): void {
    if (this.started) return;
    const d = this.data;
    const onGround = this.dash.startedOnGround;
    if ((!d.canStartOnGround && onGround) || (!d.canStartMidair && !onGround)) {
      this.finished = true;
      return;
    }
    this.started = true;
    const m = this.dash.movement;
    const holder = actionHolder(d.index);
    if (d.maxSpeedModifier)
      m.maxSpeedModifiers.set(holder, d.maxSpeedModifier.value);
    const impulse = rotatorRotateVector(
      vectorRotation(this.dash.direction),
      vec(d.startImpulse.x, d.startImpulse.y, d.startImpulse.z)
    );
    m.velocity = add(m.velocity, impulse);
    m.setMovementMode('falling');
    if (d.blocksAirControl) m.airControlBlockers.add(holder);
  }

  /** The action finish (`0x1452c1ad0`), from DoDeactivate. */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (!this.started) return;
    this.release();
    this.wait = 0;
  }

  /** Remove the top-speed modifier and the air-control blocker. */
  private release(): void {
    const holder = actionHolder(this.data.index);
    this.dash.movement.maxSpeedModifiers.delete(holder);
    if (this.data.blocksAirControl)
      this.dash.movement.airControlBlockers.remove(holder);
  }

  /** A new robot. */
  clear(): void {
    this.started = false;
    this.finished = false;
    this.wait = 0;
  }
}

export class DashAbility extends BaseAbility {
  /** The dash direction (`+0x480`); zero when not active. */
  direction: Vec3 = ZERO;
  /** On the ground at activation (`+0x498`). */
  startedOnGround = false;
  /** "Can dash" (`+0x499`): the constructor sets it true. */
  canDash = true;
  /** The input interrupt (`+0x49a`). */
  interrupted = false;
  /** Aim target minus capsule location, set before each update. */
  aim: Vec3 = vec(1, 0, 0);
  /** The last lateral force request (debug readout and tests). */
  lastLateralForce: Vec3 = ZERO;
  readonly actions: DashActionState[];
  private pressed = false;

  constructor(
    readonly movement: TunedCharacterMovement,
    private readonly fuel: GameplayResource,
    readonly data: DashData
  ) {
    super(data.initialDuration, data.cooldown);
    this.actions = data.actions.map((a) => new DashActionState(a, this));
  }

  /** The dash input: a press sets the activation flag and a release
   * clears it (the input binding itself is not traced; known gap). */
  setInput(held: boolean): void {
    if (held !== this.pressed) this.activationHeld = held;
    this.pressed = held;
  }

  /** The fuel needed to start a dash (`+0x499`'s threshold). */
  get startFuel(): number {
    const d = this.data;
    return f32(
      f32(f32(d.minimumDuration) / f32(d.fuelConsumptionDuration)) *
        f32(d.usageFuelCost)
    );
  }

  /** The ability tick (`0x1453027d0`). */
  tick(deltaSeconds: number): void {
    const dt = f32(deltaSeconds);
    this.lastLateralForce = ZERO;
    this.baseTick(dt);
    if (this.isActive) {
      for (const action of this.actions) action.tick(dt);
      this.applyLateralForce(dt);
      let frac = f32(dt / f32(this.data.fuelConsumptionDuration));
      if (1 <= frac) frac = 1;
      this.fuel.add(-f32(f32(this.data.usageFuelCost) * frac));
      const empty = this.fuel.value <= 0;
      this.interrupted = this.interruptCheck();
      if (this.interrupted || empty) this.end();
    }
    this.canDash = this.startFuel <= this.fuel.value;
  }

  /** A new robot: Inactive, nothing running, nothing held. */
  reset(): void {
    this.resetStates();
    for (const action of this.actions) action.clear();
    for (const action of this.data.actions)
      this.movement.maxSpeedModifiers.delete(actionHolder(action.index));
    for (const action of this.data.actions)
      this.movement.airControlBlockers.remove(actionHolder(action.index));
    this.fuel.regenBlockers.remove(DASH_HOLDER);
    this.movement.frictionEnabled = true;
    this.direction = ZERO;
    this.startedOnGround = false;
    this.canDash = true;
    this.interrupted = false;
    this.pressed = false;
  }

  // ---- Base ability hooks ----

  protected customCanActivate(): boolean {
    return this.canDash;
  }

  protected doActivate(): void {
    this.startedOnGround = this.movement.isMovingOnGround();
    for (const action of this.actions) action.reset();
    this.interrupted = false;
  }

  protected onActiveStateStarted(): void {
    this.direction = dashDirection({
      aim: this.aim,
      input: this.movement.consumedInput,
      onGround: this.movement.isMovingOnGround(),
      forward: this.movement.forwardVector(),
    });
    this.fuel.regenBlockers.add(DASH_HOLDER);
    this.movement.frictionEnabled = false;
  }

  protected doDeactivate(): void {
    for (const action of this.actions) action.finish();
  }

  protected override onActiveStateEnded(): void {
    super.onActiveStateEnded();
    this.fuel.regenBlockers.remove(DASH_HOLDER);
    this.movement.frictionEnabled = true;
    this.direction = ZERO;
  }

  // ---- Per update ----

  /**
   * The lateral force (`0x145580290`, disassembly-checked 2026-11-22): the
   * velocity's component across `D`'s horizontal right `L`, scaled by
   * `dt` and per axis by `|L_i|`, opposed with LateralFrictionMultiplier,
   * through stock AddForce (divided by Mass, times the next update's time).
   */
  private applyLateralForce(dt: number): void {
    const dir = this.direction;
    const w0 = vec(dt * 0, dt * 1, 0);
    if (!(Math.abs(w0.x) > 1e-4 || Math.abs(w0.y) > 1e-4)) return;
    const turned = rotateAngleAxis(w0, vectorRotation(dir).yaw, UP);
    const len = Math.sqrt(turned.y * turned.y + turned.x * turned.x);
    let nx = 0;
    let ny = 0;
    if (len > f32(1e-8)) {
      const inv = 1 / len;
      nx = turned.x * inv;
      ny = turned.y * inv;
    }
    let m = len;
    if (1 <= m) m = 1;
    if (m <= 0) m = 0;
    const wx = nx * m;
    const wy = ny * m;
    const wz = turned.z;
    const v = this.movement.velocity;
    const speed = f32(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z));
    const k =
      ((v.y - speed * dir.y) * wy +
        (v.x - speed * dir.x) * wx +
        (v.z - speed * dir.z) * wz) /
      (wy * wy + wx * wx + wz * wz);
    const lfm = f32(this.data.lateralFrictionMultiplier);
    const force = vec(
      Math.abs(wx) * k * wx * -1 * lfm,
      Math.abs(wy) * k * wy * -1 * lfm,
      Math.abs(wz) * k * wz * -1 * lfm
    );
    this.lastLateralForce = force;
    this.movement.addForce(force);
  }

  /** The input interrupt (`0x1452fee90`): after MinimumDuration, input
   * turned from `D` by more than MinInterruptionAngle. */
  private interruptCheck(): boolean {
    const d = this.data;
    if (!(f32(d.minimumDuration) <= this.elapsed())) return false;
    const input = this.movement.consumedInput;
    if (isNearlyZero(input) || isNearlyZero(this.direction)) return false;
    const n = safeNormal(input);
    const dir = safeNormal(this.direction);
    const limit = f32(
      Math.cos(f32(f32(d.minInterruptionAngle) * f32(0.017453292)))
    );
    return dir.y * n.y + n.x * dir.x + dir.z * n.z < limit;
  }
}
