/**
 * Query-param contract for the `/models` page (docs/models-deep-links.md).
 *
 * Other pages deep-link into the viewer with a plain URL; the page reads its
 * initial state from the params and writes every change back with
 * `history.replaceState`, so the current view is always a copyable link.
 *
 * ## Builds: build codes (written)
 *
 *   a          build A as a build code (robot/build/code.ts)
 *   b          build B as a build code; its presence turns compare on
 *
 * A build that can't be encoded (an unreleased module, or data newer than the
 * registry) is written as readable params instead.
 *
 * ## Builds: readable params (read; written only as the fallback)
 *
 * One param per filled slot, keyed by where it mounts
 * (robot/build/params.ts):
 *
 *   chassis                         root chassis Module id
 *   torso                           torso (mounts at the chassis `Root` socket)
 *   Shoulder_L, Shoulder_R          shoulders (mount on the torso)
 *   Shoulder_L.Shoulder_Weapon_0    weapon in that shoulder's slot
 *   Torso_Weapon_0                  torso-mounted weapon
 *   Ability, UltAbility             supply / cycle gear
 *
 *   compare    1 — compare build A against build B
 *   b.<slot>   B's swaps from A (robot/build/compare.ts); empty = emptied in B
 *
 * Missing required slots are filled with the chassis's own parts; missing
 * optional slots stay empty. When `a` is present the readable build params
 * are ignored.
 *
 * ## View params
 *
 *   layout     side — stand B beside A in the 3D view (default: overlapping).
 *              Only written while comparing.
 *   mesh       0 | 1 — render the module meshes. Default 1.
 *   hitbox     0 | 1 — render collision hitboxes. Default 1.
 *
 * Unknown params (e.g. `lang`) are preserved on write.
 */
import {
  readSelection,
  writeSelection,
  type SlotKeyMatcher,
} from '../robot/build/params';
import {
  readOverrides,
  writeOverrides,
  type BuildOverrides,
} from '../robot/build/compare';
import {
  BuildCodeError,
  TooNew,
  tryEncode,
  type BuildCodec,
} from '../robot/build/code';
import type { BuildSelection } from '../robot/build/types';
import type { CompareLayout } from './render/compare_layout';

const BUILD_A = 'a';
const BUILD_B = 'b';

/** Why the URL's build codes were not used: they need newer data than the
 * site has, or are not build codes at all. */
export type CodeProblem = 'tooNew' | 'invalid';

export interface ModelPageState {
  selection: BuildSelection;
  /** B's overrides while comparing (readable params), else null. */
  compare: BuildOverrides | null;
  /** B as a whole build while comparing (a `b` code); turned into overrides
   * once A is resolved (robot/build/compare.ts `toOverrides`). */
  compareBuild: BuildSelection | null;
  compareLayout: CompareLayout;
  mesh: boolean;
  hitbox: boolean;
  /** Set when the codes could not be read; the page then shows the default
   * robot and says why. */
  codeProblem: CodeProblem | null;
}

/** What the page writes back: A's resolved selection, and while comparing,
 * B both as a resolved selection (for its code) and as overrides (for the
 * readable fallback). */
export interface ModelUrlState {
  selection: BuildSelection;
  compare: { selection: BuildSelection; overrides: BuildOverrides } | null;
  compareLayout: CompareLayout;
  mesh: boolean;
  hitbox: boolean;
}

const FLAGS = ['mesh', 'hitbox'] as const;

function readFlag(params: URLSearchParams, key: string): boolean | null {
  const value = params.get(key);
  return value === '0' || value === '1' ? value === '1' : null;
}

function decode(codec: BuildCodec, code: string): BuildSelection | CodeProblem {
  try {
    return codec.decode(code);
  } catch (err) {
    if (err instanceof TooNew) return 'tooNew';
    if (err instanceof BuildCodeError) return 'invalid';
    throw err;
  }
}

