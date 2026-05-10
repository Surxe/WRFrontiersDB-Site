export interface StaticPathsResult {
  params: { id: string };
  props?: Record<string, unknown>;
}

export interface ParseObject {
  parseObjectClass: string;
  id: string;
  production_status?: string;
  [key: string]: unknown;
}
