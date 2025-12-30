export interface LocalizationKey {
  Key: string;
  TableNamespace: string;
  en: string;
}

export interface LocalizationData {
  [namespace: string]: {
    [key: string]: string;
  };
}
