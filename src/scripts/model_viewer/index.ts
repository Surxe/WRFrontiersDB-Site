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
 * Compare mode adds build B (build/compare.ts: A plus the user's swaps) with
 * its own dropdowns; the viewer then draws and measures A vs B.
 *
 * Mount resolution (see mount.ts):
 *   world(module) = world(parent) x socketFrame(parent, socketName)
 *                   x T(adapterOffset) x R(mountRoll)
 */
import { fetchJSON } from './data';
import { el } from './dom';
import {
  ModelViewer,
  type ComparisonMeasurement,
  type HitboxMeasurement,
} from './viewer';
import {
  renderAreaPanel,
  renderComparePanel,
  type CompareMetric,
} from './area_panel';
import { CompareStore } from './build/compare';
import { partRefLookup, whenLocalized } from './part_refs';
import type { ViewName } from './hitbox_area';
import { parseViewParams, writeModelUrl } from './params';
import { buildCompatibilityIndex } from './build/compatibility';
import { toPresetModules } from './build/graph';
import { readSelection, slotKeyMatcher } from './build/params';
import { BuildStore } from './build/store';
import { renderBuilder } from './build/ui';
import { summarizeBuild } from './build/classify';
import {
  DIFF_COLORS,
  buildModuleColors,
  buildZoneColors,
  cssHex,
} from './colors';
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
    const areaEl = el<HTMLElement>('hitbox-area-pools');
    const compareBox = el<HTMLInputElement>('model-compare');
    const compareSection = el<HTMLElement>('model-compare-b');
    const builderBEl = el<HTMLElement>('model-builder-b');
    const buildATitle = el<HTMLElement>('model-build-a-title');
    const compareBar = el<HTMLElement>('hitbox-compare');
    const headlineEl = el<HTMLElement>('hitbox-compare-headline');
    const metricButtons = [
      ...el<HTMLElement>(
        'hitbox-metric-buttons'
      ).querySelectorAll<HTMLButtonElement>('button'),
    ];
    for (const swatch of compareBar.querySelectorAll<HTMLElement>(
      '[data-diff]'
    )) {
      const key = swatch.dataset.diff as keyof typeof DIFF_COLORS;
      swatch.style.background = cssHex(DIFF_COLORS[key]);
    }
    const modeButtons = [
      ...el<HTMLElement>(
        'hitbox-mode-buttons'
      ).querySelectorAll<HTMLButtonElement>('button'),
    ];
    const viewButtons = [
      ...el<HTMLElement>(
        'hitbox-view-buttons'
      ).querySelectorAll<HTMLButtonElement>('button'),
    ];

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
    const compare = new CompareStore(store, tables, index);

    const view = parseViewParams(window.location.search);
    hitboxBox.checked = view.hitbox ?? true;

    const syncUrl = (build: ResolvedBuild): void => {
      writeModelUrl(build.selection, { hitbox: hitboxBox.checked }, isSlotKey);
    };

    // Hitbox areas of the last build, and the camera: 3D or flat 2D, looking
    // from `cameraView` (null in 3D at a custom angle, e.g. the default one or
    // after the user orbits).
    let measurement: HitboxMeasurement | null = null;
    let comparison: ComparisonMeasurement | null = null;
    let metric: CompareMetric = 'withWeapons';
    let colors: number[] = [];
    let zoneColors: Record<string, number> = {};
    let cameraMode: '3d' | '2d' = '3d';
    let cameraView: ViewName | null = null;

    const renderAreas = (): void => {
      if (compare.isEnabled) {
        renderComparePanel(areaEl, headlineEl, comparison, {
          tables,
          metric,
          view: cameraView,
          onSelectView: (v) => selectView(v),
        });
        return;
      }
      renderAreaPanel(areaEl, measurement, {
        tables,
        colors,
        zoneColors,
        view: cameraView,
        onSelectView: (v) => selectView(v),
      });
    };

    const syncCameraButtons = (): void => {
      for (const button of modeButtons) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.mode === cameraMode)
        );
      }
      for (const button of viewButtons) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.view === cameraView)
        );
      }
      renderAreas();
    };

    const selectView = (next: ViewName): void => {
      cameraView = next;
      if (cameraMode === '2d') viewer?.setView(next);
      else viewer?.lookFrom(next);
      syncCameraButtons();
    };

    const selectMode = (next: '3d' | '2d'): void => {
      if (next === cameraMode) return;
      cameraMode = next;
      if (next === '2d') {
        // A custom 3D angle has no flat equivalent; start from the front.
        cameraView ??= 'front';
        viewer?.setView(cameraView);
      } else {
        viewer?.setView(null);
        if (cameraView) viewer?.lookFrom(cameraView);
      }
      syncCameraButtons();
    };

    for (const button of modeButtons) {
      button.addEventListener('click', () => {
        selectMode(button.dataset.mode as '3d' | '2d');
      });
    }

    for (const button of viewButtons) {
      button.addEventListener('click', () => {
        selectView(button.dataset.view as ViewName);
      });
    }

    viewer?.onOrbit(() => {
      if (cameraView === null) return;
      cameraView = null;
      syncCameraButtons();
    });

    for (const button of metricButtons) {
      button.addEventListener('click', () => {
        metric = button.dataset.metric as CompareMetric;
        for (const b of metricButtons) {
          b.setAttribute('aria-pressed', String(b === button));
        }
        renderAreas();
      });
    }

    /** Rebuild the scene (and re-measure) for the live build, or for A vs B
     * while comparing. */
    const rebuild = async (): Promise<void> => {
      const build = store.current;
      const cmp = compare.current;
      if (!viewer) {
        status.textContent = `${summarizeBuild(build, tables)} (3D view unavailable: WebGL could not start)`;
        return;
      }
      try {
        const buildColors = buildModuleColors(build);
        const buildZones = buildZoneColors(build);
        if (cmp) {
          comparison = null;
          renderAreas();
        }
        await viewer.build({
          modules: toPresetModules(build),
          colors: buildColors,
          zoneColors: buildZones,
          label: cmp
            ? `A: ${summarizeBuild(cmp.a, tables)} vs B: ${summarizeBuild(cmp.b, tables)}`
            : summarizeBuild(build, tables),
          hitbox: hitboxBox.checked,
          // The bone overlay stays off in the UI (the viewer still supports it).
          skeleton: false,
          compare: cmp ? { modules: toPresetModules(cmp.b) } : undefined,
        });
        // Measure after the new build has painted; the raycast takes a moment.
        await new Promise((resolve) => setTimeout(resolve, 0));
        colors = buildColors;
        zoneColors = buildZones;
        if (cmp) {
          comparison = viewer.measureComparison();
        } else {
          measurement = viewer.measureHitboxes();
        }
        renderAreas();
      } catch (err) {
        console.error('model build failed:', err);
        status.textContent = `Failed to build model: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    const partRef = partRefLookup(document.getElementById('model-part-refs'));
    const render = (build: ResolvedBuild): void => {
      renderBuilder(builderEl, build, {
        tables,
        onSelect: (key, moduleId) => store.select(key, moduleId),
        partRef,
      });
    };
    const renderB = (): void => {
      const cmp = compare.current;
      if (!cmp) {
        builderBEl.replaceChildren();
        return;
      }
      renderBuilder(builderBEl, cmp.b, {
        tables,
        onSelect: (key, moduleId) => compare.select(key, moduleId),
        partRef,
        idPrefix: 'model-slot-b',
        changed: cmp.changed,
        canRevert: (key) =>
          Object.prototype.hasOwnProperty.call(compare.currentOverrides, key),
        onRevert: (key) => compare.revert(key),
      });
    };
    // Once names are localized, re-render so the dropdowns clone the
    // localized ObjRefs.
    void whenLocalized().then(() => {
      render(store.current);
      renderB();
    });

    // While comparing, the compare store (which follows A) drives rebuilds,
    // so an A change rebuilds once.
    store.subscribe((build) => {
      render(build);
      syncUrl(build);
      if (!compare.isEnabled) void rebuild();
    });
    compare.subscribe((cmp) => {
      const on = cmp !== null;
      compareSection.hidden = !on;
      compareBar.hidden = !on;
      buildATitle.textContent = on ? 'Build A (current)' : 'Build';
      renderB();
      void rebuild();
    });
    compareBox.addEventListener('change', () => {
      compare.setEnabled(compareBox.checked);
    });
    el<HTMLButtonElement>('model-compare-reset').addEventListener('click', () =>
      compare.reset()
    );
    hitboxBox.addEventListener('change', () => {
      syncUrl(store.current);
      void rebuild();
    });

    // Reflect the resolved state back into the URL so the landing view — deep
    // linked or default — is immediately shareable.
    render(store.current);
    syncUrl(store.current);
    // A reload can restore the checkbox's checked state; start in sync.
    compare.setEnabled(compareBox.checked);
    if (!compare.isEnabled) await rebuild();
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
