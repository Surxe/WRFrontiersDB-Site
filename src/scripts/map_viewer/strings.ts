/**
 * Every piece of UI text on the /maps page, as localization keys (the site's
 * own, public/locales `Web_UI`), served the way /models serves its catalog
 * (model_viewer/strings.ts): rendered by LocalizedText at build time, and
 * passed to the client for text built at runtime.
 */
import type {
  LocalizationData,
  LocalizationKey,
} from '../../types/localization';
import { localizeKey } from '../localization';
import {
  fillTemplate,
  type Embeds,
  type LocalizationRef,
} from '../model_viewer/strings';

const site = (Key: string): LocalizationRef => ({
  Key,
  TableNamespace: 'Web_UI',
});

export const MAP_STRINGS = {
  // Page
  title: site('Maps_Title'),
  metaDescription: site('Maps_Meta_Description'),
  intro: site('Maps_Intro'),
  desktopOnly: site('Maps_Desktop_Only'),
  map: site('Maps_Map'),
  mode: site('Maps_Mode'),
  noModes: site('Maps_No_Modes'),
  foliage: site('Maps_Foliage'),
  firingRange: site('Maps_Firing_Range'),
  viewerLabel: site('Maps_Viewer_Label'),
  fullscreenEnter: site('Models_Fullscreen_Enter'),
  fullscreenExit: site('Models_Fullscreen_Exit'),
  fly: site('Maps_Fly'),
  flyHint: site('Maps_Fly_Hint'),
  speed: site('Maps_Speed'),

  // Controls
  controls: site('Maps_Controls'),
  controlMove: site('Maps_Control_Move'),
  controlLook: site('Maps_Control_Look'),
  controlUpDown: site('Maps_Control_Up_Down'),
  controlFast: site('Maps_Control_Fast'),
  controlSpeed: site('Maps_Control_Speed'),
  controlRelease: site('Maps_Control_Release'),
  controlFullscreen: site('Maps_Control_Fullscreen'),

  // Pins
  pins: site('Maps_Pins'),
  teamBlue: site('Maps_Team_Blue'),
  teamRed: site('Maps_Team_Red'),
  pinWarpProbe: site('Maps_Pin_Warp_Probe'),
  pinBeacon: site('Maps_Pin_Beacon'),
  pinPowerup: site('Maps_Pin_Powerup'),
  pinDrill: site('Maps_Pin_Drill'),
  pinShapes: site('Maps_Pin_Shapes'),
  beaconLabel: site('Maps_Beacon_Label'),
  probeLabel: site('Maps_Probe_Label'),

  // Status line
  loadingViewer: site('Maps_Loading_Viewer'),
  statusLoading: site('Maps_Status_Loading'),
  statusLoadingMap: site('Maps_Status_Loading_Map'),
  statusNoData: site('Maps_Status_No_Data'),
  statusNoWebGl: site('Maps_Status_No_WebGL'),
  statusLoadFailed: site('Maps_Status_Load_Failed'),
  statusInitFailed: site('Maps_Status_Init_Failed'),
} as const satisfies Record<string, LocalizationRef>;

export type MapStringId = keyof typeof MAP_STRINGS;

/** The catalog with each key's English text resolved (at build time). */
export type MapStrings = Record<MapStringId, LocalizationKey>;

export function isMapStringId(id: unknown): id is MapStringId {
  return typeof id === 'string' && Object.hasOwn(MAP_STRINGS, id);
}

/** The page's text in the reader's language (English where it lacks one). */
export class MapText {
  constructor(
    private readonly strings: MapStrings,
    private readonly data: LocalizationData | null
  ) {}

  t(id: MapStringId, embeds?: Embeds): string {
    return fillTemplate(this.text(this.strings[id]), embeds);
  }

  text(key: LocalizationKey): string {
    return localizeKey(key, this.data);
  }
}

/** Read the catalog the page embeds as JSON (`data-strings`, maps.astro). */
export function parseMapStrings(json: string): MapStrings {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('map strings: not an object');
  }
  const missing = Object.keys(MAP_STRINGS).filter(
    (id) => !Object.hasOwn(parsed, id)
  );
  if (missing.length > 0) {
    throw new Error(`map strings: missing ${missing.join(', ')}`);
  }
  // Every id is present; each value is a LocalizationKey from the build.
  return parsed as MapStrings;
}
