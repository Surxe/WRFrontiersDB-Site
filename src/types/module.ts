import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface Module extends ParseObject {
  production_status?: string;
  inventory_icon_path?: string;
  module_rarity_id?: string;
  character_module_mounts?: Array<{
    character_module_id: string;
    mount: string;
  }>;
  module_tags_ids?: string[];
  name?: LocalizationKey;
  description?: LocalizationKey;
  module_scalars?: {
    default_scalars?: Record<string, any>;
    primary_stat_id?: string;
    secondary_stat_id?: string;
    levels?: {
      constants: Record<string, number>;
      variables: Record<string, number>;
    };
    module_name?: string;
  };
  faction_id?: string;
  module_classes_ids?: string[];
  module_stats_table_id?: string;
  module_type_id?: string;
}
