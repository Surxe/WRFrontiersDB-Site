/**
 * The /models page controller: wires the page's controls, the build stores,
 * the headless robot pipeline (robot/) and the 3D viewer together.
 *
 *   URL --> BuildStore (A) --> CompareStore (B = A + swaps)
 *               |                   |
 *               v                   v
 *        dropdowns (ui/builder)   assemble() --> ModelViewer (draw)
 *                                     \-------> measure --> area panel, labels
 *
 * Every change is written back to the URL (params.ts).
 */
import { assemble, ModelCache, type Assembly } from '../robot/assembly';
import {
  fetchModuleModel,
  loadRobotTables,
  type RobotTables,
} from '../robot/data';
import { buildCompatibilityIndex } from '../robot/build/compatibility';
import { toPresetModules } from '../robot/build/graph';
import { slotKeyMatcher, type SlotKeyMatcher } from '../robot/build/params';
import { BuildStore } from '../robot/build/store';
import { CompareStore } from '../robot/build/compare';
import {
  compareHitboxes,
  measureHitboxes,
  type AreaMetric,
  type ComparisonMeasurement,
  type DiffRaster,
  type HitboxMeasurement,
} from '../robot/hitbox_area/measure';
import {
  isViewName,
  VIEW_NAMES,
  type ViewName,
} from '../robot/hitbox_area/views';
import type { ResolvedBuild } from '../robot/build/types';
import { localizePage } from '../localization';
import { ModelViewer } from './render/viewer';
import { isCompareLayout, type CompareLayout } from './render/compare_layout';
import {
  buildColors,
  cssHex,
  DIFF_COLORS,
  isDiffColorKey,
  type BuildColors,
} from './colors';
import { readModelUrl, writeModelUrl } from './params';
import { renderAreaPanel, renderComparePanel } from './ui/area_panel';
import { renderBuilder } from './ui/builder';
import { FullscreenToggle } from './ui/fullscreen';
import { queryAll, requireElement } from './ui/dom';
import { PartRefs } from './ui/part_refs';
import { ToggleGroup } from './ui/toggle_group';
import { compareViewLabels, singleViewLabels } from './ui/view_labels';
import {
  MODEL_STRINGS,
  ModelText,
  parseModelStrings,
  type ModelStringId,
} from './strings';

type CameraMode = '3d' | '2d';

const isCameraMode = (value: unknown): value is CameraMode =>
  value === '3d' || value === '2d';

const isAreaMetric = (value: unknown): value is AreaMetric =>
  value === 'alone' || value === 'withWeapons';

const isModelStringId = (value: unknown): value is ModelStringId =>
  typeof value === 'string' && Object.hasOwn(MODEL_STRINGS, value);

const NO_COLORS: BuildColors = { modules: [], zones: new Map() };

/** The per-view A vs B diff images of a comparison. */
function diffRasters(
  cmp: ComparisonMeasurement
): Partial<Record<ViewName, DiffRaster>> {
  const rasters: Partial<Record<ViewName, DiffRaster>> = {};
  for (const view of VIEW_NAMES) {
    const diff = cmp.views[view].diff;
    if (diff) rasters[view] = diff;
  }
  return rasters;
}

/** Resolves once the browser has painted the current frame. */
const afterPaint = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** The page's static elements (see the components in components/models/). */
function pageElements() {
  return {
    status: requireElement('model-status', HTMLElement),
    viewport: requireElement('model-viewport', HTMLElement),
    canvas: requireElement('model-canvas', HTMLElement),
    loading: requireElement('model-loading', HTMLElement),
    builderA: requireElement('model-builder', HTMLElement),
    builderB: requireElement('model-builder-b', HTMLElement),
    buildATitle: requireElement('model-build-a-title', HTMLElement),
    compareToggle: requireElement('model-compare', HTMLButtonElement),
    compareLabel: requireElement('model-compare-label', HTMLElement),
    compareSection: requireElement('model-compare-b', HTMLElement),
    compareReset: requireElement('model-compare-reset', HTMLButtonElement),
    meshBox: requireElement('model-mesh', HTMLInputElement),
    hitboxBox: requireElement('model-hitbox', HTMLInputElement),
    fullscreen: requireElement('model-fullscreen', HTMLButtonElement),
    recenter: requireElement('model-recenter', HTMLButtonElement),
    clear: requireElement('model-clear', HTMLButtonElement),
    share: requireElement('model-share', HTMLButtonElement),
    shareLabel: requireElement('model-share-label', HTMLElement),
    areaPools: requireElement('hitbox-area-pools', HTMLElement),
    compareBar: requireElement('hitbox-compare', HTMLElement),
    headline: requireElement('hitbox-compare-headline', HTMLElement),
    modeButtons: requireElement('model-mode-buttons', HTMLElement),
    viewButtons: requireElement('model-view-buttons', HTMLElement),
    layoutButtons: requireElement('model-layout-buttons', HTMLElement),
    metricButtons: requireElement('hitbox-metric-buttons', HTMLElement),
    page: requireElement('model-page', HTMLElement),
    partRefs: document.getElementById('model-part-refs'),
  };
}

