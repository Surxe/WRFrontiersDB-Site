/**
 * The robot around its movement component: WRF's `ASCharacter` parts that
 * movement needs. Its `CharacterMovementUpdated` (`0x145586940`) is bound
 * to the CMC's OnCharacterMovementUpdated, so it runs once per movement
 * update at the end of PerformMovement with the update's whole time
 * (`0x14557a060`, findings step 5):
 *
 * 1. fuel regeneration (`0x14568de30`, called at `0x14557a1d3`);
 * 2. each module's tick (nothing movement-related in the MVP);
 * 3. every ability's tick (`+0x320`) in `ASCharacter::Abilities` order:
 *    the chassis module adds its `Abilities` array in index order
 *    (`0x145527370` -> `0x145578b10`), and every two-legged chassis
 *    Blueprint lists Dash Thrusters before the Jump Jet, so the dash ticks
 *    first and the Jump Jet sees its fuel spend and forces (MVP session 5).
 */
import type { Vec3 } from '../math/vec';
import type { JetpackData } from '../data/jump_ability';
import type { DashData } from '../data/dash_ability';
import type { FuelResourceDefaults } from '../data/character';
import type { ValueProvenance } from '../placeholders';
import { Jetpack } from './abilities/jetpack';
import { DashAbility } from './abilities/dash';
import { GameplayResource } from './fuel';
import type { TunedCharacterMovement } from './tuned_movement';

export interface AbilityInput {
  /** The jump input is held (the Jump Jet's activation-held flag). */
  jump: boolean;
  /** The dash input is held (a press sets the dash's activation flag). */
  dash: boolean;
  /** Aim target minus capsule location: where the dash aims. */
  aim: Vec3;
}

export class RobotCharacter {
  readonly fuel: GameplayResource;
  readonly jetpack: Jetpack;
  readonly dash: DashAbility;

  constructor(
    readonly movement: TunedCharacterMovement,
    private readonly fuelDefaults: FuelResourceDefaults,
    jetpack: JetpackData,
    dash: DashData,
    /** The chassis's FuelCapacity at its level, shown next to the maximum
     * applied (D21); null when the data has none. */
    private readonly chassisFuelCapacity: number | null = null
  ) {
    this.fuel = new GameplayResource(
      fuelDefaults.MaxValue,
      fuelDefaults.RegenPerSecond
    );
    this.jetpack = new Jetpack(movement, this.fuel, jetpack);
    this.dash = new DashAbility(movement, this.fuel, dash);
    movement.onMovementUpdated = (dt) => this.characterMovementUpdated(dt);
  }

  /** One movement update: the abilities read the input first (the
   * activation request), then the CMC moves and, at its end, calls
   * `characterMovementUpdated`. */
  update(deltaSeconds: number, inputVector: Vec3, input: AbilityInput): void {
    this.jetpack.activationHeld = input.jump;
    this.dash.setInput(input.dash);
    this.dash.aim = input.aim;
    this.movement.performMovement(deltaSeconds, inputVector);
  }

  /** `ASCharacter::CharacterMovementUpdated` (`0x14557a060`). */
  characterMovementUpdated(deltaSeconds: number): void {
    this.fuel.regenerate(deltaSeconds);
    this.dash.tick(deltaSeconds);
    this.jetpack.tick(deltaSeconds);
  }

  /** A new robot at `location`: full fuel, Jump Jet and dash inactive,
   * the Blueprint's gravity scale. */
  respawn(location: Vec3): void {
    this.dash.reset();
    this.jetpack.reset();
    this.fuel.reset();
    this.movement.teleport(location);
  }

