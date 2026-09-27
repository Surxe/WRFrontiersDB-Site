/**
 * Module classification and display helpers.
 *
 * Category comes from the data (Module -> ModuleType -> ModuleCategory), not
 * from substring-matching ids, so new types (e.g. another titan weapon class)
 * classify correctly without code changes.
 */
import { refToId } from '../../../utils/object_reference';
import type { Module } from '../../../types/module';
import type {
  BuildSlot,
  BuildTables,
  ModuleKind,
  ResolvedBuild,
} from './types';

const CATEGORY_KINDS: Record<string, ModuleKind> = {
  'DA_ModuleCategory_Chassis.0': 'chassis',
  'DA_ModuleCategory_Torso.0': 'torso',
  'DA_ModuleCategory_Shoulder.0': 'shoulder',
  'DA_ModuleCategory_Weapon.0': 'weapon',
  'DA_ModuleCategory_Ability.0': 'ability',
};

/** Category of a ModuleType id. */
export function kindOfModuleType(
  moduleTypeId: string,
  tables: Pick<BuildTables, 'moduleTypes'>
): ModuleKind {
  const type = tables.moduleTypes[moduleTypeId];
  if (!type?.module_category_ref) return 'other';
  return CATEGORY_KINDS[refToId(type.module_category_ref)] ?? 'other';
}

/** Category of a Module id. */
export function kindOfModule(
  moduleId: string,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): ModuleKind {
  const module = tables.modules[moduleId];
  if (!module?.module_type_ref) return 'other';
  return kindOfModuleType(refToId(module.module_type_ref), tables);
}

/** Whether a module type is a chassis (the root of a module tree). */
export function isRootModuleType(
  moduleTypeId: string,
  tables: Pick<BuildTables, 'moduleTypes'>
): boolean {
  return tables.moduleTypes[moduleTypeId]?.is_root_module === true;
}

/** `"Titan"` for titan modules, `"Robot"` otherwise. */
export function characterTypeOf(
  moduleId: string,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): 'Titan' | 'Robot' {
  const module = tables.modules[moduleId];
  const type = module
    ? tables.moduleTypes[refToId(module.module_type_ref)]
    : undefined;
  return type?.character_type === 'Titan' ? 'Titan' : 'Robot';
}

/** Released in-game (the site-wide production filter for modules). */
export function isProdReady(module: Module | undefined): boolean {
  return module?.production_status === 'Ready';
}

/** English display name of a module, falling back to its id. */
export function moduleLabel(
  moduleId: string,
  tables: Pick<BuildTables, 'modules'>
): string {
  const name = tables.modules[moduleId]?.name;
  return name?.en || name?.InvariantString || moduleId;
}

/** Row label (and an optional hint) for a build slot, e.g. `Left Shoulder`,
 * or `Weapon 2` + `Light Weapon`. */
export function slotLabel(
  slot: BuildSlot,
  tables: Pick<BuildTables, 'socketTypes'>
): { label: string; hint?: string } {
  if (slot.socketTypeId === null) return { label: 'Chassis' };
  const typeName = tables.socketTypes[slot.socketTypeId]?.name?.en;
  if (slot.kind === 'weapon') {
    const n = /(\d+)$/.exec(slot.socketName);
    return {
      label: n ? `Weapon ${Number(n[1]) + 1}` : 'Weapon',
      hint: typeName,
    };
  }
  return { label: typeName || slot.socketName };
}

/** One-line description of a build, e.g. `Typhon / Typhon torso, 3 weapons`. */
export function summarizeBuild(
  build: ResolvedBuild,
  tables: Pick<BuildTables, 'modules'>
): string {
  const filled = build.slots.filter((s) => s.moduleId);
  const name = (kind: BuildSlot['kind']): string | undefined => {
    const slot = filled.find((s) => s.kind === kind);
    return slot?.moduleId ? moduleLabel(slot.moduleId, tables) : undefined;
  };
  const weapons = filled.filter((s) => s.kind === 'weapon').length;
  const chassis = name('chassis') ?? 'No chassis';
  const torso = name('torso');
  return (
    `${chassis}${torso ? ` / ${torso} torso` : ''}, ` +
    `${weapons} weapon${weapons === 1 ? '' : 's'}`
  );
}
