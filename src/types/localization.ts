// Should either have InvariantString or the other 3 fields, as a result, all are technically optional. This is validated upon creation in utils/localization.ts, however.
export interface LocalizationKey {
  Key?: string;
  TableNamespace?: string;
  en?: string;
  InvariantString?: string;
}

export interface LocalizationData {
  [namespace: string]: {
    [key: string]: string;
  };
}
