import type { LocalizationKey } from '../types/localization';
import type {
  PilotPersonality,
  PilotClass,
  PilotTalent,
  PilotTalentType,
  Pilot,
} from '../types/pilot';
import type { Module } from '../types/module';
import type { Rarity } from '../types/rarity';
import type { ParseObject } from '../types/parse_object';

// All the data necessary to reference the page in a generic way
export interface ObjRefData {
  localizationKey: LocalizationKey;
  iconPath: string;
  hexColor?: string;
  description?: LocalizationKey;
  useHref?: boolean; // defaults to True
}

// For each class, define a method to retrieve the ObjRefData
export function getObjRefData(_obj: Module): ObjRefData;
export function getObjRefData(_obj: PilotPersonality): ObjRefData;
export function getObjRefData(_obj: PilotClass): ObjRefData;
export function getObjRefData(_obj: PilotTalent): ObjRefData;
export function getObjRefData(_obj: PilotTalentType): ObjRefData;
export function getObjRefData(_obj: Pilot): ObjRefData;
export function getObjRefData(_obj: Rarity): ObjRefData;
export function getObjRefData(_obj: ParseObject): ObjRefData; // Here just for type support. Better than an overload that requires specifying the name of every class.

export function getObjRefData(obj: ParseObject): ObjRefData {
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
        description: module.description,
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
        description: pilotTalent.description,
      };
    }
    case 'PilotTalentType': {
      const pilotTalentType = obj as PilotTalentType;
      return {
        localizationKey: pilotTalentType.name,
        iconPath: pilotTalentType.image_path,
        description: pilotTalentType.description,
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
        useHref: false,
      };
    }
    default:
      throw new Error(`Unsupported parseObjectClass: ${obj.parseObjectClass}`);
  }
}
