/**
 * Module classification.
 *
 * Category comes from the data (Module -> ModuleType -> ModuleCategory), not
 * from substring-matching ids, so new types (e.g. another titan weapon class)
 * classify correctly without code changes.
 */
import { refToId } from '../../../utils/object_reference';
import { MODULE_CATEGORY_IDS } from '../../../utils/constants';
import type { Module } from '../../../types/module';
import type { BuildTables, ModuleKind } from './types';

const CATEGORIZED_KINDS = [
  'chassis',
  'torso',
  'shoulder',
  'weapon',
  'ability',
] as const satisfies readonly (keyof typeof MODULE_CATEGORY_IDS)[];

const KIND_BY_CATEGORY: ReadonlyMap<string, ModuleKind> = new Map(
  CATEGORIZED_KINDS.map((kind) => [MODULE_CATEGORY_IDS[kind], kind])
);

/** Category of a ModuleType id. */
export function kindOfModuleType(
  moduleTypeId: string,
  tables: Pick<BuildTables, 'moduleTypes'>
): ModuleKind {
  const type = tables.moduleTypes[moduleTypeId];
  if (!type) return 'other';
  return KIND_BY_CATEGORY.get(refToId(type.module_category_ref)) ?? 'other';
}

/** Category of a Module id. */
export function kindOfModule(
  moduleId: string,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): ModuleKind {
  const module = tables.modules[moduleId];
  if (!module) return 'other';
  return kindOfModuleType(refToId(module.module_type_ref), tables);
}

/** Whether a module type is a chassis (the root of a module tree). */
export function isRootModuleType(
  moduleTypeId: string,
  tables: Pick<BuildTables, 'moduleTypes'>
): boolean {
  return tables.moduleTypes[moduleTypeId]?.is_root_module === true;
}

/** The chassis among `moduleIds` (e.g. a bot's core modules), if any. */
export function findChassis(
  moduleIds: readonly string[],
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): string | undefined {
  return moduleIds.find((id) => {
    const module = tables.modules[id];
    return (
      module !== undefined &&
      isRootModuleType(refToId(module.module_type_ref), tables)
    );
  });
}

/** Whether a module belongs to titans (vs. standard robots). */
export function isTitanModule(
  moduleId: string,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): boolean {
  const module = tables.modules[moduleId];
  if (!module) return false;
  return (
    tables.moduleTypes[refToId(module.module_type_ref)]?.character_type ===
    'Titan'
  );
}

/** Released in-game (the site-wide production filter for modules). */
export function isProdReady(module: Module | undefined): boolean {
  return module?.production_status === 'Ready';
}

/** A module's English name, falling back to its id: a stable, language-
 * independent sort key. Display text goes through localization instead. */
export function moduleSortName(
  moduleId: string,
  tables: Pick<BuildTables, 'modules'>
): string {
  const name = tables.modules[moduleId]?.name;
  return name?.en || name?.InvariantString || moduleId;
}
