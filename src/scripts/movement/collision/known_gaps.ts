/**
 * What the collision layer does not establish yet (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and in the planning
 * notes, never filled in by estimate.
 */
export const COLLISION_KNOWN_GAPS: readonly string[] = [
  "Every sweep's hit is Chaos's float32 one (D26; bit for bit against UE's oracle on boxes, hulls, meshes, spheres, capsules and heightfields, starting overlaps included). Hull ImpactNormals can differ in the last float bit: Chaos's cooked plane normals (fitted at cook time) are not in the export, so the layer derives them from the hull's faces.",
  "Ties between shapes at exactly the same Chaos distance and face dot (a corner's apex, D19): UE keeps the shape its acceleration structure visits first (the same sweep reports the left wall in one UE world and the right in another); the layer keeps its stable collider order. Ties between triangles of one mesh follow the cooked BVH's order in UE (not exported; index order is used). Hits within 1e-6 cm of each other are ranked by SQVisitor's face rule, as UE does.",
  "Several shapes overlapping the capsule at the start: UE keeps the last one its acceleration structure visits (those after the first through OverlapQuery's MTD, not ported); the layer reports the deepest. Counted by the bench ('multi-overlap').",
  "Candidates: Chaos sweeps every shape the exact layer finds within a tie window of the first contact, every touching and overlapping one, with a band widened by the shape's size (Chaos's float error on a shape with edges of length L reaches about 1e-10 x L^2 cm; the band is ten times that). A larger float error than measured would let Chaos report a shape the layer did not offer.",
  "Line traces and overlap tests (floor line checks, ResolvePenetration's encroachment test) stay on the exact float64 layer: the UE traces run 636 line traces and 173 overlap tests, all replayed bit for bit, so no difference is shown; an overlap test within float32 noise of touching (far from the origin) could still answer differently from Chaos's GJK.",
  "Sphere colliders: the export carries no body rotation for them, so Chaos's sweep is set up with an identity particle rotation (exact for sphere components; a sphere element offset in a rotated body would differ in the last float bits).",
  'The float32 rotation Chaos holds for a map component (FRotation3f) is taken to be the exported rotation rounded to float.',
  'Moving platforms (SMovingPlatform) stay at their exported start position (D20).',
  'Destructible geometry is loaded intact (the start of a match).',
  'Lighting variant: the game picks one per match (a launch option); drive mode defaults to the heaviest weight (lighting= picks another).',
];
