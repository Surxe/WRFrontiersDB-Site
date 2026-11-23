/**
 * What the Jump Jet, dash and fuel port does not establish (the fidelity
 * rule, stages/mvp.md): shown in drive mode's details (H) and the console,
 * never filled in by estimate.
 *
 * Closed by MVP session 5's static reads (findings/jump-fuel.md, 2026-11-22
 * note): the state-machine dispatch (a transition runs at once, the new
 * state ticks from the next update), the second condition for leaving
 * Inactive (`0x1452d9a80` = the current state's entry condition and not
 * blocked), the initial state set without its entry (`0x1452fe4e0`), the
 * ability order (the dash before the Jump Jet) and regeneration before the
 * ability ticks.
 */
export const ABILITY_KNOWN_GAPS: readonly string[] = [
  "Gravity scale before any jump: BP_Character's 1.2, after a Jump or Fly exit the native 1.0, as the code says; neither is measured (firing range G1, G2). Tap-jump airtime is 3.30 s if 1.2 applies before the jump, 3.76 s if 1.0 throughout (J1).",
  "Fuel maximum: BP_Character's 16 for every chassis (D21); no code path applies the chassis FuelCapacity, but that is an absence of evidence until firing range F1 (powered airtime 1.1 + (C - 2) / 6 s).",
  'Fuel regeneration 0.8/s is the Blueprint default; the refill time (F2) confirms it. Talents, power-ups and fuel module stats (RegenPerSecondChannel, Overfill, the UsageFuelCost stat channel at ASCharacter+0xa58) are not modelled: the channels pass values through.',
  "The jump input: held Space sets the ability's activation-held flag (+0x290) while down; the ability input binding that sets and clears it in game was not traced.",
  "Thrust arithmetic: float fields are rounded to float32, the products and the vertical speed are in doubles; the binary's precision there was not read (sub-0.01 cm/s effects).",
  "WRF's ApplyAccumulatedForces override (0x14557ae90): it reports the pending force to another component (no movement effect) and, when a flag (+0x1f1c) is set, caps horizontal speed at +0x1f18. Who sets the flag is unread; taken as unset.",
  "Robot spawn: a respawn is a new robot (full fuel, BP_Character's gravity scale, Jump Jet and dash inactive with no cooldown); the game's own respawn path was not read.",
  "Dash top speed: the first action's MaxSpeedModifier (Add 3000 for most chassis, 2500 for Alpha and Matriarch) is taken to add to MaxSpeedChannel's value, on the ground and in the air; the channel's operators are unread (firing range D2: HUD speed through a W dash from standstill and from top speed).",
  "Dash direction: ported from the decompile (player path: aim flattened on the ground, pitched in the air, turned by the input's yaw in the aim's frame, z clamped to [-|aim2D . base2D|, 0]); the end-to-end result is unmeasured (firing range D1: W, A, S, D and none, looking level, up and down, on the ground and in the air).",
  "Dash aim: the game aims from the capsule at its aim component's target point (ASCharacter+0x1010, an interface at +0x98 slot +0x20, unread); the simulator uses the view's forward, i.e. that target infinitely far along the view ray. A near target (a wall in front) or the game's camera offset would tilt the real aim.",
  "Dash input: a Left Shift press sets the ability's activation flag (+0x290) and a release clears it; Inactive's entry clears it too (code), so holding Shift dashes once, and a press during the cooldown dashes when it ends. The game's input binding that sets the flag was not traced (firing range: hold Shift through the cooldown).",
  "Dash activation's alive check (ASCharacter+0x690, 0x145595380) is taken as passing; when it fails the game skips DoActivate, the duration and the cooldown.",
  "Dash rotation arithmetic: sin and cos are correctly rounded and the 4x4 inverse is UE's FMath::MatrixInverse; the game's Windows CRT sincos may differ in the last bit (sub-1e-12 effects on the direction).",
  'Networking: the dash runs as on the owning client and the server alike (both take the authority/autonomous paths); server corrections are not modelled.',
];
