import type { LocalizationKey } from '../types/localization';
import type {
  PilotPersonality,
  PilotClass,
  PilotTalent,
  PilotTalentType,
  Pilot,
} from '../types/pilot';
import type { Module, ModuleCategory } from '../types/module';
import type { Rarity } from '../types/rarity';
import type { CharacterPreset } from '../types/character_preset';
import type { ParseObject } from '../types/parse_object';
import { getCoreModuleCategory } from './core_modules';
import { getParseObject } from './parse_object';
import { refToId } from './object_reference';
import type { VirtualBot } from '../types/virtual_bot';
import type { ModuleGroup } from '../types/module_group';
import type { Currency } from '../types/currency';

// All the data necessary to reference the page in a generic way
export interface ObjRefData {
  text: LocalizationKey | LocalizationKey[];
  textBackgroundColor?: string;
  iconPath?: string;
  iconColor?: string;
  hoverText?: LocalizationKey;
}

// For each class, define a method to retrieve the ObjRefData
export function getObjRefData(_obj: Module): ObjRefData;
export function getObjRefData(_obj: ModuleCategory): ObjRefData;
export function getObjRefData(_obj: PilotPersonality): ObjRefData;
export function getObjRefData(_obj: PilotClass): ObjRefData;
export function getObjRefData(_obj: PilotTalent): ObjRefData;
export function getObjRefData(_obj: PilotTalentType): ObjRefData;
export function getObjRefData(_obj: Pilot): ObjRefData;
export function getObjRefData(_obj: Rarity): ObjRefData;
export function getObjRefData(_obj: Currency): ObjRefData;
export function getObjRefData(_obj: ParseObject): ObjRefData; // Here just for type support. Better than an overload that requires specifying the name of every class.

export function getObjRefData(obj: ParseObject): ObjRefData {
  switch (obj.parseObjectClass) {
    case 'Module': {
      const module = obj as Module;
      if (!module.name) {
        // The only modules without names are ones without production_status=Ready, which are never display
        throw new Error('Module object has no name');
      }

      // Check if this is a core module using virtual_bot_ref
      if (module.virtual_bot_ref && module.module_group_ref) {
        try {
          const group = getParseObject<ModuleGroup>(
            refToId(module.module_group_ref),
            'Objects/ModuleGroup.json'
          );

          let texts: LocalizationKey[] = [module.name as LocalizationKey];

          // Add shoulder side if applicable
          if (module.shoulder_side === 'L') {
            texts.push({
              Key: 'Socket_Left',
              TableNamespace: 'Web_UI',
              en: 'Left',
            } as LocalizationKey);
          } else if (module.shoulder_side === 'R') {
            texts.push({
              Key: 'Socket_Right',
              TableNamespace: 'Web_UI',
              en: 'Right',
            } as LocalizationKey);
          }

          // Add group name if not a titan weapon
          if (group && group.name && group.id !== 'titan-weapon') {
            texts.push(group.name as LocalizationKey);
          }

          return {
            text: texts,
            iconPath: module.inventory_icon_path,
            hoverText: module.description || undefined,
          };
        } catch {
          // Fallback to category
          const category = getCoreModuleCategory(module);
          if (category) {
            return {
              text: [
                module.name as LocalizationKey,
                category.name as LocalizationKey,
              ],
              iconPath: module.inventory_icon_path,
              hoverText: module.description || undefined,
            };
          }
        }
      }

      return {
        text: module.name,
        iconPath: module.inventory_icon_path,
        hoverText: module.description,
      };
    }
    case 'ModuleCategory': {
      const moduleCategory = obj as ModuleCategory;
      if (!moduleCategory.name) {
        throw new Error('ModuleCategory object has no name');
      }
      return {
        text: moduleCategory.name,
        iconPath: moduleCategory.icon_path,
        hoverText: moduleCategory.description,
      };
    }
    case 'PilotClass': {
      const pilotClass = obj as PilotClass;
      return {
        text: pilotClass.name,
        iconPath: pilotClass.badge.image_path,
        iconColor: pilotClass.badge.hex,
      };
    }
    case 'Pilot': {
      const pilot = obj as Pilot;
      const text: LocalizationKey[] = [pilot.first_name];
      if (pilot.second_name) {
        text.push(pilot.second_name);
      }

      return {
        text: text,
        iconPath: pilot.image_path,
      };
    }
    case 'PilotTalent': {
      const pilotTalent = obj as PilotTalent;
      return {
        text: pilotTalent.name,
        iconPath: pilotTalent.image_path,
        hoverText: pilotTalent.description,
      };
    }
    case 'PilotTalentType': {
      const pilotTalentType = obj as PilotTalentType;
      return {
        text: pilotTalentType.name,
        iconPath: pilotTalentType.image_path,
        hoverText: pilotTalentType.description,
      };
    }
    case 'PilotPersonality': {
      const pilotPersonality = obj as PilotPersonality;
      return {
        text: pilotPersonality.name,
        iconPath: pilotPersonality.icon_path,
      };
    }
    case 'Rarity': {
      const rarity = obj as Rarity;
      return {
        text: rarity.name,
        textBackgroundColor: rarity.hex,
      };
    }
    case 'CharacterPreset': {
      const characterPreset = obj as CharacterPreset;

      // For AI bots with weapon_module_ref, include the weapon name
      if (
        !characterPreset.is_factory_preset &&
        characterPreset.weapon_module_ref
      ) {
        try {
          const weaponModule = getParseObject(
            refToId(characterPreset.weapon_module_ref),
            'Objects/Module.json'
          );

          if (weaponModule && weaponModule.name) {
            return {
              text: [
                characterPreset.name,
                weaponModule.name as LocalizationKey,
              ],
              iconPath: characterPreset.icon || undefined,
            };
          }
        } catch {
          // If weapon module not found, fallback to just the preset name
        }
      }

      return {
        text: characterPreset.name,
        iconPath: characterPreset.icon || undefined,
      };
    }
    case 'ModuleGroup': {
      const moduleGroup = obj as unknown as ModuleGroup;
      return {
        text: moduleGroup.name,
      };
    }
    case 'NavigationLink': {
      return {
        text: obj.name as LocalizationKey,
        iconPath: undefined,
      };
    }
    case 'VirtualBot': {
      const virtualBot = obj as unknown as VirtualBot;
      return {
        text: virtualBot.name as LocalizationKey,
        iconPath: virtualBot.icon_path, // Use icon from VirtualBot object
      };
    }
    case 'Currency': {
      const currency = obj as unknown as Currency;
      if (!currency.name) {
        throw new Error('Currency object has no name');
      }
      return {
        text: currency.name,
        iconPath: currency.wallet_icon_path,
        hoverText: currency.description,
      };
    }
    default:
      throw new Error(`Unsupported parseObjectClass: ${obj.parseObjectClass}`);
  }
}
