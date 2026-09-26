/**
 * Query-param contract for the `/models` page.
 *
 * The viewer is the single place three.js runs. Bot and preset detail pages
 * deep-link into it with a plain URL; the viewer reads the initial state from
 * those params and writes control changes back with `history.replaceState` so
 * any customized view stays a copyable link.
 *
 * ## Current params (implemented)
 *
 *   bot        VirtualBot id (e.g. `alpha`). Selects the bot dropdown and scopes
 *              the preset list to that bot's factory presets. Optional when
 *              `preset` is present — the bot is derived from the preset's owning
 *              bot if `bot` is omitted.
 *   preset     CharacterPreset id (e.g. `DA_Preset_Titan_Alpha.0`). The module
 *              graph to resolve — the mount resolver needs the preset's socket
 *              chain, so this is the base every deep link drives off.
 *   mode       `robot` | `preset`. `robot` renders structural module types only
 *              (chassis / shoulder / torso, no weapons); `preset` renders
 *              structural + the preset's actual equipped weapons. Defaults to
 *              `preset` when omitted.
 *   side       `L` | `R` | `Both` — which shoulder(s) to render. Default `Both`.
 *   hitbox     0 | 1 — render collision hitboxes. Default 1.
 *   skeleton   0 | 1 — render the bone skeleton overlay. Default 0.
 *
 * ## Future params (reserved, not yet implemented)
 *
 * The scheme is intentionally a flat, additive namespace so exact per-slot
 * build decisions can be added later without breaking existing links. The
 * planned extensions map a module override onto a preset slot by its index in
 * `preset.modules`:
 *
 *   module.<i>   Replace the module at preset index `i` with a different Module
 *                id (per-module / per-weapon choices).
 *   parent.<i>   Re-parent entry `i` onto another entry's index (which module it
 *                parents off of).
 *   socket.<i>   Change the socket name entry `i` mounts into.
 *
 * `writeModelParams` only ever touches the keys it knows, so any of these future
 * keys already survive a round-trip through the URL before they are implemented.
 */

export type RenderMode = 'robot' | 'preset';
export type ShoulderSide = 'L' | 'R' | 'Both';

export interface ModelQueryParams {
  bot?: string;
  preset?: string;
  mode?: RenderMode;
  side?: ShoulderSide;
  hitbox?: boolean;
  skeleton?: boolean;
}

const MODES: readonly RenderMode[] = ['robot', 'preset'];
const SIDES: readonly ShoulderSide[] = ['L', 'R', 'Both'];

/** Parse the `/models` query string into typed params. Unknown keys are ignored
 * (and preserved by {@link writeModelParams}). */
export function parseModelParams(search: string): ModelQueryParams {
  const sp = new URLSearchParams(search);
  const params: ModelQueryParams = {};

  const bot = sp.get('bot');
  if (bot) params.bot = bot;

  const preset = sp.get('preset');
  if (preset) params.preset = preset;

  const mode = sp.get('mode');
  if (mode === 'robot' || mode === 'preset') params.mode = mode;

  const side = sp.get('side');
  if (side === 'L' || side === 'R' || side === 'Both') params.side = side;

  const hitbox = sp.get('hitbox');
  if (hitbox === '0' || hitbox === '1') params.hitbox = hitbox === '1';

  const skeleton = sp.get('skeleton');
  if (skeleton === '0' || skeleton === '1') params.skeleton = skeleton === '1';

  return params;
}

/**
 * Merge viewer state into the current URL search and replace the history entry
 * (no reload). Only known keys are set/cleared, so unknown or future params are
 * preserved — a URL shared today keeps working as the scheme grows.
 */
export function writeModelParams(state: ModelQueryParams): void {
  const url = new URL(window.location.href);
  const sp = url.searchParams;

  const write = (key: string, value: string | undefined): void => {
    if (value === undefined || value === '') sp.delete(key);
    else sp.set(key, value);
  };

  write('bot', state.bot);
  write('preset', state.preset);
  write('mode', state.mode);
  write('side', state.side);
  write('hitbox', state.hitbox === undefined ? undefined : state.hitbox ? '1' : '0');
  write('skeleton', state.skeleton === undefined ? undefined : state.skeleton ? '1' : '0');

  history.replaceState(null, '', url);
}
