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
import {
  addModel,
  createTrack,
  primitiveGeometry,
  type TrackedResources,
  type ZoneColorFn,
} from './scene';
import {
  DIFF_A_ONLY,
  DIFF_B_ONLY,
  DIFF_SHARED,
  VIEWS,
  VIEW_ORDER,
  collectBodies,
  measureBuild,
  measureComparison,
  type ComparisonView,
  type DiffRaster,
  type HitboxBody,
  type HitboxPool,
  type ViewAreas,
  type ViewName,
} from './hitbox_area';
import { toThree, type Mat4 } from './math';
import type { ModulePlacement } from './mount';
import { diffPlacements } from './placement_diff';
import { DIFF_COLORS } from './colors';
import { LABEL_GUTTER_PX, LabelOverlay, type ScreenPoint, type ViewLabel } from './label_overlay';
import type { CharacterPresetModule } from '../../types/character_preset';
import type { Module, ModuleType } from '../../types/module';
import type { ModuleModel, Vec3 } from '../../types/model';

export interface BuildOptions {
  /** The module tree to render, parents before children. */
  modules: CharacterPresetModule[];
  /** One unique color per entry of `modules`; its hitbox uses it too. */
  colors: number[];
  /** Health pools (armor zones) with a color of their own (the chassis legs),
   * overriding their module's color. */
  zoneColors: Record<string, number>;
  /** Short description of what is being rendered, for the status line. */
  label: string;
  mesh: boolean;
  hitbox: boolean;
  skeleton: boolean;
  /** Compare against build B (`modules` is then build A): both are drawn
   * overlapping in the diff colors instead of module colors. */
  compare?: { modules: CharacterPresetModule[] };
}

/** Opacity of a compared build's changed meshes, so overlapping A and B
 * parts show through each other. */
const CHANGED_MESH_OPACITY = 0.55;

const FALLBACK_COLOR = 0x9aa0a6;

/** Color of a module's parts: its armor zone's own color if it has one (the
 * chassis legs), else the module's. */
function colorFor(opts: BuildOptions, moduleIndex: number): ZoneColorFn {
  const moduleColor = opts.colors[moduleIndex] ?? FALLBACK_COLOR;
  return (zone) => (zone ? opts.zoneColors[zone] : undefined) ?? moduleColor;
}
/** Ray grid spacing (cm) for area measurement: within ~0.3% of a 1 cm grid at
 * a quarter of the cost. */
const AREA_CELL_CM = 2;

/** UE unit vector from the robot's front (+X), turned `yawDeg` toward its
 * right (+Y) and raised `pitchDeg`. */
function fromFront(yawDeg: number, pitchDeg: number): Vec3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)];
}

/** Opening camera direction (robot toward camera): nearly head-on, for a
 * slight angle from the robot's right and above. */
const DEFAULT_CAMERA_FROM = fromFront(20, 12);

export interface HitboxMeasurement {
  pools: HitboxPool[];
  areas: Record<ViewName, ViewAreas>;
}

export interface ComparisonMeasurement {
  poolsA: HitboxPool[];
  poolsB: HitboxPool[];
  views: Record<ViewName, ComparisonView>;
}

type HitboxSet = { pools: HitboxPool[]; bodies: HitboxBody[] };

/** A part label for the axis views, pointing at `anchor` (UE, as
 * ViewAreas.anchors gives it). */
export interface AnchoredLabel extends ViewLabel {
  anchor: Vec3;
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
  private hitboxes: HitboxSet | null = null;
  /** Build B's hitboxes while comparing, else null. */
  private hitboxesB: HitboxSet | null = null;
  /** Per-view A vs B silhouette diffs, once measured. */
  private diffRasters: Partial<Record<ViewName, DiffRaster>> | null = null;
  /** The diff image shown in an axis view while comparing. */
  private diffPlane: { mesh: THREE.Mesh; texture: THREE.DataTexture } | null = null;
  private track: TrackedResources = createTrack();
  private models = new Map<string, ModuleModel>();
  private status: HTMLElement;
  private container: HTMLElement;
  private framed = false;
  private generation = 0;
  private labels: LabelOverlay;
  private labelAnchors: THREE.Vector3[] = [];

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