type PageElements = ReturnType<typeof pageElements>;

/** Copy `text` to the clipboard, falling back to execCommand where the async
 * Clipboard API is unavailable (non-secure contexts). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** Set the attributes the page marks `data-model-<attr>="<string id>"` (text
 * LocalizedText can't reach: aria-labels, titles). */
function localizeAttributes(text: ModelText): void {
  for (const attr of ['aria-label', 'title']) {
    for (const node of queryAll(document, `[data-model-${attr}]`, Element)) {
      const id = node.getAttribute(`data-model-${attr}`);
      if (isModelStringId(id)) node.setAttribute(attr, text.t(id));
    }
  }
}

export class ModelPage {
  private readonly store: BuildStore;
  private readonly compare: CompareStore;
  /** The URL asked for Compare on (turned on once the page is wired up). */
  private readonly compareOnLoad: boolean;
  private readonly models = new ModelCache(fetchModuleModel);
  private readonly partRefs: PartRefs;
  private readonly isSlotKey: SlotKeyMatcher;
  private readonly modes: ToggleGroup<CameraMode>;
  private readonly views: ToggleGroup<ViewName>;
  private readonly layouts: ToggleGroup<CompareLayout>;
  private readonly metrics: ToggleGroup<AreaMetric>;

  private cameraMode: CameraMode = '3d';
  /** The side the camera looks from; null in 3D at a custom angle (the
   * default one, or after the user orbits). */
  private cameraView: ViewName | null = null;
  private metric: AreaMetric = 'withWeapons';
  /** Where B stands in the 3D view while comparing. */
  private compareLayout: CompareLayout;
  /** Rebuilds can overlap; only the latest may touch the page. */
  private generation = 0;
  private drawn: {
    a: Assembly;
    b: Assembly | null;
    colors: BuildColors;
  } | null = null;
  private measurement: HitboxMeasurement | null = null;
  private comparison: ComparisonMeasurement | null = null;

  private constructor(
    private readonly el: PageElements,
    private readonly tables: RobotTables,
    private readonly text: ModelText,
    /** Null when WebGL could not start: the builder and areas still work. */
    private readonly viewer: ModelViewer | null
  ) {
    const index = buildCompatibilityIndex(tables);
    this.isSlotKey = slotKeyMatcher(index.socketNames);
    const state = readModelUrl(window.location.search, this.isSlotKey);
    this.store = new BuildStore(tables, index, state.selection);
    this.compare = new CompareStore(this.store, tables, index);
    this.partRefs = new PartRefs(el.partRefs);
    el.meshBox.checked = state.mesh;
    el.hitboxBox.checked = state.hitbox;
    this.compareOnLoad = state.compare !== null;
    this.compareLayout = state.compareLayout;
    viewer?.setCompareLayout(state.compareLayout);
    if (state.compare) this.compare.replace(state.compare);

    this.modes = new ToggleGroup(el.modeButtons, 'mode', isCameraMode);
    this.views = new ToggleGroup(el.viewButtons, 'view', isViewName);
    this.layouts = new ToggleGroup(el.layoutButtons, 'layout', isCompareLayout);
    this.metrics = new ToggleGroup(el.metricButtons, 'metric', isAreaMetric);
    for (const node of queryAll(el.compareBar, '[data-diff]', HTMLElement)) {
      const key = node.dataset.diff;
      if (isDiffColorKey(key)) node.style.background = cssHex(DIFF_COLORS[key]);
    }
  }

  /** Load the data and the page's language, then run the page. */
  static async start(): Promise<void> {
    const el = pageElements();
    let text: ModelText | null = null;
    try {
      const strings = parseModelStrings(el.page.dataset.strings ?? '');
      // English until the reader's language loads.
      text = new ModelText(strings, null);
      const [tables, localization] = await Promise.all([
        loadRobotTables(),
        localizePage().catch((err: unknown) => {
          console.error('localization failed:', err);
          return null;
        }),
      ]);
      text = new ModelText(strings, localization);
      localizeAttributes(text);
      if (Object.keys(tables.modules).length === 0) {
        el.status.textContent = text.t('statusNoData');
        return;
      }
      let viewer: ModelViewer | null = null;
      try {
        viewer = new ModelViewer(el.canvas, {
          a: text.t('buildA'),
          b: text.t('buildB'),
        });
      } catch (err) {
        console.error('WebGL unavailable:', err);
      }
      new ModelPage(el, tables, text, viewer).run();
    } catch (err) {
      console.error('model viewer init failed:', err);
      const error = err instanceof Error ? err.message : String(err);
      el.status.textContent = text
        ? text.t('statusInitFailed', { error })
        : error;
    } finally {
      el.loading.remove();
    }
  }

