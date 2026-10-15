/**
 * The /maps page controller: loads the map list (`Objects/Map.json`), wires
 * the map / mode pickers, the foliage toggle, the laser reset and the 3D / 2D
 * camera mode to the viewer, and keeps the URL in step (params.ts).
 */
import { fetchJson } from '../data/fetch';
import { localizePage } from '../localization';
import { FullscreenToggle } from '../viewer3d/ui/fullscreen';
import { queryAll, requireElement } from '../viewer3d/ui/dom';
import { isCameraMode, type CameraMode } from '../viewer3d/camera_mode';
import { ToggleGroup } from '../viewer3d/ui/toggle_group';
import { readMapUrl, resolveSelection, sortMaps, writeMapUrl } from './params';
import { describePins, firstSpawn, tintRange, type PowerupInfo } from './pins';
import { MapViewer, type LoadProgress } from './render/map_viewer';
import { isMapStringId, MapText, parseMapStrings } from './strings';
import type { GameMap, MapPins } from '../../types/map';

const DATA_ROOT = '/WRFrontiersDB-Data/current';

function pageElements() {
  return {
    page: requireElement('map-page', HTMLElement),
    status: requireElement('map-status', HTMLElement),
    viewport: requireElement('map-viewport', HTMLElement),
    canvas: requireElement('map-canvas', HTMLElement),
    loading: requireElement('map-loading', HTMLElement),
    fullscreen: requireElement('map-fullscreen', HTMLButtonElement),
    mapButtons: requireElement('map-picker', HTMLElement),
    modeButtons: requireElement('map-mode-picker', HTMLElement),
    noModes: requireElement('map-no-modes', HTMLElement),
    foliage: requireElement('map-foliage', HTMLInputElement),
    fly: requireElement('map-fly', HTMLButtonElement),
    speed: requireElement('map-speed', HTMLElement),
    resetLasers: requireElement('map-reset-lasers', HTMLButtonElement),
    cameraButtons: requireElement('map-camera-mode', HTMLElement),
    controls: queryAll(document, '[data-camera-controls]', HTMLElement),
  };
}

type PageElements = ReturnType<typeof pageElements>;

/** Set the attributes the page marks `data-map-<attr>="<string id>"`. */
function localizeAttributes(text: MapText): void {
  for (const attr of ['aria-label', 'title']) {
    for (const node of queryAll(document, `[data-map-${attr}]`, Element)) {
      const id = node.getAttribute(`data-map-${attr}`);
      if (isMapStringId(id)) node.setAttribute(attr, text.t(id));
    }
  }
}

const isString = (value: unknown): value is string => typeof value === 'string';

/** A key meant for a text field or a browser shortcut, not the page. */
function isTyping(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches('textarea, select, input:not([type=checkbox])'))
  );
}

export class MapPage {
  private map: GameMap | null = null;
  private mode: string | null = null;
  private foliage: boolean;
  private cameraMode: CameraMode;
  private locked = false;
  private pins: MapPins | null = null;
  /** The map whose foliage is loaded (it loads on first show). */
  private foliageLoaded: string | null = null;
  /** Map switches can overlap; only the latest may touch the page. */
  private generation = 0;
  private readonly mapPicker: ToggleGroup<string>;
  private readonly modePicker: ToggleGroup<string>;
  private readonly cameraPicker: ToggleGroup<CameraMode>;

  private constructor(
    private readonly el: PageElements,
    private readonly maps: readonly GameMap[],
    private readonly powerups: Readonly<Record<string, PowerupInfo>>,
    private readonly text: MapText,
    private readonly viewer: MapViewer
  ) {
    const url = readMapUrl(window.location.search);
    this.foliage = url.foliage;
    this.cameraMode = url.view;
    el.foliage.checked = this.foliage;
    this.mapPicker = new ToggleGroup(el.mapButtons, 'map', isString);
    this.modePicker = new ToggleGroup(el.modeButtons, 'mode', isString);
    this.cameraPicker = new ToggleGroup(
      el.cameraButtons,
      'camera',
      isCameraMode
    );
  }

