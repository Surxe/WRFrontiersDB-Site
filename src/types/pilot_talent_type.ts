import type { LocalizationKey } from './localization';

export interface PilotTalentType {
    id: string;
    name?: LocalizationKey;
    description?: LocalizationKey;
    image_path?: string;
}