    this.labels = new LabelOverlay(container);

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
    if (this.view && this.labelAnchors.length > 0) this.layoutLabels();
  }

  /** Show part labels in the axis views (replacing any), or none. */
  setLabels(labels: readonly AnchoredLabel[]): void {
    const hadLabels = !this.labels.isEmpty;
    this.labels.set(labels);
    // UE -> scene, as the silhouettes group maps it.
    this.silhouettes.updateMatrixWorld();
    this.labelAnchors = labels.map(({ anchor }) =>
      this.silhouettes.localToWorld(new THREE.Vector3(...anchor)),
    );
    // Make room for the label columns (or give it back); only on a change,
    // as refitting drops the user's zoom and pan.
    if (this.view && hadLabels !== labels.length > 0) this.fitOrtho();
  }

  private layoutLabels(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const points: ScreenPoint[] = this.labelAnchors.map((anchor) => {
      v.copy(anchor).project(this.ortho);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    });
    this.labels.layout(points, w, h);
  }

  setStatus(line: string): void {
    this.status.textContent = line;
  }

  private disposeTracked(): void {
    for (const obj of this.track.objs) obj.removeFromParent();
    for (const geo of this.track.geos) geo.dispose();
    for (const mat of this.track.mats) mat.dispose();
    this.track = createTrack();
    this.disposeDiffPlane();
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
    const compareModules = opts.compare?.modules ?? null;

    // 1) Resolve + load every model this build needs BEFORE computing world
    //    transforms (socket frames come from the parent module's skeleton).
    const needed = this.neededModels(presetModules, modules, charModules);
    if (compareModules) {
      for (const id of this.neededModels(compareModules, modules, charModules)) {
        needed.add(id);
      }
    }
    let missing = 0;
    await Promise.all(
      [...needed].map(async (id) => {
        const model = await this.loadModel(id);
        if (!model) missing += 1;
      }),
    );
    if (generation !== this.generation) return;

    // 2) Now that the models are cached, resolve the module world transforms.
    const tables = { modules, moduleTypes };
    const place = (list: CharacterPresetModule[]): ModulePlacement[] =>
      computeModuleWorlds(list, modules, moduleTypes, charModules, this.models);
    const placements = place(presetModules);
    const placementsB = compareModules ? place(compareModules) : null;

    this.disposeTracked();
    this.setLabels([]); // until the new build is measured
    this.diffRasters = null;
    this.hitboxes = collectBodies(presetModules, placements, this.models, tables);
    this.hitboxesB =
      compareModules && placementsB
        ? collectBodies(compareModules, placementsB, this.models, tables)
        : null;

    let loaded = 0;
    const draw = (
      placement: ModulePlacement,
      colorOf: ZoneColorFn,
      meshOpacity = 1,
    ): void => {
      if (!placement.model_id) return;
      const model = this.models.get(placement.model_id);
      if (!model) {
        missing += 1;
        return;
      }
      this.addPlacement(model, placement.world, colorOf, opts, meshOpacity);
      loaded += 1;
    };

    if (!placementsB) {
      this.addSilhouettes(this.hitboxes.bodies, opts);
      placements.forEach((placement, i) => draw(placement, colorFor(opts, i)));
    } else {
      // Compare: shared parts once (grey, from A), A-only orange, B-only blue.
      // The axis views show the measured diff image instead (see
      // measureComparison), so no per-module silhouettes are built.
      const { sharedA, sharedB } = diffPlacements(placements, placementsB);
      const flat = (color: number): ZoneColorFn => () => color;
      placements.forEach((placement, i) =>
        sharedA[i]
          ? draw(placement, flat(DIFF_COLORS.shared))
          : draw(placement, flat(DIFF_COLORS.aOnly), CHANGED_MESH_OPACITY),
      );
      placementsB.forEach((placement, i) => {
        if (!sharedB[i]) draw(placement, flat(DIFF_COLORS.bOnly), CHANGED_MESH_OPACITY);
      });
    }

    this.reportBuild(opts.label, loaded, missing);
    this.frameToRobot();
    if (this.view) this.fitOrtho();
  }

  /** A vs B areas and silhouette diffs of the compared builds, every view
   * (null unless the last build compared). Also enables the diff images in
   * the axis views. */
  measureComparison(): ComparisonMeasurement | null {
    if (!this.hitboxes || !this.hitboxesB) return null;
    const views = measureComparison(this.hitboxes, this.hitboxesB, AREA_CELL_CM);
    this.diffRasters = {};
    for (const view of VIEW_ORDER) {
      const diff = views[view].diff;
      if (diff) this.diffRasters[view] = diff;
    }
    if (this.view) {
      this.showDiffPlane(this.view);
      this.fitOrtho();
    }
    return { poolsA: this.hitboxes.pools, poolsB: this.hitboxesB.pools, views };
  }

  /** Per-pool hitbox areas (cm^2) of the current build, every view. */
  measureHitboxes(): HitboxMeasurement | null {
    if (!this.hitboxes) return null;
    const { pools, bodies } = this.hitboxes;
    return { pools, areas: measureBuild(bodies, pools.length, AREA_CELL_CM) };
  }

  /** Switch to an orthographic axis view of the flat, opaque hitbox
   * silhouettes, or back to the free 3D view (left at its current angle;
   * see lookFrom). */
  setView(view: ViewName | null): void {
    if (view === this.view) return;
    this.view = view;
    const axis = view !== null;
    this.root.visible = !axis;
    this.grid.visible = !axis;
    this.silhouettes.visible = axis;
    this.labels.visible = axis;
    this.controls.enableRotate = !axis;
    this.controls.object = axis ? this.ortho : this.camera;
    if (axis) {
      if (this.diffRasters) this.showDiffPlane(view);
      this.fitOrtho();
    }
    this.controls.update();
  }

  /** Aim the 3D camera at the robot from `side`. */
  lookFrom(side: ViewName): void {
    const [dx, dy, dz] = VIEWS[side].dir;
    // Straight down is a degenerate orbit; lean back a hair so the robot's
    // front stays at the top of the screen, as in the 2D Top view.
    this.aimPerspective(side === 'top' ? [-0.01, 0, 1] : [-dx, -dy, -dz]);
  }

  /** Call `cb` when the user rotates the 3D camera (not on zoom or pan). */
  onOrbit(cb: () => void): void {
    let dragging = false;
    let azimuth = 0;
    let polar = 0;
    this.controls.addEventListener('start', () => {
      dragging = true;
      azimuth = this.controls.getAzimuthalAngle();
      polar = this.controls.getPolarAngle();
    });
    this.controls.addEventListener('end', () => {
      dragging = false;
    });
    this.controls.addEventListener('change', () => {
      if (!dragging || this.view) return;
      if (
        Math.abs(this.controls.getAzimuthalAngle() - azimuth) > 1e-4 ||
        Math.abs(this.controls.getPolarAngle() - polar) > 1e-4
      ) {
        dragging = false;
        cb();
      }
    });
  }

  /** Aim the perspective camera at the robot's center from direction `from`
   * (UE, robot toward camera), far enough back to fit the whole robot. */
  private aimPerspective(from: Vec3): boolean {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return false;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // UE (X fwd, Y right, Z up) -> this scene is (x, z, y); see the root transform.
    const dir = new THREE.Vector3(from[0], from[2], from[1]).normalize();
    this.camera.position.copy(sphere.center).addScaledVector(dir, dist);
    this.controls.target.copy(sphere.center);
    this.controls.update();
    return true;
  }

  /** Colored as in the 3D view: by module, or by health pool (armor zone)
   * where it has its own color. */
  private addSilhouettes(bodies: HitboxBody[], opts: BuildOptions): void {
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
    for (const body of bodies) {
      for (const prim of body.primitives) {
        const mat = matFor(colorFor(opts, body.moduleIndex)(prim.zone));
        const geo = primitiveGeometry(prim);
        geo.applyMatrix4(toThree(prim.m));
        const obj = new THREE.Mesh(geo, mat);
        this.silhouettes.add(obj);
        this.track.geos.push(geo);
        this.track.objs.push(obj);
      }
    }
  }

  /** Aim the orthographic camera down the active view's axis, framing the
   * whole robot. */
  private fitOrtho(): void {
    if (!this.view) return;
    const box = new THREE.Box3().setFromObject(this.silhouettes);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    // With labels, shrink the robot to fit between their columns.
    const gutter = this.labels.isEmpty ? 0 : Math.min(LABEL_GUTTER_PX, w * 0.25);
    const r = sphere.radius * 1.05 * Math.max(1, h / Math.max(1, w - 2 * gutter));
    // UE (X fwd, Y right, Z up) -> this scene is (x, z, y); see the root transform.
    const [dx, dy, dz] = VIEWS[this.view].dir;
    const dir = new THREE.Vector3(dx, dz, dy);
    this.ortho.up.set(0, 1, 0);
    if (this.view === 'top') this.ortho.up.set(1, 0, 0); // robot's front up
    this.ortho.position.copy(sphere.center).addScaledVector(dir, -r * 4);
    const aspect = w / h;
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
    colorOf: ZoneColorFn,
    opts: BuildOptions,
    meshOpacity: number,
  ): void {
    addModel(
      this.root,
      model,
      world,
      colorOf,
      {
        mesh: opts.mesh,
        hitbox: opts.hitbox,
        skeleton: opts.skeleton,
        meshOpacity,
      },
      this.track,
    );
  }

  private disposeDiffPlane(): void {
    if (!this.diffPlane) return;
    const { mesh, texture } = this.diffPlane;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    texture.dispose();
    this.diffPlane = null;
  }

  /** Show `view`'s A vs B diff raster as a flat image: one texel per ray grid
   * cell, laid on the grid's own plane in UE space (so it lines up with the
   * robot exactly), in front of it along the view direction. */
  private showDiffPlane(view: ViewName): void {
    this.disposeDiffPlane();
    const raster = this.diffRasters?.[view];
    if (!raster) return;
    const { grid, states } = raster;

    const rgba = (color: number): [number, number, number, number] => [
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      255,
    ];
    const palette: Record<number, [number, number, number, number]> = {
      [DIFF_SHARED]: rgba(DIFF_COLORS.shared),
      [DIFF_A_ONLY]: rgba(DIFF_COLORS.aOnly),
      [DIFF_B_ONLY]: rgba(DIFF_COLORS.bOnly),
    };
    const data = new Uint8Array(states.length * 4);
    states.forEach((state, c) => {
      const px = palette[state];
      if (px) data.set(px, c * 4);
    });
    const texture = new THREE.DataTexture(data, grid.nu, grid.nv, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const { dir, u, v } = VIEWS[view];
    const u1 = grid.u0 + grid.nu * grid.cell;
    const v1 = grid.v0 + grid.nv * grid.cell;
    const corner = (su: number, sv: number): number[] =>
      [0, 1, 2].map((k) => u[k] * su + v[k] * sv + dir[k] * grid.start);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          ...corner(grid.u0, grid.v0),
          ...corner(u1, grid.v0),
          ...corner(u1, v1),
          ...corner(grid.u0, v1),
        ],
        3,
      ),
    );
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.silhouettes.add(mesh);
    this.diffPlane = { mesh, texture };
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

  /** On the first build, aim at the assembled robot's center from the default
   * angle. Only runs once per page load so later orbit/zoom stays with the
   * user. */
  private frameToRobot(): void {
    if (this.framed) return;
    // Nothing rendered yet: retry on a later build.
    this.framed = this.aimPerspective(DEFAULT_CAMERA_FROM);
  }
}