/** The builds a query encodes: codes when `a` is present, else readable
 * params. */
function readBuilds(
  params: URLSearchParams,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec
): Pick<
  ModelPageState,
  'selection' | 'compare' | 'compareBuild' | 'codeProblem'
> {
  const codeA = params.get(BUILD_A);
  if (codeA === null) {
    return {
      selection: readSelection(params, isSlotKey),
      compare:
        readFlag(params, 'compare') === true
          ? readOverrides(params, isSlotKey)
          : null,
      compareBuild: null,
      codeProblem: null,
    };
  }
  const codeB = params.get(BUILD_B);
  const a = decode(codec, codeA);
  const b = codeB === null ? null : decode(codec, codeB);
  if (typeof a === 'string' || typeof b === 'string') {
    const problem = [a, b].includes('tooNew') ? 'tooNew' : 'invalid';
    return {
      selection: {},
      compare: null,
      compareBuild: null,
      codeProblem: problem,
    };
  }
  return { selection: a, compare: null, compareBuild: b, codeProblem: null };
}

/** The page state a query string encodes. */
export function readModelQuery(
  params: URLSearchParams,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec
): ModelPageState {
  return {
    ...readBuilds(params, isSlotKey, codec),
    compareLayout: params.get('layout') === 'side' ? 'side' : 'overlap',
    mesh: readFlag(params, 'mesh') ?? true,
    hitbox: readFlag(params, 'hitbox') ?? true,
  };
}

/**
 * Replace the build params in `params`: codes when every build can be
 * encoded, else readable params. Every other param is left as it is.
 */
export function writeBuildParams(
  params: URLSearchParams,
  builds: Pick<ModelUrlState, 'selection' | 'compare'>,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec | null
): void {
  writeSelection(params, {}, isSlotKey);
  writeOverrides(params, {}, isSlotKey);
  for (const key of [BUILD_A, BUILD_B, 'compare']) params.delete(key);

  const codeA = codec && tryEncode(codec, builds.selection);
  const codeB =
    codec && builds.compare && tryEncode(codec, builds.compare.selection);
  if (codeA && (!builds.compare || codeB)) {
    params.set(BUILD_A, codeA);
    if (codeB) params.set(BUILD_B, codeB);
    return;
  }
  writeSelection(params, builds.selection, isSlotKey);
  if (builds.compare) {
    params.set('compare', '1');
    writeOverrides(params, builds.compare.overrides, isSlotKey);
  }
}

/** Merge the page state into a query (the pure half of writeModelUrl). */
export function writeModelQuery(
  params: URLSearchParams,
  state: ModelUrlState,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec | null
): void {
  writeBuildParams(params, state, isSlotKey, codec);
  params.delete('layout');
  if (state.compare && state.compareLayout === 'side') {
    params.set('layout', 'side');
  }
  for (const flag of FLAGS) params.set(flag, state[flag] ? '1' : '0');
}

/** The page state the current URL encodes. */
export function readModelUrl(
  search: string,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec
): ModelPageState {
  return readModelQuery(new URLSearchParams(search), isSlotKey, codec);
}

/** Merge the page state into the current URL (no reload). */
export function writeModelUrl(
  state: ModelUrlState,
  isSlotKey: SlotKeyMatcher,
  codec: BuildCodec
): void {
  const url = new URL(window.location.href);
  writeModelQuery(url.searchParams, state, isSlotKey, codec);
  history.replaceState(null, '', url);
}

/** Link to the /models page showing `selection`, a resolved build (for deep
 * links from other pages; usable at build time). `codec` null: readable
 * params. */
export function modelsPageHref(
  selection: BuildSelection,
  codec: BuildCodec | null
): string {
  const params = new URLSearchParams();
  writeBuildParams(params, { selection, compare: null }, () => false, codec);
  const query = params.toString();
  return query ? `/models?${query}` : '/models';
}
