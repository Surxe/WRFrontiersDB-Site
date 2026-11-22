/**
 * What the engine port does not establish (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and the console, never
 * filled in by estimate. The reference-trace suite
 * (tests/movement/reference_traces.ts) reports the class C cases each one
 * covers.
 */
export const ENGINE_KNOWN_GAPS: readonly string[] = [
  "Parallel contacts on vertical edges (class C): on faces the layer now reports Chaos's impact point, so StepUp's first gate (it gives up when ImpactPoint.Z is above the core's top end, where the layer's float-rounded top-end point always was) passes where UE's does (UE traces wall_45_slide, corner_90, corner_60_v, mesh_onesided_front gated class B). Sliding round a convex hull's vertical edge, Chaos's degenerate-simplex distance and point depend on input bits the port doesn't share (UE's floor sweeps are float32 too), and the StepUp branch can flip (hull_pillar_slide from tick 181: 1.7 cm, 12 cm/s).",
  "Edge contacts on triangle and heightfield edges (class C): Chaos's float32 GJK places them up to about 0.3 cm off the exact edge (UE trace landscape_slope_hole, perched on a hole rim: 9 cm over 30 ticks).",
  "PhysFalling's perch 'virtual ditch' nudge (a random push when stuck on a perch edge while falling, FRandomStream) is not ported; no UE trace reaches it.",
  'Movement bases are not modelled: moving platforms stay static (D20).',
];
