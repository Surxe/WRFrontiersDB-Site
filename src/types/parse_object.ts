export interface StaticPathsResult {
  params: { id: string; version: string };
  props: { objectVersions: string[] };
}

export interface ParseObject {
  parseObjectClass: string;
  parseObjectUrl?: string;
  id: string;
  production_status?: string;
  [key: string]: unknown;
}
