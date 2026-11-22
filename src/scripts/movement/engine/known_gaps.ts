/**
 * What the engine port does not establish (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and the console, never
 * filled in by estimate. The reference-trace suite
 * (tests/movement/reference_traces.ts) reports the class C cases each one
 * covers.
 */
export const ENGINE_KNOWN_GAPS: readonly string[] = [
  "Parallel contacts (class C, D23): on a wall parallel to the capsule's axis Chaos's float32 GJK often reports an impact point below the core's top end, so UE attempts StepUp (it succeeds as a slide and keeps the step-up velocity) where the port slides. Seen on box, hull and mesh walls and in corners (UE traces wall_45_slide, corner_90, hull_pillar_slide, mesh_onesided_front: up to 2500 cm/s on single ticks, 1.4 m over 3 s on the pillar). WRF's MoveAlongFloor calls the same StepUp.",
  "Edge contacts on triangle and heightfield edges (class C): Chaos's float32 GJK places them up to about 0.3 cm off the exact edge (UE trace landscape_slope_hole, perched on a hole rim: 9 cm over 30 ticks).",
  "PhysFalling's perch 'virtual ditch' nudge (a random push when stuck on a perch edge while falling, FRandomStream) is not ported; no UE trace reaches it.",
  'Movement bases are not modelled: moving platforms stay static (D20).',
];