  private run(): void {
    const { el } = this;
    this.modes.onSelect((mode) => this.selectMode(mode));
    this.views.onSelect((view) => this.selectView(view));
    this.layouts.onSelect((layout) => {
      this.compareLayout = layout;
      this.viewer?.setCompareLayout(layout);
      this.syncCamera();
      this.syncUrl();
    });
    this.metrics.onSelect((metric) => {
      this.metric = metric;
      this.metrics.setPressed(metric);
      this.renderAreas();
    });
    this.viewer?.onOrbit(() => {
      if (this.cameraView === null) return;
      this.cameraView = null;
      this.syncCamera();
    });

    // While comparing, the compare store (which follows A) drives rebuilds,
    // so an A change rebuilds once.
    this.store.subscribe((build) => {
      this.renderBuilderA(build);
      this.syncUrl();
      if (!this.compare.isEnabled) void this.rebuild();
    });
    this.compare.subscribe((cmp) => {
      const on = cmp !== null;
      el.compareToggle.setAttribute('aria-pressed', String(on));
      el.compareToggle.classList.toggle('wrf-btn--primary', !on);
      el.compareToggle.classList.toggle('wrf-btn--secondary', on);
      el.compareLabel.textContent = this.text.t(
        on ? 'compareStop' : 'compareStart'
      );
      el.compareSection.hidden = !on;
      el.compareBar.hidden = !on;
      el.buildATitle.textContent = this.text.t(on ? 'buildA' : 'build');
      this.syncCamera();
      this.renderBuilderB();
      this.syncUrl();
      void this.rebuild();
    });

    el.compareToggle.addEventListener('click', () =>
      this.compare.setEnabled(!this.compare.isEnabled)
    );
    el.compareReset.addEventListener('click', () => this.compare.reset());
    // Back to an empty selection: the default chassis with only its required
    // parts, as on a bare /models link. B's swaps go too (B = A again), in
    // the same update.
    el.clear.addEventListener('click', () => {
      this.compare.clearOverrides();
      this.store.replace({});
    });
    // The URL always mirrors the view (syncUrl), so sharing is copying it.
    el.share.addEventListener('click', async () => {
      const ok = await copyText(window.location.href);
      el.shareLabel.textContent = this.text.t(
        ok ? 'shareCopied' : 'shareFailed'
      );
      window.setTimeout(() => {
        el.shareLabel.textContent = this.text.t('share');
      }, 1500);
    });
    // Nothing to enlarge or pan without WebGL: the buttons stay hidden.
    const { viewer } = this;
    if (viewer) {
      viewer.avoidLabelsUnder(
        queryAll(el.viewport, '.model-overlay', HTMLElement)
      );
      el.recenter.hidden = false;
      el.recenter.addEventListener('click', () => viewer.recenter());
      new FullscreenToggle(el.viewport, el.fullscreen, {
        enter: this.text.t('fullscreenEnter'),
        exit: this.text.t('fullscreenExit'),
      });
    }
    for (const box of [el.meshBox, el.hitboxBox]) {
      box.addEventListener('change', () => {
        this.syncUrl();
        this.redraw();
      });
    }

    // Reflect the resolved state back into the URL so the landing view (deep
    // linked or default) is immediately shareable.
    this.renderBuilderA(this.store.current);
    this.syncUrl();
    this.syncCamera();
    if (this.compareOnLoad) this.compare.setEnabled(true);
    else void this.rebuild();
  }

  private syncUrl(): void {
    writeModelUrl(
      {
        selection: this.store.current.selection,
        compare: this.compare.isEnabled ? this.compare.currentOverrides : null,
        compareLayout: this.compareLayout,
        mesh: this.el.meshBox.checked,
        hitbox: this.el.hitboxBox.checked,
      },
      this.isSlotKey
    );
  }

  private renderBuilderA(build: ResolvedBuild): void {
    renderBuilder(this.el.builderA, build, {
      tables: this.tables,
      text: this.text,
      partRefs: this.partRefs,
      idPrefix: 'model-slot',
      onSelect: (key, moduleId) => this.store.select(key, moduleId),
    });
  }