  provenance(): ValueProvenance[] {
    const d = this.jetpack.data;
    const f = this.fuelDefaults;
    const j = this.jetpack;
    const s = this.movement.params;
    const defaulted =
      d.defaulted.length > 0
        ? `; absent, C++ defaults (0x14530da60): ${d.defaulted.join(', ')}`
        : '';
    const capacity = this.chassisFuelCapacity;
    return [
      {
        name: 'Jump Jet',
        value: `${j.state}${j.state === 'jump' ? ` (${j.jumpTimeRemaining.toFixed(2)} s left)` : ''}; Jump ${d.jumpTime} s at ${d.jetpackJumpAccelerationForce / s.mass} cm/s2, cost ${d.jumpFuelCost}; Fly from fuel ${d.fuelCostToStartAirborne}, ${d.fuelUsagePerSecond}/s`,
        source: 'data',
        note: `Ability.json ${d.id} (findings step 5 states and thrust)${defaulted}`,
      },
      {
        name: 'Jump cooldown',
        value: 'none',
        source: 'finding',
        note: `in game jumping has no cooldown (Ethan, D16); the data's ${d.cooldown ? `${d.cooldown.seconds} s ${d.cooldown.policy}` : 'none'} is not applied`,
      },
      ...this.dashProvenance(),
      {
        name: 'Mass',
        value: `${s.mass} kg`,
        source: 'finding',
        note: 'stock CMC constructor; neither WRF nor BP_Character writes it (step 5); forces and impulses divide by it',
      },
      {
        name: 'Gravity scale now',
        value: `${s.gravityScale} (last write: ${j.gravityWriter})`,
        source: j.gravityWriter === 'BP_Character' ? 'assumed' : 'finding',
        note:
          j.gravityWriter === 'BP_Character'
            ? "BP_Character's 1.2 before any jump: unmeasured (firing range G1)"
            : 'the native jetpack writes 0 on Fly entry and 1.0 on the Jump and Fly exits; whether anything resets it afterwards is unmeasured (G2)',
      },
      {
        name: 'Fuel',
        value: `${this.fuel.value.toFixed(2)} / ${this.fuel.maxValue}, +${f.RegenPerSecond}/s${this.fuel.regenBlockers.active ? ` (blocked: ${this.fuel.regenBlockers.list().join(', ')})` : ''}`,
        source: 'data',
        note: `Character.json ${f.id}.gameplay_resources[Fuel]; starts full, regenerates unless a blocker holds (step 5)`,
      },
      {
        name: 'Fuel maximum',
        value: `${f.MaxValue} for every chassis${capacity !== null && capacity !== f.MaxValue ? ` (chassis FuelCapacity here: ${capacity})` : ''}`,
        source: 'assumed',
        note: "BP_Character's MaxValue (D21): no code path applies the chassis FuelCapacity; unconfirmed until firing range F1",
      },
    ];
  }

  private dashProvenance(): ValueProvenance[] {
    const dash = this.dash;
    const d = dash.data;
    const m = this.movement;
    const defaulted =
      d.defaulted.length > 0
        ? `; absent, C++ defaults (0x1452cdc80): ${d.defaulted.join(', ')}`
        : '';
    const running = dash.actions
      .filter((a) => a.started && !a.finished)
      .map((a) => a.data.index);
    const modifiers = [...m.maxSpeedModifiers.values()];
    const dir = dash.direction;
    return [
      {
        name: 'Dash Thrusters',
        value: `${dash.state}${dash.isActive ? ` (${dash.elapsed().toFixed(2)} of ${d.initialDuration} s, actions ${running.join(', ') || 'none'} running)` : ''}; cost ${d.usageFuelCost} over ${d.fuelConsumptionDuration} s, needs ${dash.startFuel} to start; ${d.actions.length} actions`,
        source: 'data',
        note: `Ability.json ${d.id} (actions merged over BP_Ability_DashDefault; findings step 6, session 5's state machine)${defaulted}`,
      },
      {
        name: 'Dash cooldown',
        value: `${d.cooldown} s from activation${dash.cooldownRemaining > 0 ? ` (${dash.cooldownRemaining.toFixed(2)} s left)` : ''}`,
        source: 'data',
        note: "Ability.json cooldown; USAbility's CooldownPolicy default 0 starts it when the active state starts (0x1452cefe0)",
      },
      {
        name: 'Dash direction',
        value: dash.isActive
          ? `(${dir.x.toFixed(3)}, ${dir.y.toFixed(3)}, ${dir.z.toFixed(3)})`
          : 'set when a dash starts',
        source: 'assumed',
        note: "0x1452d7e30's player path from the view's forward (the aim component's target point is unread); unmeasured (firing range D1)",
      },
      {
        name: 'Dash top speed',
        value:
          modifiers.length > 0
            ? `MaxSpeedChannel + ${modifiers.join(' + ')} now`
            : 'MaxSpeedChannel unmodified now',
        source: 'assumed',
        note: "the first action's MaxSpeedModifier taken as an Add to the channel (D2, unread operator)",
      },
      {
        name: 'Dash key',
        value: 'Left Shift',
        source: 'finding',
        note: "the game's default binding (firing-range item K1, Ethan 2026-11-22); a press sets the activation flag (binding untraced)",
      },
    ];
  }
}
