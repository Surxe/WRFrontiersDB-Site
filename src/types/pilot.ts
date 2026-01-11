import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const PILOTTALENTTYPE_URL = 'pilot_talent_types';
export const PILOTPERSONALITY_URL = 'pilot_personalities';
export const PILOTCLASS_URL = 'pilot_classes';
export const PILOTTALENT_URL = 'pilot_talents';
export const PILOT_URL = 'pilots';

export interface PilotTalentType extends ParseObject {
  parseObjectClass: 'PilotTalentType';
  parseObjectUrl: typeof PILOTTALENTTYPE_URL;
  name: LocalizationKey;
  description: LocalizationKey;
  image_path: string;
}

export interface PilotType extends ParseObject {
  parseObjectClass: 'PilotType';
  rarity_id: string; // TODO
  name: LocalizationKey;
  group_reward_id: string; // TODO
  has_extended_bio?: boolean;
  can_change_talents?: boolean;
  sort_order?: number;
}

export interface PilotPersonality extends ParseObject {
  parseObjectClass: 'PilotPersonality';
  parseObjectUrl: typeof PILOTPERSONALITY_URL;
  icon_path: string;
  name: LocalizationKey;
}

export interface PilotClass extends ParseObject {
  parseObjectClass: 'PilotClass';
  parseObjectUrl: typeof PILOTCLASS_URL;
  name: LocalizationKey;
  badge: {
    image_path: string;
    hex: string;
  };
}

export interface PilotTalent extends ParseObject {
  parseObjectClass: 'PilotTalent';
  parseObjectUrl: typeof PILOTTALENT_URL;
  name: LocalizationKey;
  description: LocalizationKey;
  ui_description?: LocalizationKey;
  short_ui_description?: LocalizationKey;
  image_path: string;
  stats: {
    stat_id: string; // TODO
    value: number;
  }[];
  buffs?: {
    Modifier?: number;
    Modifiers?: {
      what: string;
      operator: 'Grow' | 'Multiply';
      value: number;
    }[];
    AbilitySelectors?: {
      allowed_placement_types: string[];
      module_tags?: {
        module_tag_id: string;
      }[];
    }[];
    module_tag_selector?: {
      list_operator: string;
      module_tags: {
        module_tag_id: string; // TODO
      }[];
    };
    [key: string]: unknown;
  }[];
  target_buffs?: {
    [key: string]: unknown;
  }[];
  cooldown?: number;
  reactivation_policy?: string;
  buff_class?: string;
  default_properties?: {
    [key: string]: unknown;
  };

  // Enriched properties (populated at build time)
  talent_type_id?: string;
  level?: number;
}

export interface Pilot extends ParseObject {
  parseObjectClass: 'Pilot';
  parseObjectUrl: typeof PILOT_URL;
  first_name: LocalizationKey;
  second_name?: LocalizationKey;
  image_path: string;
  bio: LocalizationKey;
  pilot_type_id: string;
  pilot_class_id: string;
  personality_id: string;
  faction_id: string; // TODO
  sell_price: {
    currency_id: string; // TODO
    amount: number;
  };
  levels: {
    talent_type_id: string;
    talents: string[];
    reputation_cost?: number;
    upgrade_cost?: {
      currency_id: string; // TODO
      amount: number;
    }; // Not used in game
  }[];
}
