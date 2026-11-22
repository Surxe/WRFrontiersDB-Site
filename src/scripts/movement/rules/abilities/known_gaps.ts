/**
 * What the Jump Jet and fuel port does not establish (the fidelity rule,
 * stages/mvp.md): shown in drive mode's details (H) and the console, never
 * filled in by estimate. Session 5 adds the dash's here.
 */
export const ABILITY_KNOWN_GAPS: readonly string[] = [
  "Gravity scale before any jump: BP_Character's 1.2, after a Jump or Fly exit the native 1.0, as the code says; neither is measured (firing range G1, G2). Tap-jump airtime is 3.30 s if 1.2 applies before the jump, 3.76 s if 1.0 throughout (J1).",
  "Fuel maximum: BP_Character's 16 for every chassis (D21); no code path applies the chassis FuelCapacity, but that is an absence of evidence until firing range F1 (powered airtime 1.1 + (C - 2) / 6 s).",
  'Fuel regeneration 0.8/s is the Blueprint default; the refill time (F2) confirms it. Talents, power-ups and fuel module stats (RegenPerSecondChannel, Overfill) are not modelled.',
  "State changes: an event fires inside Inactive's tick and the transition runs at once; the new state's own tick (and so its first thrust) is taken to start on the next update. The state machine's dispatch was not read to that detail.",
  "The jump input: held Space sets the ability's activation-held flag (+0x290) while down; the ability input binding that sets and clears it in game was not traced.",
  'The second condition for leaving Inactive (0x1452d9a80) is taken to be the entry condition (0x1453156f0); "blocked" in Fly (interface slot +0x20) is never true in the MVP.',
  'The state machine starts in Inactive without running its entry (spawn path not read); "enough fuel to jump" starts false, so a jump held from the first update starts on the second.',
  "Thrust arithmetic: float fields are rounded to float32, the products and the vertical speed are in doubles; the binary's precision there was not read (sub-0.01 cm/s effects).",
  "WRF's ApplyAccumulatedForces override (0x14557ae90): it reports the pending force to another component (no movement effect) and, when a flag (+0x1f1c) is set, caps horizontal speed at +0x1f18. Who sets the flag is unread; taken as unset.",
  "Robot spawn: a respawn is a new robot (full fuel, BP_Character's gravity scale, Jump Jet inactive); the game's own respawn path was not read.",
];