  static async start(): Promise<void> {
    const el = pageElements();
    let text: MapText | null = null;
    try {
      const strings = parseMapStrings(el.page.dataset.strings ?? '');
      text = new MapText(strings, null);
      const [mapTable, powerups, localization] = await Promise.all([
        fetchJson<Record<string, GameMap>>(
          `${DATA_ROOT}/Objects/Map.json`
        ).catch((err: unknown) => {
          console.error('map list failed:', err);
          return {};
        }),
        fetchJson<Record<string, PowerupInfo>>(
          `${DATA_ROOT}/Objects/Powerup.json`
        ).catch(() => ({})),
        localizePage().catch((err: unknown) => {
          console.error('localization failed:', err);
          return null;
        }),
      ]);
      text = new MapText(strings, localization);
      localizeAttributes(text);
      // The picker's order (maps.astro sorts the same way).
      const maps = sortMaps(
        Object.values(mapTable),
        (map) => map.name?.en ?? map.id
      );
      if (maps.length === 0) {
        el.status.textContent = text.t('statusNoData');
        return;
      }
      let viewer: MapViewer;
      try {
        viewer = new MapViewer(el.canvas);
      } catch (err) {
        console.error('WebGL unavailable:', err);
        el.status.textContent = text.t('statusNoWebGl');
        return;
      }
      new MapPage(el, maps, powerups, text, viewer).run();
    } catch (err) {
      console.error('map viewer init failed:', err);
      const error = err instanceof Error ? err.message : String(err);
      el.status.textContent = text
        ? text.t('statusInitFailed', { error })
        : error;
    } finally {
      el.loading.remove();
    }
  }

