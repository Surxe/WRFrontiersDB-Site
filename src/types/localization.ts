// Should either have InvariantString or the other 3 fields.
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
