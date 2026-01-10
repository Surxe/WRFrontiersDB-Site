import type { LocalizationKey } from "../types/localization";

export function getDefaultString(localizationKey: LocalizationKey | undefined): string | undefined {
  if (!localizationKey) {
    return undefined;
  }
  if (localizationKey.InvariantString) {
    return localizationKey.InvariantString;
  }
  if (localizationKey.en) {
    return localizationKey.en;
  }

  throw new Error('LocalizationKey has no InvariantString or en field');
}