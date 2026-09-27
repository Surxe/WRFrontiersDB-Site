/**
 * Socket compatibility: which modules fit which slot.
 *
 * Resolution is entirely data-driven by `ModuleSocketType`: a module fits a
 * socket when its `module_type_ref` is in the socket type's
 * `compatible_module_types_refs` (or is its `exclusive_module_type_ref`). That
 * one rule covers standard robots (any torso / shoulder / weapon of the right
 * type), titans (per-titan exclusive torso and shoulder types) and heavy vs
 * light weapon hardpoints.
 */
import { refToId } from '../../../utils/object_reference';
import {
  characterTypeOf,
  isProdReady,
  isRootModuleType,
  moduleLabel,
} from './classify';
import type { BuildTables } from './types';

export interface CompatibilityIndex {
  /** Every chassis module id (robots before titans; released first, then by
   * name). */
  rootModules: string[];
  /** Module ids that fit a socket type (released first, then by name). */
  compatible(socketTypeId: string): string[];
  /** Whether a module fits a socket type. */
  fits(moduleId: string, socketTypeId: string): boolean;
  /** Every socket name declared by any module (the URL slot-key vocabulary). */
  socketNames: ReadonlySet<string>;
}

/** Module type ids a socket type accepts. */
export function acceptedModuleTypes(
  socketTypeId: string,
  tables: Pick<BuildTables, 'socketTypes'>
): Set<string> {
  const socketType = tables.socketTypes[socketTypeId];
  const accepted = new Set<string>();
  if (!socketType) return accepted;
  for (const ref of socketType.compatible_module_types_refs ?? []) {
    accepted.add(refToId(ref));
  }
  if (socketType.exclusive_module_type_ref) {
    accepted.add(refToId(socketType.exclusive_module_type_ref));
  }
  return accepted;
}

export function buildCompatibilityIndex(
  tables: BuildTables
): CompatibilityIndex {
  const byType = new Map<string, string[]>();
  const socketNames = new Set<string>();
  for (const [id, module] of Object.entries(tables.modules)) {
    const typeId = module.module_type_ref
      ? refToId(module.module_type_ref)
      : '';
    const list = byType.get(typeId);
    if (list) list.push(id);
    else byType.set(typeId, [id]);
    for (const sock of module.sockets ?? []) socketNames.add(sock.name);
  }

  const order = (ids: string[]): string[] =>
    [...ids].sort((a, b) => {
      const ready =
        Number(isProdReady(tables.modules[b])) -
        Number(isProdReady(tables.modules[a]));
      if (ready !== 0) return ready;
      return (
        moduleLabel(a, tables).localeCompare(moduleLabel(b, tables)) ||
        a.localeCompare(b)
      );
    });

  const rootModules = order(
    [...byType.entries()]
      .filter(([typeId]) => isRootModuleType(typeId, tables))
      .flatMap(([, ids]) => ids)
  ).sort(
    (a, b) =>
      Number(characterTypeOf(a, tables) === 'Titan') -
      Number(characterTypeOf(b, tables) === 'Titan')
  );

  const cache = new Map<string, string[]>();
  const compatible = (socketTypeId: string): string[] => {
    const hit = cache.get(socketTypeId);
    if (hit) return hit;
    const ids = [...acceptedModuleTypes(socketTypeId, tables)].flatMap(
      (typeId) => byType.get(typeId) ?? []
    );
    const result = order(ids);
    cache.set(socketTypeId, result);
    return result;
  };

  const fits = (moduleId: string, socketTypeId: string): boolean => {
    const module = tables.modules[moduleId];
    if (!module?.module_type_ref) return false;
    return acceptedModuleTypes(socketTypeId, tables).has(
      refToId(module.module_type_ref)
    );
  };

  return { rootModules, compatible, fits, socketNames };
}
