/**
 * What the engine port does not establish (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and the console, never
 * filled in by estimate. The reference-trace suite
 * (tests/movement/reference_traces.ts) reports the class C cases each one
 * covers.
 */
export const ENGINE_KNOWN_GAPS: readonly string[] = [
  "Last-bit differences in the move deltas (velocity x time): the port's velocity can differ from UE's in its last bit (about 1e-16 relative) without moving the capsule; over a few hundred ticks a handful of traces drift by up to 0.0004 cm (40 of 52 UE traces replay bit for bit).",
  "The capsule's rotation is FRotator::Quaternion of the yaw the rules layer sets (D27); UE reads its facing back from the component (GetComponentRotation, a quaternion-to-rotator round trip) where the rules layer keeps the yaw it set: the yaw's last bits can differ, which reaches the sweeps only through the float-rounded rotation.",
  "PhysFalling's perch 'virtual ditch' nudge (a random push when stuck on a perch edge while falling, FRandomStream) is not ported; no UE trace reaches it.",
  'Movement bases are not modelled: moving platforms stay static (D20).',
];
