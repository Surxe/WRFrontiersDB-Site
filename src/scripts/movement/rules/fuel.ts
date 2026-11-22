/**
 * The fuel gameplay resource: one `FSGameplayResource` entry of type Fuel in
 * WRF's `USResourceComponent` (`ASCharacter+0x1040`; findings step 5).
 *
 * - Starts full (`BeginPlay` `0x14567fe20`: `Value = MaxValue`).
 * - Regenerates a flat `RegenPerSecond` per second through its channel
 *   (pass-through: no talents or power-ups in the MVP) unless a regen
 *   blocker is held (`0x14568de30`). The Jump Jet holds one in Jump and Fly;
 *   the dash (session 5) holds one too.
 * - Every add clamps to [0, MaxValue] (`0x14567cd90`); the native adds never
 *   change the maximum (`bAdjustMax` false at all 15 call sites).
 *
 * `FSGameplayResource`'s values are `float`s, so the arithmetic is float32.
 */
import { f32 } from '../math/vec';
import { Blockers } from './blockers';

const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x < hi ? x : hi;

export class GameplayResource {
  value: number;
  maxValue: number;
  readonly regenPerSecond: number;
  readonly regenBlockers = new Blockers();

  constructor(maxValue: number, regenPerSecond: number) {
    this.maxValue = f32(maxValue);
    this.regenPerSecond = f32(regenPerSecond);
    this.value = this.maxValue;
  }

  /** Entry add (`0x14567cd90`): optionally move the maximum, then clamp
   * the value into [0, MaxValue]. */
  add(amount: number, adjustMax = false): void {
    const a = f32(amount);
    if (adjustMax) this.maxValue = f32(Math.max(0, f32(this.maxValue + a)));
    this.value = f32(clamp(f32(this.value + a), 0, this.maxValue));
  }

  /** The regeneration tick (`0x14568de30`), once per movement update with
   * the update's time. */
  regenerate(deltaSeconds: number): void {
    if (this.regenBlockers.active) return;
    const gain = f32(this.regenPerSecond * f32(deltaSeconds));
    this.value = f32(clamp(f32(this.value + gain), 0, this.maxValue));
  }

  /** A new robot: full again, no blockers. */
  reset(): void {
    this.regenBlockers.clear();
    this.value = this.maxValue;
  }

  get ratio(): number {
    return this.maxValue > 0 ? this.value / this.maxValue : 0;
  }
}