  private run(): void {
    const { el, viewer, text } = this;
    this.mapPicker.onSelect((id) => {
      const map = this.maps.find((candidate) => candidate.id === id);
      if (map && map !== this.map) void this.showMap(map, null);
    });
    this.modePicker.onSelect((mode) => {
      if (mode !== this.mode) void this.showMode(mode);
    });
    el.foliage.addEventListener('change', () => {
      this.foliage = el.foliage.checked;
      void this.syncFoliage();
      this.syncUrl();
    });

    const fullscreen = new FullscreenToggle(
      el.viewport,
      el.fullscreen,
      { enter: text.t('fullscreenEnter'), exit: text.t('fullscreenExit') },
      () => {},
      // 2D needs no mouse capture.
      () => (this.cameraMode === '3d' ? viewer.canvas : null)
    );
    el.fly.addEventListener('click', () => void fullscreen.enter());
    document.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyF' || event.repeat || isTyping(event)) return;
      event.preventDefault();
      fullscreen.toggle();
    });
    viewer.onLockChange((locked) => {
      this.locked = locked;
      this.syncCamera();
    });
    this.cameraPicker.onSelect((mode) => {
      if (mode === this.cameraMode) return;
      this.cameraMode = mode;
      viewer.setCameraMode(mode);
      this.syncCamera();
      this.syncUrl();
    });
    viewer.setCameraMode(this.cameraMode);
    this.syncCamera();
    viewer.onSpeedChange((speed) => {
      el.speed.textContent = text.t('speed', { speed: Math.round(speed) });
    });
    // Lasers clear with the map (viewer.clear), not the mode.
    el.resetLasers.addEventListener('click', () => viewer.clearLasers());
    viewer.onLaserChange((count) => {
      el.resetLasers.disabled = count === 0;
    });

    const url = readMapUrl(window.location.search);
    const { map, mode } = resolveSelection(this.maps, url.map, url.mode);
    if (map) void this.showMap(map, mode);
  }

  private mapName(map: GameMap): string {
    if (map.name) return this.text.text(map.name);
    return map.id === 'FiringRange' ? this.text.t('firingRange') : map.id;
  }

  /** Switch to `map`, showing `mode` (null: its first). */
  private async showMap(map: GameMap, mode: string | null): Promise<void> {
    const { el, viewer, text } = this;
    const generation = ++this.generation;
    this.map = map;
    this.mode = resolveSelection([map], map.id, mode).mode;
    this.pins = null;
    this.foliageLoaded = null;
    this.mapPicker.setPressed(map.id);
    this.syncModeButtons();
    this.syncUrl();
    viewer.clear();

    const name = this.mapName(map);
    const progress = ({ loaded, total }: LoadProgress): void => {
      if (generation !== this.generation || total <= 0) return;
      el.status.textContent = text.t('statusLoadingMap', {
        map: name,
        loaded: (loaded / 1e6).toFixed(1),
        total: (total / 1e6).toFixed(1),
      });
    };
    el.status.textContent = text.t('statusLoading');
    try {
      const [pins] = await Promise.all([
        fetchJson<MapPins>(`${DATA_ROOT}/${map.files.pins}`),
        viewer.load('base', `${DATA_ROOT}/${map.files.base}`, progress),
      ]);
      if (generation !== this.generation) return;
      this.pins = pins;
      const range = tintRange(pins);
      if (range) viewer.setHeightRange(...range);
      const modePins = this.mode ? (pins.modes[this.mode]?.pins ?? []) : [];
      viewer.placeStart(firstSpawn(modePins), pins.playable_box);
      el.status.textContent = '';
      await Promise.all([this.showMode(this.mode), this.syncFoliage()]);
    } catch (err) {
      if (generation !== this.generation) return;
      console.error(`map ${map.id} failed:`, err);
      const error = err instanceof Error ? err.message : String(err);
      el.status.textContent = text.t('statusLoadFailed', { map: name, error });
    }
  }

  /** Show a game mode's pins and geometry on the current map. */
  private async showMode(mode: string | null): Promise<void> {
    const { viewer, map } = this;
    if (!map) return;
    this.mode = mode;
    this.modePicker.setPressed(mode);
    this.syncUrl();
    const entry = map.modes.find(({ id }) => id === mode);
    const pins = this.pins && mode ? (this.pins.modes[mode]?.pins ?? []) : [];
    viewer.setPins(describePins(pins, this.powerups), {
      beacon: (order) => this.text.t('beaconLabel', { order }),
      probe: (order) => this.text.t('probeLabel', { order }),
    });
    await viewer.load(
      'mode',
      entry?.file ? `${DATA_ROOT}/${entry.file}` : null
    );
  }

  /** Show or hide the foliage, loading it the first time it shows. */
  private async syncFoliage(): Promise<void> {
    const { viewer, map } = this;
    viewer.setFoliage(this.foliage);
    if (!map || !this.foliage || this.foliageLoaded === map.id) return;
    this.foliageLoaded = map.id;
    const file = map.files.foliage;
    await viewer.load('foliage', file ? `${DATA_ROOT}/${file}` : null);
  }

  /** Only the current map's modes are offered. */
  private syncModeButtons(): void {
    const modes = new Set(this.map?.modes.map(({ id }) => id) ?? []);
    for (const button of queryAll(
      this.el.modeButtons,
      'button',
      HTMLButtonElement
    )) {
      button.hidden = !modes.has(button.dataset.mode ?? '');
    }
    this.el.modeButtons.hidden = modes.size === 0;
    this.el.noModes.hidden = modes.size > 0;
  }

  /** The fly prompt, speed and controls list for the camera mode. */
  private syncCamera(): void {
    const { el } = this;
    const flat = this.cameraMode === '2d';
    this.cameraPicker.setPressed(this.cameraMode);
    el.fly.hidden = flat || this.locked;
    el.speed.hidden = flat;
    el.viewport.classList.toggle('is-flying', this.locked);
    for (const list of el.controls) {
      list.hidden = list.dataset.cameraControls !== this.cameraMode;
    }
  }

  private syncUrl(): void {
    writeMapUrl({
      map: this.map?.id ?? null,
      mode: this.mode,
      foliage: this.foliage,
      view: this.cameraMode,
    });
  }
}