  private renderBuilderB(): void {
    const cmp = this.compare.current;
    if (!cmp) {
      this.el.builderB.replaceChildren();
      return;
    }
    renderBuilder(this.el.builderB, cmp.b, {
      tables: this.tables,
      text: this.text,
      partRefs: this.partRefs,
      idPrefix: 'model-slot-b',
      onSelect: (key, moduleId) => this.compare.select(key, moduleId),
      changed: cmp.changed,
      canRevert: (key) => Object.hasOwn(this.compare.currentOverrides, key),
      onRevert: (key) => this.compare.revert(key),
    });
  }

  /** Assemble, draw and measure the live build, or A vs B while comparing. */
  private async rebuild(): Promise<void> {
    const generation = ++this.generation;
    const build = this.store.current;
    const cmp = this.compare.current;
    this.el.status.textContent = this.text.t('statusLoading');
    if (cmp) {
      this.comparison = null;
      this.renderAreas();
    }
    try {
      const [a, b] = await Promise.all([
        assemble(toPresetModules(build), this.tables, this.models),
        cmp ? assemble(toPresetModules(cmp.b), this.tables, this.models) : null,
      ]);
      if (generation !== this.generation) return;
      this.drawn = { a, b, colors: buildColors(build) };
      this.redraw();
      const missing = new Set([
        ...a.missingModels,
        ...(b?.missingModels ?? []),
      ]);
      this.el.status.textContent = !this.viewer
        ? this.text.t('statusNoWebGl')
        : missing.size > 0
          ? this.text.t('statusMissingModels', { count: missing.size })
          : '';

      // Measure once the new build has painted: the raycast takes a moment.
      await afterPaint();
      if (generation !== this.generation) return;
      if (b) {
        this.comparison = compareHitboxes(a.hitboxes, b.hitboxes);
        this.viewer?.setDiffRasters(diffRasters(this.comparison));
      } else {
        this.measurement = measureHitboxes(a.hitboxes);
      }
      this.renderAreas();
    } catch (err) {
      console.error('model build failed:', err);
      this.el.status.textContent = this.text.t('statusBuildFailed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Draw the last assembled builds with the current layer toggles. */
  private redraw(): void {
    if (!this.viewer || !this.drawn) return;
    this.viewer.show({
      ...this.drawn,
      mesh: this.el.meshBox.checked,
      hitbox: this.el.hitboxBox.checked,
    });
    // show() resets the diff image; keep the one measured for these builds.
    if (this.drawn.b && this.comparison) {
      this.viewer.setDiffRasters(diffRasters(this.comparison));
    }
    this.renderLabels();
  }

  private selectView(view: ViewName): void {
    this.cameraView = view;
    if (this.cameraMode === '2d') this.viewer?.setView(view);
    else this.viewer?.lookFrom(view);
    this.syncCamera();
  }

  private selectMode(mode: CameraMode): void {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    if (mode === '2d') {
      // A custom 3D angle has no flat equivalent; start from the front.
      this.cameraView ??= 'front';
      this.viewer?.setView(this.cameraView);
    } else {
      this.viewer?.setView(null);
      if (this.cameraView) this.viewer?.lookFrom(this.cameraView);
    }
    this.syncCamera();
  }

  private syncCamera(): void {
    this.modes.setPressed(this.cameraMode);
    this.views.setPressed(this.cameraView);
    this.layouts.setPressed(this.compareLayout);
    // The axis views always overlap the builds (their diff is measured so),
    // and without WebGL there is nothing to lay out.
    this.el.layoutButtons.hidden =
      !this.viewer || !this.compare.isEnabled || this.cameraMode !== '3d';
    this.metrics.setPressed(this.metric);
    this.renderAreas();
  }

  /** The 2D view's part labels, for the active side. */
  private renderLabels(): void {
    if (!this.viewer) return;
    const view = this.cameraMode === '2d' ? this.cameraView : null;
    if (!view) {
      this.viewer.setLabels([]);
      return;
    }
    const ctx = {
      tables: this.tables,
      text: this.text,
      partRefs: this.partRefs,
    };
    this.viewer.setLabels(
      this.compare.isEnabled
        ? compareViewLabels(this.comparison, view, ctx)
        : singleViewLabels(this.measurement, view, {
            ...ctx,
            colors: this.drawn?.colors ?? NO_COLORS,
          })
    );
  }

  private renderAreas(): void {
    this.renderLabels();
    const ctx = {
      tables: this.tables,
      text: this.text,
      view: this.cameraView,
      onSelectView: (view: ViewName) => this.selectView(view),
    };
    if (this.compare.isEnabled) {
      renderComparePanel(this.el.areaPools, this.el.headline, this.comparison, {
        ...ctx,
        metric: this.metric,
      });
      return;
    }
    renderAreaPanel(this.el.areaPools, this.measurement, {
      ...ctx,
      colors: this.drawn?.colors ?? NO_COLORS,
    });
  }
}
