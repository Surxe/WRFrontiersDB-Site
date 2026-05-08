import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export const FACTION_URL = 'factions';

export interface Faction extends ParseObject {
  parseObjectClass: 'Faction';
  parseObjectUrl: typeof FACTION_URL;
  image_path: string;
  color: Color;
  badge: {
    image_path: string;
    color: Color;
  };
  name: LocalizationKey;
}
