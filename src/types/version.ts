export interface VersionsData {
  versions: Record<string, any>;
  versionInfo: VersionInfo;
}

export interface VersionInfo {
  title: string;
  date_utc: string;
  manifest_id: string;
  patch_notes_url?: string;
  is_season_release?: boolean;
}