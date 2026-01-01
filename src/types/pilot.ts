import type { LocalizationKey } from './localization';

export interface PilotTalentType {
    id: string;
    name?: LocalizationKey;
    description?: LocalizationKey;
    image_path?: string;
}

export interface PilotType {
    id: string;
    rarity_id: string; // TODO
    name?: LocalizationKey;
    group_reward_id: string; // TODO
    has_extended_bio?: boolean;
    can_change_talents?: boolean;
    sort_order?: number;
}

export interface PilotPersonality {
    id: string;
    icon_path: string;
    name: LocalizationKey;
}

export interface PilotClass {
    id: string;
    name: LocalizationKey;
    badge: {
        image_path: string;
        hex: string;
    }
}

export interface PilotTalent {
    id: string;
    name: LocalizationKey;
    description: LocalizationKey;
    ui_description: LocalizationKey;
    short_ui_description: LocalizationKey;
    image_path: string;
    stats: {
        stat_id: string; // TODO
        value: number;
    }[];
    buffs: {
        Modifier?: number;
        Modifiers?: {
            what: string;
            operator: "Grow" | "Multiply";
            value: number; 
        }[];
        AbilitySelectors?: {
            allowed_placement_types: string[];
            module_tags?: {
                module_tag_id: string;
            }[];
        }[];
        module_tag_selector?: {
            list_operator: string;
            module_tags: {
                module_tag_id: string; // TODO
            }[];
        }
        [key: string]: any;
    }[];
    default_properties?: {
        [key: string]: any;
    };
}