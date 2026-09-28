import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

/**
 * What a module socket accepts (backs `Objects/ModuleSocketType.json`).
 *
 * A `Module.sockets[].socket_type_ref` points here; the modules that fit are
 * those whose `module_type_ref` is in `compatible_module_types_refs` (or equals
 * `exclusive_module_type_ref`).
 */
export interface ModuleSocketType extends ParseObject {
  parseObjectClass: 'ModuleSocketType';
  id: string;
  name?: LocalizationKey;
  short_name?: LocalizationKey;
  icon_path?: string;
  compatible_module_types_refs?: string[];
  exclusive_module_type_ref?: string;
  /** The slot must always hold a module (chassis torso, shoulders). */
  required?: boolean;
  /** `false` = the game fixes this slot (titan torsos/shoulders). */
  b_can_be_changed_by_user?: boolean;
}
