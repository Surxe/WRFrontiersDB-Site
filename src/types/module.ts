import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
// TODO verify which are optional
export interface Module extends ParseObject {
  parseObjectClass: 'Module';
  production_status?: string;
  inventory_icon_path: string;
  module_rarity_id: string;
  character_module_mounts: Array<{
    character_module_id: string;
    mount: string;
  }>;
  module_tags_ids?: string[];
  name?: LocalizationKey; // TODO InvariantString support
  description?: LocalizationKey;
  text_tags?: LocalizationKey[];
  module_scalars: {
    default_scalars?: Record<string, unknown>;
    primary_stat_id?: string;
    secondary_stat_id?: string;
    levels?: {
      constants: Record<string, unknown>;
      variables?: Array<Record<string, unknown>>;
    };
    module_name?: string;
  };
  abilities_scalars?: unknown; // TODO
  faction_id: string;
  module_classes_ids: string[];
  module_stats_table_id?: string;
  module_type_id: string;
  module_socket_type_ids?: string[];
}
