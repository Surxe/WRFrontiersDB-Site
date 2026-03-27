import type { LocalizationKey } from './localization';

export interface StatValueChoices {
  [stat_id: string]: {
    pattern: string;
    unitName?: LocalizationKey;
    unitExponent?: number;
    decimalPlaces?: number;
    shortKey: string;
    choices: {
      [choiceIndex: number]: number;
    };
  };
}
