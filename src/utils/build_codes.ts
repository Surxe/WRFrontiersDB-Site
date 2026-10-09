/**
 * Build-time `/models` links for pages rendered by Astro (robot and preset
 * pages). The browser loads the build-code registry with `loadBuildCodec`
 * (scripts/robot/data.ts) instead.
 */
import fs from 'fs';
import path from 'path';
import { getParseObjects } from './parse_object';
import { BuildCodec, type BuildCodesDoc } from '../scripts/robot/build/code';
import {
  buildCompatibilityIndex,
  type CompatibilityIndex,
} from '../scripts/robot/build/compatibility';
import { resolveBuild } from '../scripts/robot/build/graph';
import { modelsPageHref } from '../scripts/model_viewer/params';
import type { BuildSelection, BuildTables } from '../scripts/robot/build/types';
import type { Module, ModuleType } from '../types/module';
import type { ModuleSocketType } from '../types/module_socket_type';
import type { VirtualBot } from '../types/virtual_bot';

let cachedCodec: BuildCodec | null | undefined;
let cachedBuild: { tables: BuildTables; index: CompatibilityIndex } | undefined;

/** The codec over `WRFrontiersDB-Data/index/build_codes.json`, or null when
 * the data checkout has no registry (links then use readable params). */
export function buildTimeBuildCodec(): BuildCodec | null {
  if (cachedCodec === undefined) {
    const registryPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/index/build_codes.json'
    );
    cachedCodec = fs.existsSync(registryPath)
      ? new BuildCodec(
          JSON.parse(fs.readFileSync(registryPath, 'utf8')) as BuildCodesDoc
        )
      : null;
  }
  return cachedCodec;
}

function buildTimeTables(): { tables: BuildTables; index: CompatibilityIndex } {
  if (!cachedBuild) {
    const tables: BuildTables = {
      modules: getParseObjects<Module>('Objects/Module.json'),
      moduleTypes: getParseObjects<ModuleType>('Objects/ModuleType.json'),
      socketTypes: getParseObjects<ModuleSocketType>(
        'Objects/ModuleSocketType.json'
      ),
      bots: getParseObjects<VirtualBot>('Objects/VirtualBot.json'),
    };
    cachedBuild = { tables, index: buildCompatibilityIndex(tables) };
  }
  return cachedBuild;
}

/** Link to the /models page showing `selection`, completed the way the viewer
 * completes it (the chassis's own parts in empty required slots) so it can be
 * written as a build code. */
export function buildTimeModelsHref(selection: BuildSelection): string {
  const codec = buildTimeBuildCodec();
  if (!codec) return modelsPageHref(selection, null);
  const { tables, index } = buildTimeTables();
  return modelsPageHref(
    resolveBuild(selection, tables, index).selection,
    codec
  );
}
