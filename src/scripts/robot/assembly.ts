/**
 * Headless robot assembly: from a module list (a preset's, or a resolved
 * build flattened with build/graph.ts `toPresetModules`) to placed models and
 * their hitboxes, ready to render or measure. No DOM or WebGL, so any page (or
 * a test) can compute a build's numbers:
 *
 *   const tables = await loadRobotTables();
 *   const models = new ModelCache(fetchModuleModel);
 *   const build = resolveBuild(selection, tables, buildCompatibilityIndex(tables));
 *   const assembly = await assemble(toPresetModules(build), tables, models);
 *   const areas = measureHitboxes(assembly.hitboxes);
 */
import {
  placeModules,
  requiredModelIds,
  type ModelLookup,
} from './model/mount';
import type { MountTables, ModulePlacement } from './model/mount';
import { collectHitboxes, type HitboxSet } from './hitbox_area/pools';
import type { CharacterPresetModule } from '../../types/character_preset';
import type { ModuleModel } from '../../types/model';

/**
 * Loads module models on demand and keeps them for the page's lifetime.
 * Loading is keyed by model id, so overlapping builds share requests.
 */
export class ModelCache {
  private readonly loaded = new Map<string, ModuleModel>();
  private readonly pending = new Map<string, Promise<ModuleModel | null>>();

  constructor(
    private readonly fetchModel: (modelId: string) => Promise<ModuleModel>
  ) {}

  /** The loaded models, for placement. */
  get models(): ModelLookup {
    return this.loaded;
  }

  /** Load every model in `ids`; resolves to those that failed to load. */
  async load(ids: Iterable<string>): Promise<string[]> {
    const results = await Promise.all(
      [...ids].map(async (id) => ({ id, model: await this.loadOne(id) }))
    );
    return results.filter(({ model }) => !model).map(({ id }) => id);
  }

  private loadOne(id: string): Promise<ModuleModel | null> {
    const model = this.loaded.get(id);
    if (model) return Promise.resolve(model);
    let promise = this.pending.get(id);
    if (!promise) {
      promise = this.fetchModel(id)
        .then((loaded) => {
          this.loaded.set(id, loaded);
          return loaded;
        })
        .catch((err: unknown) => {
          console.warn(`model ${id}:`, err);
          return null;
        })
        .finally(() => this.pending.delete(id));
      this.pending.set(id, promise);
    }
    return promise;
  }
}

/** A module list placed in the world, with its models and hitboxes. */
export interface Assembly {
  placements: ModulePlacement[];
  hitboxes: HitboxSet;
  /** The models placed (by CharacterModule id). */
  models: ModelLookup;
  /** Model ids that failed to load; their modules have no geometry. */
  missingModels: string[];
}

/** Load what a module list needs, then place it and collect its hitboxes. */
export async function assemble(
  list: readonly CharacterPresetModule[],
  tables: MountTables,
  cache: ModelCache
): Promise<Assembly> {
  const missingModels = await cache.load(requiredModelIds(list, tables));
  const placements = placeModules(list, tables, cache.models);
  return {
    placements,
    hitboxes: collectHitboxes(placements, cache.models, tables),
    models: cache.models,
    missingModels,
  };
}
