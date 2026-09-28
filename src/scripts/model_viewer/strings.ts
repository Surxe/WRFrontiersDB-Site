/**
 * Every piece of UI text on the /models page, as localization keys: the game's
 * own strings where it has one, else the site's (public/locales, `Web_UI`).
 *
 * One catalog serves both halves of the page: the Astro components render these
 * with LocalizedText (resolved to English at build time), and the page passes
 * the resolved catalog to the client, where text built at runtime goes through
 * the same keys in the reader's language (see ModelText).
 */
import type {
  LocalizationData,
  LocalizationKey,
} from '../../types/localization';
import { localizeKey } from '../localization';

/** A localization key without its resolved text. */
export interface LocalizationRef {
  Key: string;
  TableNamespace: string;
}

const site = (Key: string): LocalizationRef => ({
  Key,
  TableNamespace: 'Web_UI',
});

export const MODEL_STRINGS = {
  // Page
  title: site('Models_Title'),
  metaDescription: site('Models_Meta_Description'),
  intro: site('Models_Intro'),
  controlsHint: site('Models_Controls_Hint'),
  viewerLabel: site('Models_Viewer_Label'),
  viewRobotLink: site('Models_View_Robot_Link'),
  viewLoadoutLink: site('Models_View_Loadout_Link'),

  // Build panel
  buildPanel: site('Models_Build_Panel'),
  build: site('Models_Build'),
  buildA: site('Models_Build_A'),
  buildB: site('Models_Build_B'),
  compare: site('Models_Compare'),
  compareStart: site('Models_Compare_Start'),
  compareStop: site('Models_Compare_Stop'),
  resetB: site('Models_Reset_B'),
  compareHint: site('Models_Compare_Hint'),
  mesh: site('Models_Mesh'),
  hitbox: site('Models_Hitbox'),
  clearBuild: site('Models_Clear_Build'),
  clearBuildTitle: site('Models_Clear_Build_Title'),
  share: site('Models_Share'),
  shareTitle: site('Models_Share_Title'),
  shareCopied: site('Models_Share_Copied'),
  shareFailed: site('Models_Share_Failed'),
  loadingParts: site('Models_Loading_Parts'),

  // Build slots and part pickers
  chassis: { Key: 'HNG_Chassis', TableNamespace: 'Component_Tags' },
  weaponSlot: site('Models_Weapon_Slot'),
  empty: { Key: 'HNG_Empty', TableNamespace: 'UI_Generic' },
  robots: { Key: 'WorkshopRedesign_Robots', TableNamespace: 'UI_Robodex' },
  titans: { Key: 'Workshop_Robodex_Titans', TableNamespace: 'UI_Robodex' },
  unreleased: site('Models_Unreleased'),
  fixed: site('Models_Fixed'),
  fixedTitle: site('Models_Fixed_Title'),
  changed: site('Models_Changed'),
  useA: site('Models_Use_A'),
  useATitle: site('Models_Use_A_Title'),
  searchParts: site('Models_Search_Parts'),
  noMatchingParts: site('Models_No_Matching_Parts'),

  // Hitbox area panel
  hitboxArea: site('Models_Hitbox_Area'),
  cameraMode: site('Models_Camera_Mode'),
  mode3d: site('Models_Mode_3D'),
  mode2d: site('Models_Mode_2D'),
  cameraSide: site('Models_Camera_Side'),
  viewFront: site('Models_View_Front'),
  viewBack: site('Models_View_Back'),
  viewLeft: site('Models_View_Left'),
  viewRight: site('Models_View_Right'),
  viewTop: site('Models_View_Top'),
  viewSide: site('Models_View_Side'),
  view: site('Models_View'),
  showView: site('Models_Show_View'),
  comparedArea: site('Models_Compared_Area'),
  compareHeadline: site('Models_Compare_Headline'),
  withWeapons: site('Models_With_Weapons'),
  alone: site('Models_Alone'),
  diffShared: site('Models_Diff_Shared'),
  diffAOnly: site('Models_Diff_A_Only'),
  diffBOnly: site('Models_Diff_B_Only'),
  measuring: site('Models_Measuring'),
  noHitboxes: site('Models_No_Hitboxes'),
  wholeRobot: site('Models_Whole_Robot'),
  wholeRobotDetail: site('Models_Whole_Robot_Detail'),
  weapons: { Key: 'INV_Weapons', TableNamespace: 'UI_ConstructorInventory' },
  noWeapons: site('Models_No_Weapons'),
  none: site('Models_None'),
  aOnly: site('Models_A_Only'),
  bOnly: site('Models_B_Only'),
  notesArea: site('Models_Notes_Area'),
  notesAlone: site('Models_Notes_Alone'),
  notesWithWeapons: site('Models_Notes_With_Weapons'),
  notesWholeRobot: site('Models_Notes_Whole_Robot'),
  notes2d: site('Models_Notes_2D'),
  notes3d: site('Models_Notes_3D'),
  notesCompare: site('Models_Notes_Compare'),

  // Health pools
  poolTorso: { Key: 'HNG_Torso', TableNamespace: 'Component_Tags' },
  poolShoulder: { Key: 'HNG_Shoulder', TableNamespace: 'Component_Tags' },
  poolLeftShoulder: { Key: 'HNG_ShoulderL', TableNamespace: 'Component_Tags' },
  poolRightShoulder: { Key: 'HNG_ShoulderR', TableNamespace: 'Component_Tags' },
  poolPelvis: site('Models_Pool_Pelvis'),
  poolLeftLeg: site('Models_Pool_Left_Leg'),
  poolRightLeg: site('Models_Pool_Right_Leg'),

  // Status line
  loadingViewer: site('Models_Loading_Viewer'),
  statusLoading: site('Models_Status_Loading'),
  statusNoData: site('Models_Status_No_Data'),
  statusNoWebGl: site('Models_Status_No_WebGL'),
  statusMissingModels: site('Models_Status_Missing_Models'),
  statusBuildFailed: site('Models_Status_Build_Failed'),
  statusInitFailed: site('Models_Status_Init_Failed'),
} as const satisfies Record<string, LocalizationRef>;

export type ModelStringId = keyof typeof MODEL_STRINGS;

/** The catalog with each key's English text resolved (at build time). */
export type ModelStrings = Record<ModelStringId, LocalizationKey>;

/** Embedded values for a string's `{placeholders}`. */
export type Embeds = Readonly<Record<string, string | number>>;

/** Fill a template's `{name}` placeholders. */
export function fillTemplate(template: string, embeds: Embeds = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(embeds, name) ? String(embeds[name]) : match
  );
}

/**
 * The page's text in the reader's language: the catalog's strings, plus any
 * other localization key (a module's name, a socket type's). Falls back to
 * English where the language lacks a string.
 */
export class ModelText {
  constructor(
    private readonly strings: ModelStrings,
    private readonly data: LocalizationData | null
  ) {}

  t(id: ModelStringId, embeds?: Embeds): string {
    return fillTemplate(this.text(this.strings[id]), embeds);
  }

  text(key: LocalizationKey): string {
    return localizeKey(key, this.data);
  }
}

/** Read the catalog the page embeds as JSON (`data-strings`, models.astro). */
export function parseModelStrings(json: string): ModelStrings {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('model strings: not an object');
  }
  const missing = Object.keys(MODEL_STRINGS).filter(
    (id) => !Object.hasOwn(parsed, id)
  );
  if (missing.length > 0) {
    throw new Error(`model strings: missing ${missing.join(', ')}`);
  }
  // Every id is present; each value is a LocalizationKey from the build.
  return parsed as ModelStrings;
}
