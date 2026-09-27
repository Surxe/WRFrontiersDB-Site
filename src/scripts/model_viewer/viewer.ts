/**
 * The ModelViewer: owns the three.js scene/camera/renderer and rebuilds the
 * module geometry for a module list on demand. The list has the preset shape
 * (`CharacterPresetModule[]`); the /models page produces it from the user's
 * build (build/graph.ts `toPresetModules`).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fetchJSON } from './data';
import { refToId } from '../../utils/object_reference';
import { computeModuleWorlds, modelIdForModule, sideForSocket } from './mount';
import { addModel, createTrack, primitiveGeometry, type TrackedResources } from './scene';
import {
  VIEWS,
  collectBodies,
  measureBuild,
  type HitboxBody,
  type HitboxPool,
  type PoolArea,
  type ViewName,
} from './hitbox_area';
import { toThree, type Mat4 } from './math';
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
/** Ray grid spacing (cm) for area measurement: within ~0.3% of a 1 cm grid at
 * a quarter of the cost. */
const AREA_CELL_CM = 2;

export interface HitboxMeasurement {
  pools: HitboxPool[];
  areas: Record<ViewName, PoolArea[]>;
}

export class ModelViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100000);
  private controls: OrbitControls;
  private grid: THREE.GridHelper;
  private root = new THREE.Group();
  /** Flat, opaque per-pool hitbox silhouettes shown in the axis views. */
  private silhouettes = new THREE.Group();
  private view: ViewName | null = null;
  private savedTarget = new THREE.Vector3();
  private hitboxes: { pools: HitboxPool[]; bodies: HitboxBody[] } | null = null;
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

    this.grid = new THREE.GridHelper(6000, 120, 0x3a3f47, 0x23272e);
    this.scene.add(this.grid);
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
    this.silhouettes.rotation.copy(this.root.rotation);
    this.silhouettes.scale.copy(this.root.scale);
    this.silhouettes.visible = false;
    this.scene.add(this.silhouettes);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.view) this.fitOrtho();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.view ? this.ortho : this.camera);
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
    while (this.silhouettes.children.length > 0) {
      this.silhouettes.remove(this.silhouettes.children[0]);
    }
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
    this.hitboxes = collectBodies(presetModules, placements, this.models, {
      modules,
      moduleTypes,
    });
    this.addSilhouettes(this.hitboxes.bodies, opts.colors);
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
    if (this.view) this.fitOrtho();
  }

  /** Per-pool hitbox areas (cm^2) of the current build, every view. */
  measureHitboxes(): HitboxMeasurement | null {
    if (!this.hitboxes) return null;
    const { pools, bodies } = this.hitboxes;
    return { pools, areas: measureBuild(bodies, pools.length, AREA_CELL_CM) };
  }

  /** Switch to an orthographic axis view of the flat, opaque hitbox
   * silhouettes, or back to the free 3D view. */
  setView(view: ViewName | null): void {
    if (view === this.view) return;
    if (!this.view) this.savedTarget.copy(this.controls.target);
    this.view = view;
    const axis = view !== null;
    this.root.visible = !axis;
    this.grid.visible = !axis;
    this.silhouettes.visible = axis;
    this.controls.enableRotate = !axis;
    this.controls.object = axis ? this.ortho : this.camera;
    if (axis) {
      this.fitOrtho();
    } else {
      this.controls.target.copy(this.savedTarget);
    }
    this.controls.update();
  }

  /** `colors` is per module-list entry, as for the 3D view, so each module's
   * silhouette matches its color there. */
  private addSilhouettes(bodies: HitboxBody[], colors: number[]): void {
    const mats = new Map<number, THREE.MeshBasicMaterial>();
    const matFor = (color: number): THREE.MeshBasicMaterial => {
      let mat = mats.get(color);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        mats.set(color, mat);
        this.track.mats.push(mat);
      }
      return mat;
    };
    bodies.forEach((body, i) => {
      const mat = matFor(colors[i] ?? FALLBACK_COLOR);
      for (const prim of body.primitives) {
        const geo = primitiveGeometry(prim);
        geo.applyMatrix4(toThree(prim.m));
        const obj = new THREE.Mesh(geo, mat);
        this.silhouettes.add(obj);
        this.track.geos.push(geo);
        this.track.objs.push(obj);
      }
    });
  }

  /** Aim the orthographic camera down the active view's axis, framing the
   * whole robot. */
  private fitOrtho(): void {
    if (!this.view) return;
    const box = new THREE.Box3().setFromObject(this.silhouettes);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius * 1.05;
    // UE (X fwd, Y right, Z up) -> this scene is (x, z, y); see the root transform.
    const [dx, dy, dz] = VIEWS[this.view].dir;
    const dir = new THREE.Vector3(dx, dz, dy);
    this.ortho.up.set(0, 1, 0);
    if (this.view === 'top') this.ortho.up.set(1, 0, 0); // robot's front up
    this.ortho.position.copy(sphere.center).addScaledVector(dir, -r * 4);
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.ortho.left = -r * aspect;
    this.ortho.right = r * aspect;
    this.ortho.top = r;
    this.ortho.bottom = -r;
    this.ortho.near = 1;
    this.ortho.far = r * 10;
    this.ortho.zoom = 1;
    this.ortho.updateProjectionMatrix();
    this.controls.target.copy(sphere.center);
    this.ortho.lookAt(sphere.center);
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
