/**
 * Rolling per-frame timings for the debug overlay and the prototype's
 * measurements: frame time, simulation time and collision query time.
 */

export interface Summary {
  mean: number;
  p95: number;
  max: number;
}

export interface FrameSample {
  frameMs: number;
  simMs: number;
  collisionMs: number;
  /** Collision time per simulation step (frames that ran a step only):
   * what a frame costs at one step per frame, whatever the frame rate. */
  collisionMsPerStep: number;
  queries: number;
  steps: number;
}

const WINDOW = 600;

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) return { mean: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    mean,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted[sorted.length - 1],
  };
}

export class RollingStats {
  private samples: FrameSample[] = [];

  add(sample: FrameSample): void {
    this.samples.push(sample);
    if (this.samples.length > WINDOW) this.samples.shift();
  }

  reset(): void {
    this.samples = [];
  }

  get count(): number {
    return this.samples.length;
  }

  summary(): Record<keyof FrameSample, Summary> {
    const of = (
      key: keyof FrameSample,
      keep = (_: FrameSample) => true
    ): Summary => summarize(this.samples.filter(keep).map((s) => s[key]));
    return {
      frameMs: of('frameMs'),
      simMs: of('simMs'),
      collisionMs: of('collisionMs'),
      collisionMsPerStep: of('collisionMsPerStep', (s) => s.steps > 0),
      queries: of('queries'),
      steps: of('steps'),
    };
  }
}
