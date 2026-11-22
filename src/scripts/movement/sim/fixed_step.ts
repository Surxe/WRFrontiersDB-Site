/**
 * A fixed-timestep loop, independent of the frame rate: each frame's time
 * is spent in whole steps, the remainder carried over, and the renderer
 * interpolates between the last two steps by `alpha`.
 */

export interface StepResult {
  /** Steps run this frame. */
  steps: number;
  /** How far between the previous and current step to draw, 0 to 1. */
  alpha: number;
}

/** Frame time spent at most (a hidden tab, a long stall), seconds. */
const MAX_FRAME_SECONDS = 0.25;

export class FixedStep {
  private accumulator = 0;

  constructor(public stepSeconds: number) {}

  /** Advance by `frameSeconds`, calling `step` once per fixed step. */
  advance(frameSeconds: number, step: (seconds: number) => void): StepResult {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds) {
      step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    return { steps, alpha: this.accumulator / this.stepSeconds };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
