import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export interface PilotTalentType extends ParseObject {
  parseObjectClass: 'PilotTalentType';
  name: LocalizationKey;
  description: LocalizationKey;
  image_path: string;
}

export interface PilotType extends ParseObject {
  parseObjectClass: 'PilotType';
  rarity_ref: string;
  name: LocalizationKey;
  group_reward_ref: string;
  has_extended_bio?: boolean;
  can_change_talents?: boolean;
  sort_order?: number;
}

export interface PilotPersonality extends ParseObject {
  parseObjectClass: 'PilotPersonality';
  icon_path: string;
  name: LocalizationKey;
}

export interface PilotClass extends ParseObject {
  parseObjectClass: 'PilotClass';
  name: LocalizationKey;
  badge: {
    image_path: string;
    color: Color;
  };
}

export interface PilotTalent extends ParseObject {
  parseObjectClass: 'PilotTalent';
  name: LocalizationKey;
  description: LocalizationKey;
  ui_description?: LocalizationKey;
  short_ui_description?: LocalizationKey;
  image_path: string;
  stats: {
    stat_ref: string;
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
        module_tag_ref: string;
      }[];
    }[];
    module_tag_selector?: {
      list_operator: string;
      module_tags: {
        module_tag_ref: string;
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
  effect_offset?: {
    X: number;
    Y: number;
    Z: number;
  };
  default_properties?: {
    [key: string]: unknown;
  };

  // Enriched properties (populated by Parser)
  talent_type_ref?: string;
  level?: number;
  pilots_with_this_talent?: PilotWithTalentInfo[];
}

export interface PilotWithTalentInfo {
  pilot_ref: string;
  talent_index: number;
}

export interface Pilot extends ParseObject {
  parseObjectClass: 'Pilot';
  first_name: LocalizationKey;
  second_name?: LocalizationKey;
  image_path: string;
  bio: LocalizationKey;
  pilot_type_ref: string;
  pilot_class_ref: string;
  personality_ref: string;
  faction_ref: string; // TODO Site-implementation
  sell_price: {
    currency_ref: string; // TODO Site-implementation
    amount: number;
  };
  levels: {
    talent_type_ref: string;
    talents_refs: string[];
    reputation_cost?: number;
    upgrade_cost?: {
      currency_ref: string; // TODO Site-implementation
      amount: number;
    }; // Not used in game
  }[];
}
