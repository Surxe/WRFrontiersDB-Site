/**
 * What the collision layer does not establish yet (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and in the planning
 * notes, never filled in by estimate.
 */
export const COLLISION_KNOWN_GAPS: readonly string[] = [
  'No UE reference traces yet for convex hulls, spheres, one-sided game meshes or heightfields: their hit rules are copied from the UE 5.4.4 source only (session 2 records traces).',
  'Parallel-contact impact point (class C, D23): the layer always reports the core top end; Chaos GJK sometimes returns an interior point (UE trace wall_45_slide, tick 132: 1.04 cm/s for one tick).',
  'Ties between shapes (seams, D19) and internal triangle edges (class C) follow the exact geometry and a stable collider order, not Chaos traversal order.',
  'Starting overlaps: exact closest-point direction and depth, or the nearest face when the capsule core is inside a solid; Chaos computes GJK/EPA penetration (no UE trace yet).',
  'Moving platforms (SMovingPlatform) stay at their exported start position (D20).',
  'Destructible geometry is loaded intact (the start of a match).',
  'Lighting variant: the game picks one per match (a launch option); drive mode defaults to the heaviest weight (lighting= picks another).',
];
