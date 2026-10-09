/**
 * Build-time `/models` links for pages rendered by Astro (robot and preset
 * pages), and the build-code files the Site serves to other apps
 * (`/build-code.js`, `/build_codes.json`; see the data repo's
 * docs/build-codes.md). The browser loads the registry with `loadBuildCodec`
 * (scripts/robot/data.ts).
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

/** The data repo's build-code files, as the Site serves them to other apps. */
export const BUILD_CODE_FILES = {
  codec: 'tools/js/build_code.js',
  registry: 'index/build_codes.json',
} as const;

const dataPath = (rel: string): string =>
  path.join(process.cwd(), 'WRFrontiersDB-Data', rel);

/** One of the data repo's build-code files, verbatim. Throws if the checkout
 * doesn't have it, so a deploy never ships without the public files. */
export function readBuildCodeFile(file: keyof typeof BUILD_CODE_FILES): string {
  const filePath = dataPath(BUILD_CODE_FILES[file]);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${filePath} not found; check out a WRFrontiersDB-Data version with build codes`
    );
  }
  return fs.readFileSync(filePath, 'utf8');
}

let cachedCodec: BuildCodec | null | undefined;
let cachedBuild: { tables: BuildTables; index: CompatibilityIndex } | undefined;

/** The codec over `WRFrontiersDB-Data/index/build_codes.json`, or null when
 * the data checkout has no registry (links then use readable params). */
export function buildTimeBuildCodec(): BuildCodec | null {
  if (cachedCodec === undefined) {
    cachedCodec = fs.existsSync(dataPath(BUILD_CODE_FILES.registry))
      ? new BuildCodec(
          JSON.parse(readBuildCodeFile('registry')) as BuildCodesDoc
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
