import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';


export interface Currency extends ParseObject {
  parseObjectClass: 'Currency';
  name: LocalizationKey;
  description: LocalizationKey;
  how_to_use_descriptions?: LocalizationKey[];
  where_to_get_descriptions?: LocalizationKey[];
  wallet_icon_path: string;
  large_icon_path: string;
  background_color?: string;
  background_image_path?: string;
  shop_display_priority?: number;
}
