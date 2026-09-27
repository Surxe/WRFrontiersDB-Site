/**
 * Live 3D construction of hitbox + untextured module models.
 *
 * The /models page is a free-form robot builder: the user picks a chassis,
 * then each part that mounts on it (torso, shoulders, per-slot weapons, gear),
 * cascading like the in-game hangar. The build logic lives in the three.js-free
 * `build/` layer; this entry module wires it to the page:
 *
 *   URL params --> BuildStore --> dropdowns (build/ui.ts)
 *                            \--> URL (params.ts)
 *                             \-> ModelViewer (flattened via toPresetModules)
 *
 * Mount resolution (see mount.ts):
 *   world(module) = world(parent) x socketFrame(parent, socketName)
 *                   x T(adapterOffset) x R(mountRoll)
 */
import { fetchJSON } from './data';
import { el } from './dom';
import { ModelViewer } from './viewer';
import { parseViewParams, writeModelUrl } from './params';
import { buildCompatibilityIndex } from './build/compatibility';
import { toPresetModules } from './build/graph';
import { readSelection, slotKeyMatcher } from './build/params';
import { BuildStore } from './build/store';
import { renderBuilder } from './build/ui';
import { summarizeBuild } from './build/classify';
import { buildModuleColors } from './colors';
import type { BuildTables, ResolvedBuild } from './build/types';
import type { Module, ModuleType } from '../../types/module';
import type { ModuleSocketType } from '../../types/module_socket_type';
import type { VirtualBot } from '../../types/virtual_bot';

const OBJECTS = '/WRFrontiersDB-Data/current/Objects';

async function loadTables(): Promise<BuildTables> {
  const [modules, moduleTypes, socketTypes, bots] = await Promise.all([
    fetchJSON<Record<string, Module>>(`${OBJECTS}/Module.json`),
    fetchJSON<Record<string, ModuleType>>(`${OBJECTS}/ModuleType.json`),
    fetchJSON<Record<string, ModuleSocketType>>(
      `${OBJECTS}/ModuleSocketType.json`
    ),
    fetchJSON<Record<string, VirtualBot>>(`${OBJECTS}/VirtualBot.json`),
  ]);
  return { modules, moduleTypes, socketTypes, bots };
}

async function init(): Promise<void> {
  const loading = document.getElementById('model-loading');
  const hideLoading = (): void => {
    if (loading) loading.remove();
  };

  const status = el<HTMLElement>('model-status');
  try {
    // Without WebGL the builder (and its shareable URL) still works.
    let viewer: ModelViewer | null = null;
    try {
      viewer = new ModelViewer(el<HTMLElement>('model-canvas'), status);
    } catch (err) {
      console.error('WebGL unavailable:', err);
    }

    const builderEl = el<HTMLElement>('model-builder');
    const hitboxBox = el<HTMLInputElement>('model-hitbox');

    status.textContent = 'Loading tables...';
    const tables = await loadTables();
    if (Object.keys(tables.modules).length === 0) {
      status.textContent =
        'No model data found. Run the parser to populate WRFrontiersDB-Data/current/.';
      hideLoading();
      return;
    }

    const index = buildCompatibilityIndex(tables);
    const isSlotKey = slotKeyMatcher(index.socketNames);
    const search = new URLSearchParams(window.location.search);
    const store = new BuildStore(
      tables,
      index,
      readSelection(search, isSlotKey)
    );

    const view = parseViewParams(window.location.search);
    hitboxBox.checked = view.hitbox ?? true;

    const syncUrl = (build: ResolvedBuild): void => {
      writeModelUrl(build.selection, { hitbox: hitboxBox.checked }, isSlotKey);
    };

    const rebuild = async (build: ResolvedBuild): Promise<void> => {
      if (!viewer) {
        status.textContent = `${summarizeBuild(build, tables)} (3D view unavailable: WebGL could not start)`;
        return;
      }
      try {
        await viewer.build({
          modules: toPresetModules(build),
          colors: buildModuleColors(build),
          label: summarizeBuild(build, tables),
          hitbox: hitboxBox.checked,
          // The bone overlay stays off in the UI (the viewer still supports it).
          skeleton: false,
        });
      } catch (err) {
        console.error('model build failed:', err);
        status.textContent = `Failed to build model: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    const render = (build: ResolvedBuild): void => {
      renderBuilder(builderEl, build, {
        tables,
        onSelect: (key, moduleId) => store.select(key, moduleId),
      });
    };

    store.subscribe((build) => {
      render(build);
      syncUrl(build);
      void rebuild(build);
    });
    hitboxBox.addEventListener('change', () => {
      syncUrl(store.current);
      void rebuild(store.current);
    });

    // Reflect the resolved state back into the URL so the landing view — deep
    // linked or default — is immediately shareable.
    render(store.current);
    syncUrl(store.current);
    await rebuild(store.current);
  } catch (err) {
    console.error('model viewer init failed:', err);
    status.textContent =
      'Could not start the viewer. Check the browser console; ' +
      `(${err instanceof Error ? err.message : String(err)})`;
  } finally {
    hideLoading();
  }
}

void init();
