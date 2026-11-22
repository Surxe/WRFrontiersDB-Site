/**
 * What the collision layer does not establish yet (the fidelity rule,
 * stages/mvp.md): listed in drive mode's details (H) and in the planning
 * notes, never filled in by estimate.
 */
export const COLLISION_KNOWN_GAPS: readonly string[] = [
  'Parallel-contact impact point (class C, D23): the layer always reports the core top end; Chaos float32 GJK often returns an interior point (see the engine gaps for the effect).',
  'Ties between shapes (seams, D19) and internal triangle edges (class C) follow the exact geometry and a stable collider order, not Chaos traversal order.',
  'Starting overlaps: exact closest-point direction and depth, or the nearest face when the capsule core is inside a solid. Matches UE on boxes (shallow, core inside nearer either face) and the ground; not traced on hulls, meshes or heightfields (Chaos GJK/EPA).',
  'Moving platforms (SMovingPlatform) stay at their exported start position (D20).',
  'Destructible geometry is loaded intact (the start of a match).',
  'Lighting variant: the game picks one per match (a launch option); drive mode defaults to the heaviest weight (lighting= picks another).',
];
