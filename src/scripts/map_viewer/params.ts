/**
 * Query-param contract for the `/maps` page. The page reads its initial
 * state from the params and writes every change back with
 * `history.replaceState`, as /models does, so the current view is always a
 * copyable link.
 *
 *   map       the map's id (its folder, `Objects/Map.json` key), e.g. Mont.
 *             Default: the first map.
 *   mode      a game mode the map has (MapMode.id), e.g. Spearhead.
 *             Default: the map's first mode.
 *   foliage   0 | 1 — draw trees, bushes and grass. Default 1; only 0 is
 *             written.
 *
 * Unknown params (e.g. `lang`) are preserved on write.
 */
import type { GameMap } from '../../types/map';

export interface MapUrlState {
  map: string | null;
  mode: string | null;
  foliage: boolean;
}

/** The page state a query encodes, as given (not checked against the maps). */
export function readMapQuery(params: URLSearchParams): MapUrlState {
  return {
    map: params.get('map') || null,
    mode: params.get('mode') || null,
    foliage: params.get('foliage') !== '0',
  };
}

/** Merge the page state into a query (the pure half of writeMapUrl). */
export function writeMapQuery(
  params: URLSearchParams,
  state: MapUrlState
): void {
  for (const key of ['map', 'mode', 'foliage'] as const) params.delete(key);
  if (state.map) params.set('map', state.map);
  if (state.mode) params.set('mode', state.mode);
  if (!state.foliage) params.set('foliage', '0');
}

/** The picker's order: the maps the queues pick, by name, then the others
 * (the tutorial, the firing range). `name` gives a map's (English) name. */
export function sortMaps<M extends Pick<GameMap, 'id' | 'queued'>>(
  maps: readonly M[],
  name: (map: M) => string
): M[] {
  return [...maps].sort(
    (a, b) =>
      Number(b.queued) - Number(a.queued) ||
      name(a).localeCompare(name(b), 'en')
  );
}

/** The map and mode to show for a requested pair: the request where the
 * data has it, else the first map / the map's first mode (null: no maps, or a
 * map without game modes). */
export function resolveSelection(
  maps: readonly GameMap[],
  map: string | null,
  mode: string | null
): { map: GameMap | null; mode: string | null } {
  const chosen = maps.find(({ id }) => id === map) ?? maps[0] ?? null;
  if (!chosen) return { map: null, mode: null };
  const modes = chosen.modes.map(({ id }) => id);
  return {
    map: chosen,
    mode: mode !== null && modes.includes(mode) ? mode : (modes[0] ?? null),
  };
}

/** The page state the current URL encodes. */
export function readMapUrl(search: string): MapUrlState {
  return readMapQuery(new URLSearchParams(search));
}

/** Merge the page state into the current URL (no reload). */
export function writeMapUrl(state: MapUrlState): void {
  const url = new URL(window.location.href);
  writeMapQuery(url.searchParams, state);
  history.replaceState(null, '', url);
}
