/**
 * The ModelViewer: owns the three.js scene/camera/renderer and rebuilds the
 * module geometry for a module list on demand. The list has the preset shape
 * (`CharacterPresetModule[]`); the /models page produces it from the user's
 * build (build/graph.ts `toPresetModules`).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Mat4 } from './math';
import { fetchJSON } from './data';
import { refToId } from '../../utils/object_reference';
import { computeModuleWorlds, modelIdForModule, sideForSocket } from './mount';
import { addModel, createTrack, type TrackedResources } from './scene';
import type { CharacterPresetModule } from '../../types/character_preset';
import type { Module, ModuleType } from '../../types/module';
import type { ModuleModel } from '../../types/model';

export interface BuildOptions {
  /** The module tree to render, parents before children. */
  modules: CharacterPresetModule[];
  /** One unique color per entry of `modules`; its hitbox uses it too. */
  colors: number[];
  /** Short description of what is being rendered, for the status line. */
  label: string;
  hitbox: boolean;
  skeleton: boolean;
}

const FALLBACK_COLOR = 0x9aa0a6;

export class ModelViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private track: TrackedResources = createTrack();
  private models = new Map<string, ModuleModel>();
  private status: HTMLElement;
  private container: HTMLElement;
  private framed = false;
  private generation = 0;

  constructor(container: HTMLElement, status: HTMLElement) {
    this.container = container;
    this.status = status;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14161a);
    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(1, container.clientHeight),
      1,
      100000,
    );
    this.camera.position.set(900, 700, 1400);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.GridHelper(6000, 120, 0x3a3f47, 0x23272e));
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x22242a, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 2.2);
    dir.position.set(1200, 1600, 900);
    this.scene.add(dir);
    this.scene.add(this.root);

    // Data is Z-up (UE); three.js is Y-up. Rotate the model group once.
    // UE is left-handed and three.js right-handed, so a rotation alone mirrors
    // the robot (left parts render on its right). Negate UE Y first (scale is
    // applied before rotation) to keep sides true to the game.
    this.root.rotation.x = -Math.PI / 2;
    this.root.scale.y = -1;

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setStatus(line: string): void {
    this.status.textContent = line;
  }

  private disposeTracked(): void {
    for (const obj of this.track.objs) obj.removeFromParent();
    for (const geo of this.track.geos) geo.dispose();
    for (const mat of this.track.mats) mat.dispose();
    this.track = createTrack();
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]);
  }

  async loadModel(cmId: string): Promise<ModuleModel | null> {
    const existing = this.models.get(cmId);
    if (existing) return existing;
    try {
      const model = await fetchJSON<ModuleModel>(
        `/WRFrontiersDB-Data/current/Models/${cmId}.json`,
      );
      this.models.set(cmId, model);
      return model;
    } catch (err) {
      console.warn(`model ${cmId}:`, err);
      return null;
    }
  }

  /** Every model file this build will need, resolved up front so the world
   * transforms can be computed with all parent skeletons already cached. */
  private neededModels(
    presetModules: CharacterPresetModule[],
    modules: Record<string, Module>,
    charModules: Record<string, unknown>,
  ): Set<string> {
    const needed = new Set<string>();
    presetModules.forEach((entry) => {
      const moduleId = refToId(entry.module_ref);
      const cmId = modelIdForModule(
        moduleId,
        modules,
        charModules,
        sideForSocket(entry.socket_name ?? ''),
      );
      if (cmId) needed.add(cmId);
    });
    return needed;
  }

  async build(opts: BuildOptions): Promise<void> {
    // Rapid changes start overlapping builds; only the latest may touch the scene.
    const generation = ++this.generation;
    this.setStatus('Loading data...');
    const modules = await fetchJSON<Record<string, Module>>(
      '/WRFrontiersDB-Data/current/Objects/Module.json',
    );
    const moduleTypes = await fetchJSON<Record<string, ModuleType>>(
      '/WRFrontiersDB-Data/current/Objects/ModuleType.json',
    );
    const charModules = await fetchJSON<Record<string, unknown>>(
      '/WRFrontiersDB-Data/current/Objects/CharacterModule.json',
    );

    const presetModules = opts.modules;

    // 1) Resolve + load every model this build needs BEFORE computing world
    //    transforms (socket frames come from the parent module's skeleton).
    const needed = this.neededModels(presetModules, modules, charModules);
    let missing = 0;
    await Promise.all(
      [...needed].map(async (id) => {
        const model = await this.loadModel(id);
        if (!model) missing += 1;
      }),
    );
    if (generation !== this.generation) return;

    // 2) Now that the models are cached, resolve the module world transforms.
    const placements = computeModuleWorlds(
      presetModules,
      modules,
      moduleTypes,
      charModules,
      this.models,
    );

    this.disposeTracked();
    let loaded = 0;

    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      if (!placement.model_id) continue;

      const model = this.models.get(placement.model_id) ?? null;
      if (!model) {
        missing += 1;
        continue;
      }

      this.addPlacement(model, placement.world, opts.colors[i] ?? FALLBACK_COLOR, opts);
      loaded += 1;
    }

    this.reportBuild(opts.label, loaded, missing);
    this.frameToRobot();
  }

  private addPlacement(
    model: ModuleModel,
    world: Mat4,
    color: number,
    opts: BuildOptions,
  ): void {
    addModel(
      this.root,
      model,
      world,
      color,
      { hitbox: opts.hitbox, skeleton: opts.skeleton },
      this.track,
    );
  }

  private reportBuild(label: string, loaded: number, missing: number): void {
    const verts = this.track.geos.reduce(
      (sum, g) => sum + (g.getAttribute('position')?.count ?? 0),
      0,
    );
    this.setStatus(
      `${label}: ${loaded} models loaded (${verts.toLocaleString()} verts)` +
        (missing > 0 ? `, ${missing} missing` : ''),
    );
  }

  /** On the first build, lift the camera and its aim point up by half the
   * assembled robot's height so the opening frame centers on the robot's
   * vertical midpoint instead of its feet (the origin). Only runs once per page
   * load so later orbit/zoom stays with the user. */
  private frameToRobot(): void {
    if (this.framed) return;
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return; // nothing rendered yet — retry on a later build
    const halfHeight = (box.max.y - box.min.y) / 2;
    this.camera.position.set(900, 700 + halfHeight, 1400);
    this.controls.target.set(0, halfHeight, 0);
    this.controls.update();
    this.framed = true;
  }
}
