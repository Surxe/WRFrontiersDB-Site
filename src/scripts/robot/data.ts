/**
 * Runtime (browser) access to the game data a robot build needs: the parsed
 * object tables and the per-module model files, fetched from the data repo the
 * site serves at `/WRFrontiersDB-Data/current`.
 */
import type { BuildTables } from './build/types';
import type { CharacterModule } from '../../types/character_module';
import type { Module, ModuleType } from '../../types/module';
import type { ModuleSocketType } from '../../types/module_socket_type';
import type { ModuleModel } from '../../types/model';
import type { VirtualBot } from '../../types/virtual_bot';

const DATA_ROOT = '/WRFrontiersDB-Data/current';

/** Every table a build is resolved, placed and measured against. */
export interface RobotTables extends BuildTables {
  characterModules: Record<string, CharacterModule>;
}

const jsonCache = new Map<string, Promise<unknown>>();

/** Fetch and parse a JSON file once per page; later calls share the result. */
export function fetchJson<T>(url: string): Promise<T> {
  let promise = jsonCache.get(url);
  if (!promise) {
    promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.json();
    });
    jsonCache.set(url, promise);
    // A failed fetch may be retried later.
    promise.catch(() => jsonCache.delete(url));
  }
  return promise as Promise<T>;
}

const objects = <T>(name: string): Promise<Record<string, T>> =>
  fetchJson<Record<string, T>>(`${DATA_ROOT}/Objects/${name}.json`);

export async function loadRobotTables(): Promise<RobotTables> {
  const [modules, moduleTypes, socketTypes, bots, characterModules] =
    await Promise.all([
      objects<Module>('Module'),
      objects<ModuleType>('ModuleType'),
      objects<ModuleSocketType>('ModuleSocketType'),
      objects<VirtualBot>('VirtualBot'),
      objects<CharacterModule>('CharacterModule'),
    ]);
  return { modules, moduleTypes, socketTypes, bots, characterModules };
}

/** A module's exported model (`Models/<CharacterModule id>.json`). */
export function fetchModuleModel(modelId: string): Promise<ModuleModel> {
  return fetchJson<ModuleModel>(`${DATA_ROOT}/Models/${modelId}.json`);
}
