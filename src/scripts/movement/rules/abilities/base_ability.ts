/**
 * WRF's base ability (`USAbility`): its default state machine, the base
 * tick and the state ticks (MVP session 5, static read of build
 * 5886399475557598571; findings/step-6-dash.md, 2026-11-22 note). The dash
 * runs on it; the Jump Jet builds its own states (jetpack.ts).
 *
 * States and transitions (builder `0x1452e9720`, used when RampUpDuration
 * and RampDownDuration are both 0; initial state set without its entry,
 * `0x1452fe4e0`):
 *
 * | From | Event | To |
 * | --- | --- | --- |
 * | Inactive (`FSInactiveState`) | 1 | Idle |
 * | Idle (`FSIdleState`) | 4 (activate) | Cast |
 * | Idle | 2 | Inactive |
 * | Cast (`FSCastState`) | 7 | Active |
 * | Cast | 8 | Inactive |
 * | Active (`FSActiveState`) | 8 (end, `+0x330`), 9 | Inactive |
 *
 * Event dispatch (`0x1452edf60`, `0x1452f9070`, `0x1452ed720`): an event
 * runs at once; one fired while another is being handled is queued and
 * handled after it, in the same call. A transition runs the old state's
 * exit, then the new state's entry. The base tick (`0x145302250`) ticks
 * the state that is current when it starts, once; a state entered during
 * that tick first ticks on the next update.
 *
 * Not ported (the loader fails loudly on data that needs them): cast time,
 * ramp-up/down, charges, initial cooldown, cancelling while active,
 * activation on grant, cooldown from the end of the active state. Buffs,
 * FX, sounds and HUD notifications have no movement effect.
 */
import { f32 } from '../../math/vec';

export type AbilityState = 'inactive' | 'idle' | 'cast' | 'active';

/** The base state machine's transitions, by state and event. */
const TRANSITIONS: Readonly<
  Record<AbilityState, Readonly<Partial<Record<number, AbilityState>>>>
> = {
  inactive: { 1: 'idle' },
  idle: { 4: 'cast', 2: 'inactive' },
  cast: { 7: 'active', 8: 'inactive' },
  active: { 8: 'inactive', 9: 'inactive' },
};

export abstract class BaseAbility {
  state: AbilityState = 'inactive';
  /** The activation input flag (`+0x290`); Inactive's entry clears it. */
  activationHeld = false;
  /** Active time left, s (`+0x3a0`, float). */
  remaining = 0;
  /** Cooldown left, s (`+0x3a4`, float). */
  cooldownRemaining = 0;
  /** The ability is blocked (interface `+0x30` slot `+0x20`); nothing
   * blocks one in the MVP. */
  blocked = false;
  private readonly queue: number[] = [];

  constructor(
    /** `InitialDuration` through `InitialDurationChannel` (pass-through). */
    readonly initialDuration: number,
    /** `Cooldown` through `CooldownChannel` (pass-through). */
    readonly cooldown: number
  ) {}

  /** `CustomCanActivateConditionsMet` (a BlueprintNativeEvent; no
   * Blueprint overrides it for the dash). */
  protected abstract customCanActivate(): boolean;
  /** `DoActivate` (vtable `+0x2d0`). */
  protected abstract doActivate(): void;
  /** `OnActiveStateStarted` (vtable `+0x2e8`). */
  protected abstract onActiveStateStarted(): void;
  /** `DoDeactivate` (vtable `+0x2c8`). */
  protected abstract doDeactivate(): void;

  /** `OnActiveStateEnded` (vtable `+0x370`); the base (`0x1452de110`)
   * zeroes the active time left. */
  protected onActiveStateEnded(): void {
    this.remaining = 0;
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  /** The state's "can activate" (state vtable `+0x18`): true in Idle only. */
  private canActivateInState(): boolean {
    return this.state === 'idle';
  }

  /** Time since the active state started, s (`0x1452e7e80`). */
  elapsed(): number {
    const duration = f32(this.initialDuration);
    return duration > 0 ? f32(duration - this.remaining) : duration;
  }

  /** The base tick (`0x145302250`): the current state's tick, then an
   * activation request (event 4) while the input flag is set. */
  protected baseTick(dt: number): void {
    this.stateTick(dt);
    if (this.activationHeld && this.canActivateInState() && !this.blocked)
      this.fire(4);
  }

  /** End the ability (vtable `+0x330`, `0x1452deff0`): event 8. */
  end(): void {
    this.fire(8);
  }

  /** A new robot: Inactive without its entry, nothing running. */
  protected resetStates(): void {
    this.state = 'inactive';
    this.activationHeld = false;
    this.remaining = 0;
    this.cooldownRemaining = 0;
    this.queue.length = 0;
  }

  // ---- Dispatch ----

  private fire(event: number): void {
    this.queue.push(event);
    if (this.queue.length > 1) return;
    while (this.queue.length > 0) {
      const to = TRANSITIONS[this.state][this.queue[0]];
      if (to) this.transition(to);
      this.queue.shift();
    }
  }

  private transition(to: AbilityState): void {
    if (to === this.state) return;
    this.exit(this.state);
    this.state = to;
    this.enter(to);
  }

  private enter(state: AbilityState): void {
    switch (state) {
      case 'inactive': // 0x1452f3a70
        this.activationHeld = false;
        return;
      case 'idle': // 0x1452f39e0: a HUD notification only
        return;
      case 'cast': // 0x1452f3710: CastDuration 0
        this.fire(7);
        return;
      case 'active': // 0x1452cefe0
        this.doActivate();
        // 0x145300a80: the active time; 0 or less ends at once.
        this.remaining = f32(this.initialDuration);
        if (this.remaining <= 0) this.end();
        // CooldownPolicy 0: the cooldown starts now (0x145300730; its
        // event 2 has no transition from Active).
        this.fire(2);
        this.cooldownRemaining = f32(this.cooldown);
        this.onActiveStateStarted();
        return;
    }
  }

  private exit(state: AbilityState): void {
    if (state === 'active') {
      // 0x1452f4700 -> 0x1452dc3d0
      this.doDeactivate();
      this.onActiveStateEnded();
    }
  }

  // ---- State ticks ----

  /** The state that is current at the start ticks (vtable `+0x38`). */
  private stateTick(dt: number): void {
    const state = this.state;
    this.commonTick(dt);
    switch (state) {
      case 'inactive': // 0x145302160 (MaxCharges 0)
        if (this.cooldownRemaining <= 0 && this.customCanActivate())
          this.fire(1);
        return;
      case 'idle': // 0x145302120
        if (!this.customCanActivate()) this.fire(2);
        return;
      case 'cast': // 0x145301fa0: no cast time left
        this.fire(7);
        return;
      case 'active': // 0x145301ea0 itself
        return;
    }
  }

  /** Every state's shared tick (`0x145301ea0`): the active time, then the
   * cooldown through `CooldownSpeedChannel` (pass-through). */
  private commonTick(dt: number): void {
    if (this.remaining > 0) {
      let left = f32(this.remaining - dt);
      if (left <= 0) left = 0;
      this.remaining = left;
      if (left <= 0) this.end();
    }
    if (this.cooldownRemaining > 0)
      this.cooldownRemaining = f32(this.cooldownRemaining - dt);
  }
}
