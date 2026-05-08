import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const FACTION_URL = 'factions';

export interface Faction extends ParseObject {
  parseObjectClass: 'Faction';
  parseObjectUrl: typeof FACTION_URL;
  image_path: string;
  color: {
    RGBA: {
      R: number;
      G: number;
      B: number;
      A: number;
    };
    Hex: string;
  };
  badge: {
    image_path: string;
    color: {
      RGBA: {
        R: number;
        G: number;
        B: number;
        A: number;
      };
      Hex: string;
    };
  };
  name: LocalizationKey;
}
