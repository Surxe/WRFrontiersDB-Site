import type { LocalizationKey } from './localization';

export interface PilotTalentType {
    id: string;
    name?: LocalizationKey;
    description?: LocalizationKey;
    image_path?: string;
}

export interface PilotType {
    id: string;
    rarity_id: string;
    name?: LocalizationKey;
    group_reward_id: string;
    has_extended_bio?: boolean;
    can_change_talents?: boolean;
    sort_order?: number;
}