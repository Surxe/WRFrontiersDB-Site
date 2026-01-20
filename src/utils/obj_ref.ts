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
  text: LocalizationKey;
  textBackgroundColor?: string;
  iconPath?: string;
  iconColor?: string;
  hoverText?: LocalizationKey;
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
        text: module.name,
        iconPath: module.inventory_icon_path,
        hoverText: module.description,
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
      return {
        text: pilot.first_name,
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
    default:
      throw new Error(`Unsupported parseObjectClass: ${obj.parseObjectClass}`);
  }
}
