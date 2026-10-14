/**
 * The 3D maps the Parser cooks (WRFrontiersDB-Parser src/parse/maps/cook.py):
 * `Objects/Map.json` lists them, and each map has its files under `Maps/`.
 * File names are relative to the data root (`current/`).
 */
import type { LocalizationKey } from './localization';

/** A game mode playable on a map. */
export interface MapMode {
  /** The mode's own sublevel suffix, e.g. `Spearhead`. */
  id: string;
  name?: LocalizationKey;
  /** `OBJID_GameMode::DA_GameMode_<id>.0`, where the GameMode is parsed. */
  game_mode_ref?: string;
  /** The geometry the mode adds (`Maps/<Map>.<Mode>.glb`), if any. */
  file?: string;
}

/** An entry of `Objects/Map.json`. */
export interface GameMap {
  /** The map's folder, e.g. `Mont`. */
  id: string;
  /** None for the firing range, which the game names nowhere. */
  name?: LocalizationKey;
  /** Whether a matchmaking queue picks the map (not the tutorial or the
   * firing range). */
  queued: boolean;
  files: {
    /** `Maps/<Map>.glb`: the map every match has. */
    base: string;
    /** `Maps/<Map>.json`: the pins (MapPins). */
    pins: string;
    /** `Maps/<Map>.foliage.glb`: trees, bushes and grass, simplified. */
    foliage?: string;
  };
  /** In the queue screen's order. */
  modes: MapMode[];
}

export type Vec3 = [number, number, number];

export type PinType =
  | 'spawn'
  | 'warp_probe'
  | 'beacon'
  | 'powerup_spawner'
  | 'ctf_core'
  | 'ctf_upload_zone'
  | 'drill';

/** A gameplay object of a mode. Unreal units: centimeters, Z up. */
export interface Pin {
  type: PinType;
  /** 0 or 1, for spawns and the CTF objects. */
  team?: number;
  position: Vec3;
  /** Degrees; 0 faces +X. */
  yaw: number;
  /** A warp probe's `Order` or a beacon's `DisplayOrder`. */
  order?: number;
  /** Capture zone (beacon, probe) or damage zone (drill) radius, cm. */
  zone_radius?: number;
  /** Power-ups a spawner spawns (`Objects/Powerup.json` ids). */
  powerup_ids?: string[];
}

/** `Maps/<Map>.json`. */
export interface MapPins {
  version: number;
  input_hash: string;
  map: string;
  units: string;
  /** Min and max corner of the space a match is played in (UE cm); null for
   * a map without a navigation mesh. */
  playable_box: [Vec3, Vec3] | null;
  files: { base: string; foliage: string | null };
  modes: Record<
    string,
    { sublevels: string[]; file: string | null; pins: Pin[] }
  >;
}
