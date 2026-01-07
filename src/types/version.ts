// All versions, plus conveniently a specific version for that page
export interface VersionsData {
  versions: Record<string, VersionInfo>;
  versionInfo: VersionInfo;
}

// Metadata for a specific version
export interface VersionInfo {
  title: string;
  date_utc: string;
  manifest_id: string;
  patch_notes_url?: string;
  is_season_release?: boolean;
}