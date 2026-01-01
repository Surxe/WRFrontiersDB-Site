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