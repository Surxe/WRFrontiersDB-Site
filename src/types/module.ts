import type { LocalizationKey } from './localization';

export interface Module {
  id: string;
  production_status?: boolean | string;
  inventory_icon_path?: string;
  name?: LocalizationKey;
  description?: LocalizationKey;
  module_scalars?: {
    default_scalars?: Record<string, number>;
    [key: string]: any;
  };
}
