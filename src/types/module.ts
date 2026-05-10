import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface ModuleStat extends ParseObject {
  parseObjectClass: 'ModuleStat';
  id: string;
  stat_name: LocalizationKey;
  short_key: string;
  unit_name?: LocalizationKey;
  unit_scaler?: number;
  unit_exponent?: number;
  unit_baseline?: number;
  unit_pattern?: LocalizationKey;
  decimal_places?: number;
  more_is_better?: boolean;
  max_stat_value_ui?: number;
  max_stat_titan_value_ui?: number;
}

export interface ModuleRarity extends ParseObject {
  parseObjectClass: 'ModuleRarity';
  id: string;
  rarity_ref: string;
  sort_order: number;
}

export interface Module extends ParseObject {
  parseObjectClass: 'Module';
  production_status?: string;
  inventory_icon_path: string;
  module_rarity_ref: string;
  character_module_mounts: Array<{
    character_module_ref: string;
    mount: string;
  }>;
  module_tags_refs?: string[];
  name?: LocalizationKey; // TODO InvariantString support
  description?: LocalizationKey;
  text_tags?: LocalizationKey[];
  module_scalars: {
    default_scalars?: Record<string, unknown>;
    primary_stat_ref?: string;
    secondary_stat_ref?: string;
    levels?: {
      constants: Record<string, unknown>;
      variables?: Array<{
        upgrade_cost_ref?: string;
        scrap_rewards_refs?: string[];
        [key: string]: unknown;
      }>;
    };
    module_name?: string;
  };
  abilities_scalars?: Array<{
    primary_stat_ref?: string;
    secondary_stat_ref?: string;
    levels?: {
      constants: Record<string, unknown>;
      variables?: Array<{
        upgrade_cost_ref?: string;
        scrap_rewards_refs?: string[];
        [key: string]: unknown;
      }>;
    };
    default_scalars?: Record<string, unknown>;
  }>;
  faction_ref: string;
  module_classes_refs?: string[];
  module_stats_table_ref?: string;
  module_type_ref: string;
  module_socket_type_refs?: string[];
  module_group_ref?: string;
  virtual_bot_ref?: string;
  shoulder_side?: 'L' | 'R';
}

export interface ModuleCategory extends ParseObject {
  parseObjectClass: 'ModuleCategory';
  id: string;
  name: LocalizationKey;
  blueprint_name: LocalizationKey;
  tag_color?: string;
  tag_background_color?: string;
  icon_path: string;
  description: string;
}

export interface ModuleType extends ParseObject {
  parseObjectClass: 'ModuleType';
  id: string;
  module_category_ref: string;
  name: LocalizationKey;
  blueprint_name: LocalizationKey;
  tag_color?: string;
  tag_background_color?: string;
}

export interface ModuleRarity extends ParseObject {
  parseObjectClass: 'ModuleRarity';
  id: string;
  rarity_ref: string;
  sort_order: number;
}

export interface ModuleStatsTable extends ParseObject {
  parseObjectClass: 'ModuleStatsTable';
  id: string;
  stats_refs: Record<string, string>;
}

export interface ModuleClass extends ParseObject {
  parseObjectClass: 'ModuleClass';
  id: string;
  character_class_ref: string;
}
