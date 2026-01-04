import type { LocalizationKey } from '../types/localization';
import type { 
  PilotPersonality, 
  PilotClass, 
  PilotTalent, 
  PilotTalentType,
  PilotType,
  Pilot
} from '../types/pilot';
import type { Module } from '../types/module';
import type { ParseObject } from '../types/parse_object';

// All the data necessary to reference the page in a generic way
export interface PageRefData {
  localizationKey: LocalizationKey;
  iconPath: string;
  hexColor?: string;
}

// For each class, define a method to retrieve the PageRefData
export function getPageRefData(obj: Module): PageRefData;
export function getPageRefData(obj: PilotPersonality): PageRefData;
export function getPageRefData(obj: PilotClass): PageRefData;
export function getPageRefData(obj: PilotTalent): PageRefData;
export function getPageRefData(obj: PilotTalentType): PageRefData;
export function getPageRefData(obj: PilotType): PageRefData;
export function getPageRefData(obj: Pilot): PageRefData;
export function getPageRefData(obj: ParseObject): PageRefData; // Here just for type support. Better than an overload that requires specifying the name of every class.

export function getPageRefData(
  obj: ParseObject
): PageRefData {
  switch (obj.parseObjectClass) {
    case 'Module':
      if (!obj.name) { // a small # of modules don't have a name, like DA_Module_Weapon_RetributionAutoAim.0
        return {
          localizationKey: { Key: 'NoName', TableNamespace: '', en: 'NoName' },
          iconPath: obj.inventory_icon_path
        };
      }
      return {
        localizationKey: obj.name,
        iconPath: obj.inventory_icon_path
      };
    case 'PilotClass':
      return {
        localizationKey: obj.name,
        iconPath: obj.badge.image_path,
        hexColor: obj.badge.hex
      };
    
    case 'Pilot':
      return {
        localizationKey: obj.first_name,
        iconPath: obj.image_path
      };
    
    case 'PilotTalent':
      return {
        localizationKey: obj.name,
        iconPath: obj.image_path
      };
    
    case 'PilotType':
      return {
        localizationKey: obj.name,
        iconPath: ''
      };
    
    case 'PilotTalentType':
      return {
        localizationKey: obj.name,
        iconPath: obj.image_path
      };
    
    case 'PilotPersonality':
      return {
        localizationKey: obj.name,
        iconPath: obj.icon_path
      };
    
    default:
      throw new Error(`Unsupported parseObjectClass: ${obj.parseObjectClass}`);
  }
}