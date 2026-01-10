import type { LocalizationKey } from '../types/localization';
import type {
  PilotPersonality,
  PilotClass,
  PilotTalent,
  PilotTalentType,
  PilotType,
  Pilot,
} from '../types/pilot';
import type { Module } from '../types/module';
import type { Rarity } from '../types/rarity';
import type { ParseObject } from '../types/parse_object';

// All the data necessary to reference the page in a generic way
export interface PageRefData {
  localizationKey: LocalizationKey;
  iconPath: string;
  hexColor?: string;
}

// For each class, define a method to retrieve the PageRefData
export function getPageRefData(_obj: Module): PageRefData;
export function getPageRefData(_obj: PilotPersonality): PageRefData;
export function getPageRefData(_obj: PilotClass): PageRefData;
export function getPageRefData(_obj: PilotTalent): PageRefData;
export function getPageRefData(_obj: PilotTalentType): PageRefData;
export function getPageRefData(_obj: PilotType): PageRefData;
export function getPageRefData(_obj: Pilot): PageRefData;
export function getPageRefData(_obj: Rarity): PageRefData;
export function getPageRefData(_obj: ParseObject): PageRefData; // Here just for type support. Better than an overload that requires specifying the name of every class.

export function getPageRefData(obj: ParseObject): PageRefData {
  switch (obj.parseObjectClass) {
    case 'Module': {
      const module = obj as Module;
      if (!module.name) {
        // The only modules without names are ones without production_status=Ready, which are never display
        throw new Error('Module object has no name');
      }
      return {
        localizationKey: module.name,
        iconPath: module.inventory_icon_path,
      };
    }
    case 'PilotClass': {
      const pilotClass = obj as PilotClass;
      return {
        localizationKey: pilotClass.name,
        iconPath: pilotClass.badge.image_path,
        hexColor: pilotClass.badge.hex,
      };
    }
    case 'Pilot': {
      const pilot = obj as Pilot;
      return {
        localizationKey: pilot.first_name,
        iconPath: pilot.image_path,
      };
    }
    case 'PilotTalent': {
      const pilotTalent = obj as PilotTalent;
      return {
        localizationKey: pilotTalent.name,
        iconPath: pilotTalent.image_path,
      };
    }
    case 'PilotType': {
      const pilotType = obj as PilotType;
      return {
        localizationKey: pilotType.name,
        iconPath: '',
      };
    }
    case 'PilotTalentType': {
      const pilotTalentType = obj as PilotTalentType;
      return {
        localizationKey: pilotTalentType.name,
        iconPath: pilotTalentType.image_path,
      };
    }
    case 'PilotPersonality': {
      const pilotPersonality = obj as PilotPersonality;
      return {
        localizationKey: pilotPersonality.name,
        iconPath: pilotPersonality.icon_path,
      };
    }
    case 'Rarity': {
      const rarity = obj as Rarity;
      return {
        localizationKey: rarity.name,
        iconPath: '',
        hexColor: rarity.hex,
      };
    }
    default:
      throw new Error(`Unsupported parseObjectClass: ${obj.parseObjectClass}`);
  }
}
