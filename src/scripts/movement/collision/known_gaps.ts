/**
 * What the collision layer does not establish yet (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and in the planning
 * notes, never filled in by estimate.
 */
export const COLLISION_KNOWN_GAPS: readonly string[] = [
  "Parallel contacts on vertical edges (class C): the layer takes Chaos's float32 impact point on every contact parallel to the capsule axis (boxes, hulls, mesh triangles; bit for bit against UE's oracle), but its time and normal stay exact; on a vertical edge Chaos's simplex is degenerate, so its distance (up to 0.003 cm) and point (up to 0.16 cm off the edge) depend on the last bits of the inputs, which already differ (UE's other queries run in float32, the layer's are exact).",
  "Touching starts at far coordinates: within the layer's 0.01 cm touching band the layer reports a hit at time 0; where float32 is coarser than that (beyond about 650 m from the origin) Chaos's raycast reports an initial overlap (UE: bStartPenetrating, depenetrate and retry) or no hit. Counted by the bench ('no Chaos hit').",
  "Ties between shapes (seams, D19) and internal triangle edges (class C) follow the exact geometry and a stable collider order, not Chaos traversal order. On parallel contacts near-tied shapes are ranked by Chaos's float distance; exact float ties still go to the scene query's AABB-tree order in UE (the same corner sweep reports the left wall in one UE world and the right in another), and ties between triangles of one mesh to the cooked BVH's order (index order within a leaf is used; the BVH is not exported).",
  "The capsule's rotation is not passed to sweeps (the engine port has no component rotation): it enters only the parallel-contact point on shapes rotated out of the horizontal plane (pitch or roll), where it can flip Chaos's top or bottom support.",
  'The float32 rotation Chaos holds for a map component (FRotation3f) is taken to be the exported rotation rounded to float.',
  'Starting overlaps: exact closest-point direction and depth, or the nearest face when the capsule core is inside a solid. Matches UE on boxes (shallow, core inside nearer either face) and the ground; not traced on hulls, meshes or heightfields (Chaos GJK/EPA).',
  'Moving platforms (SMovingPlatform) stay at their exported start position (D20).',
  'Destructible geometry is loaded intact (the start of a match).',
  'Lighting variant: the game picks one per match (a launch option); drive mode defaults to the heaviest weight (lighting= picks another).',
];
