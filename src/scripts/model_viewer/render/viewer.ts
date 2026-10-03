/**
 * The 3D viewer: owns the three.js scene, cameras and renderer, and draws
 * assembled builds (robot/assembly.ts). It has no data loading, measuring or
 * page text of its own; the page controller hands it what to show.
 *
 * Two camera modes: a free perspective orbit, and flat orthographic axis views
 * of the hitbox silhouettes (optionally overlaid with an A vs B diff image and
 * part labels).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  addModel,
  clearGroup,
  primitiveGeometry,
  type ZoneColorFn,
} from './scene';
import {
  LABEL_GUTTER_PX,
  LabelOverlay,
  type ScreenPoint,
  type ViewLabel,
} from './label_overlay';
import { BuildTags } from './build_tags';
import {
  compareOffset,
  hitboxBounds,
  type CompareLayout,
} from './compare_layout';
import { VIEWS, type ViewName } from '../../robot/hitbox_area/views';
import { DiffState, type DiffRaster } from '../../robot/hitbox_area/measure';
import { diffPlacements } from '../../robot/model/placement_diff';
import { DIFF_COLORS, partColor, type BuildColors } from '../colors';
import type { Assembly } from '../../robot/assembly';
import type { ModulePlacement } from '../../robot/model/mount';
import type { Vec3 } from '../../../types/model';

/** What to draw: one build in its module colors, or two compared. */
export interface ViewerContent {
  a: Assembly;
  /** Build A's colors (unused while comparing). */
  colors: BuildColors;
  /** Build B: both are then drawn in the diff colors, overlapping or side
   * by side (setCompareLayout). */
  b: Assembly | null;
  mesh: boolean;
  hitbox: boolean;
}

/** A part label for the axis views, pointing at `anchor` (UE, as
 * ViewAreas.anchors gives it). */
export interface AnchoredLabel extends ViewLabel {
  anchor: Vec3;
}

/** The builds' names, for their tags while comparing side by side. */
export interface BuildNames {
  a: string;
  b: string;
}

/** Opacity of a compared build's changed meshes, so overlapping A and B
 * parts show through each other. */
const CHANGED_MESH_OPACITY = 0.55;

const FIELD_OF_VIEW = 55;

/** How long the 3D camera takes to reframe on a compare layout change. */
const EASE_MS = 450;

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/** A perspective camera pose. */
interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const flat =
  (color: number): ZoneColorFn =>
  () =>
    color;

/** UE direction from the robot's front (+X), turned `yawDeg` toward its right
 * (+Y) and raised `pitchDeg`. */
function fromFront(yawDeg: number, pitchDeg: number): Vec3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return [
    Math.cos(pitch) * Math.cos(yaw),
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
  ];
}

/** Opening camera direction (robot toward camera): nearly head-on, slightly
 * from the robot's right and above. */
const DEFAULT_CAMERA_FROM = fromFront(20, 12);

/** A UE direction in scene space: data is Z-up UE, three.js Y-up; see the
 * model groups' transform. */
const ueDirection = ([x, y, z]: Vec3): THREE.Vector3 =>
  new THREE.Vector3(x, z, y);

const cssColor = (element: Element, token: string): THREE.Color =>
  new THREE.Color(getComputedStyle(element).getPropertyValue(token).trim());

/** RGBA texel per DiffState (DiffState.None stays transparent). */
const RGBA_BY_STATE: ReadonlyMap<number, readonly number[]> = new Map(
  (
    [
      [DiffState.Shared, DIFF_COLORS.shared],
      [DiffState.AOnly, DIFF_COLORS.aOnly],
      [DiffState.BOnly, DIFF_COLORS.bOnly],
    ] as const
  ).map(([state, color]) => [
    state,
    [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255],
  ])
);

export class ModelViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1e5);
  private readonly controls: OrbitControls;
  private readonly grid: THREE.GridHelper;
  /** The 3D view: module meshes and translucent hitboxes, build A's and (while
   * comparing) build B's, B offset per the compare layout. */
  private readonly models = new THREE.Group();
  private readonly modelsA = new THREE.Group();
  private readonly modelsB = new THREE.Group();
  /** The axis views: flat, opaque per-pool hitbox silhouettes (or the diff
   * image while comparing). */
  private readonly silhouettes = new THREE.Group();
  private readonly labels: LabelOverlay;
  private labelAnchors: THREE.Vector3[] = [];
  private readonly tags: BuildTags;
  /** Atop each build's center (A, B; null: nothing drawn), while the tags
   * show. */
  private tagAnchors: (THREE.Vector3 | null)[] = [];
  private content: ViewerContent | null = null;
  private compareLayout: CompareLayout = 'overlap';
  private view: ViewName | null = null;
  private diffRasters: Partial<Record<ViewName, DiffRaster>> = {};
  private framed = false;
  private renderRequested = false;
  /** An in-progress camera reframe (easeTo). */
  private ease: { from: Pose; to: Pose; start: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    names: BuildNames
  ) {
    // Transparent: the container's (design token) background shows through.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 1e5);
    this.camera.position.set(900, 700, 1400);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', () => this.requestRender());
    // The user takes the camera back mid-reframe.
    this.controls.addEventListener('start', () => {
      this.ease = null;
    });

    this.grid = new THREE.GridHelper(
      6000,
      120,
      cssColor(container, '--wrf-border'),
      cssColor(container, '--wrf-surface')
    );
    this.scene.add(
      this.grid,
      new THREE.HemisphereLight(0xbfd4ff, 0x22242a, 1.6),
      this.models,
      this.silhouettes
    );
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1200, 1600, 900);
    this.scene.add(sun);

    // UE is Z-up and left-handed, three.js Y-up and right-handed: negate UE Y
    // (scale applies before rotation), then rotate Z up to Y, so the robot's
    // sides stay true to the game. Net effect: UE (x, y, z) -> (x, z, y).
    for (const group of [this.models, this.silhouettes]) {
      group.scale.y = -1;
      group.rotation.x = -Math.PI / 2;
    }
    this.silhouettes.visible = false;
    this.models.add(this.modelsA, this.modelsB);

    this.labels = new LabelOverlay(container);
    this.tags = new BuildTags(container, [
      { text: names.a, color: DIFF_COLORS.aOnly },
      { text: names.b, color: DIFF_COLORS.bOnly },
    ]);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Replace the drawn builds. */
  show(content: ViewerContent): void {
    this.content = content;
    clearGroup(this.silhouettes);
    this.diffRasters = {};
    this.setLabels([]);
    // The axis views show the measured diff image instead while comparing
    // (setDiffRasters).
    if (!content.b) this.addSilhouettes(content.a, content.colors);
    this.drawModels();
    this.frameOnce();
    if (this.view) this.fitOrtho();
    this.requestRender();
  }

  /** Overlap the compared builds in the 3D view, or stand B beside A. Eases
   * the 3D camera to frame the new layout. */
  setCompareLayout(layout: CompareLayout): void {
    if (layout === this.compareLayout) return;
    this.compareLayout = layout;
    if (!this.content?.b) return;
    this.drawModels();
    if (!this.view) {
      const to = this.perspectiveFit(
        this.camera.position.clone().sub(this.controls.target)
      );
      if (to) this.easeTo(to);
    }
    this.requestRender();
  }

  /** The measured A vs B silhouette diff per view, shown in the axis views
   * while comparing. */
  setDiffRasters(rasters: Partial<Record<ViewName, DiffRaster>>): void {
    this.diffRasters = rasters;
    if (this.view && this.comparing) {
      this.showDiffPlane(this.view);
      this.fitOrtho();
    }
    this.requestRender();
  }

  /** Switch to an orthographic axis view of the flat hitbox silhouettes, or
   * back to the free 3D view (left at its current angle; see lookFrom). */
  setView(view: ViewName | null): void {
    if (view === this.view) return;
    this.view = view;
    // The axis views share the orbit target; a reframe would drag them.
    this.ease = null;
    const axis = view !== null;
    this.models.visible = !axis;
    this.grid.visible = !axis;
    this.silhouettes.visible = axis;
    this.labels.visible = axis;
    this.tags.visible = this.showTags;
    this.controls.enableRotate = !axis;
    this.controls.object = axis ? this.ortho : this.camera;
    if (view) {
      if (this.comparing) this.showDiffPlane(view);
      this.fitOrtho();
    }
    this.controls.update();
    this.requestRender();
  }

  /** Aim the 3D camera at the robot from `side`. */
  lookFrom(side: ViewName): void {
    const [dx, dy, dz] = VIEWS[side].dir;
    // Straight down is a degenerate orbit; lean back a hair so the robot's
    // front stays at the top of the screen, as in the 2D Top view.
    this.aimPerspective(side === 'top' ? [-0.01, 0, 1] : [-dx, -dy, -dz]);
  }

  /** Keep the axis views' part labels clear of these controls over the
   * canvas. */
  avoidLabelsUnder(controls: readonly HTMLElement[]): void {
    this.labels.avoid = controls;
    this.requestRender();
  }

  /** Pan back to the robot's center, keeping the camera's angle and zoom. */
  recenter(): void {
    const box = new THREE.Box3().setFromObject(
      this.view ? this.silhouettes : this.models
    );
    if (box.isEmpty()) return;
    this.ease = null;
    const offset = box
      .getBoundingSphere(new THREE.Sphere())
      .center.sub(this.controls.target);
    this.controls.object.position.add(offset);
    this.controls.target.add(offset);
    this.controls.update();
    this.requestRender();
  }

  /** Call `listener` when the user rotates the 3D camera (not on zoom or
   * pan). */
  onOrbit(listener: () => void): void {
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
        listener();
      }
    });
  }

  /** Show part labels in the axis views (replacing any), or none. */
  setLabels(labels: readonly AnchoredLabel[]): void {
    const hadLabels = !this.labels.isEmpty;
    this.labels.set(labels);
    this.silhouettes.updateMatrixWorld();
    this.labelAnchors = labels.map(({ anchor }) =>
      this.silhouettes.localToWorld(new THREE.Vector3(...anchor))
    );
    // Make room for the label columns (or give it back); only on a change,
    // as refitting drops the user's zoom and pan.
    if (this.view && hadLabels !== labels.length > 0) this.fitOrtho();
    this.requestRender();
  }

  private get comparing(): boolean {
    return Boolean(this.content?.b);
  }

  /** The builds' name tags show in the 3D view while comparing side by
   * side. */
  private get showTags(): boolean {
    return !this.view && this.comparing && this.compareLayout === 'side';
  }

  /** Draw the content's builds into the 3D view: one in its module colors,
   * or two in the diff colors, B placed per the compare layout. */
  private drawModels(): void {
    clearGroup(this.modelsA);
    clearGroup(this.modelsB);
    this.modelsB.position.set(0, 0, 0);
    this.tagAnchors = [];
    this.tags.visible = this.showTags;
    const content = this.content;
    if (!content) return;
    const layers = { mesh: content.mesh, hitbox: content.hitbox };

    const draw = (
      group: THREE.Group,
      assembly: Assembly,
      placement: ModulePlacement,
      colorOf: ZoneColorFn,
      meshOpacity = 1
    ): void => {
      const model = placement.modelId
        ? assembly.models.get(placement.modelId)
        : undefined;
      if (!model) return;
      addModel(group, model, placement.world, colorOf, {
        ...layers,
        meshOpacity,
      });
    };

    const { a, b } = content;
    if (!b) {
      a.placements.forEach((placement, i) =>
        draw(this.modelsA, a, placement, (zone) =>
          partColor(content.colors, i, zone)
        )
      );
      return;
    }

    // Shared parts grey, A-only orange, B-only blue. Overlapping, the shared
    // parts are drawn once (from A) and the changed ones translucent, so A
    // and B show through each other; side by side, each build is whole and
    // opaque.
    const apart = this.compareLayout === 'side';
    const changedOpacity = apart ? 1 : CHANGED_MESH_OPACITY;
    const { sharedA, sharedB } = diffPlacements(a.placements, b.placements);
    a.placements.forEach((placement, i) =>
      sharedA[i]
        ? draw(this.modelsA, a, placement, flat(DIFF_COLORS.shared))
        : draw(
            this.modelsA,
            a,
            placement,
            flat(DIFF_COLORS.aOnly),
            changedOpacity
          )
    );
    b.placements.forEach((placement, i) => {
      if (!sharedB[i]) {
        draw(
          this.modelsB,
          b,
          placement,
          flat(DIFF_COLORS.bOnly),
          changedOpacity
        );
      } else if (apart) {
        draw(this.modelsB, b, placement, flat(DIFF_COLORS.shared));
      }
    });
    if (!apart) return;

    // modelsB sits in the models group's UE space, so the offset is UE.
    this.modelsB.position.set(
      ...compareOffset(
        'side',
        hitboxBounds(a.hitboxes),
        hitboxBounds(b.hitboxes)
      )
    );
    this.models.updateMatrixWorld(true);
    this.tagAnchors = [this.modelsA, this.modelsB].map((group) => {
      const box = new THREE.Box3().setFromObject(group);
      return box.isEmpty()
        ? null
        : box.getCenter(new THREE.Vector3()).setY(box.max.y);
    });
  }

  private requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => this.render());
  }

  /** One frame. Damping keeps `controls.update()` firing `change` (and so
   * requesting frames) until the camera settles; otherwise nothing renders. */
  private render(): void {
    this.renderRequested = false;
    this.stepEase();
    this.controls.update();
    this.renderer.render(this.scene, this.view ? this.ortho : this.camera);
    if (this.view && this.labelAnchors.length > 0) this.layoutLabels();
    if (this.showTags) this.layoutTags();
  }

  /** Move the 3D camera smoothly to `to`, a frame at a time. */
  private easeTo(to: Pose): void {
    this.ease = {
      from: {
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to,
      start: performance.now(),
    };
    this.requestRender();
  }

  private stepEase(): void {
    if (!this.ease) return;
    const { from, to, start } = this.ease;
    const t = Math.min(1, (performance.now() - start) / EASE_MS);
    const k = easeInOut(t);
    this.camera.position.lerpVectors(from.position, to.position, k);
    this.controls.target.lerpVectors(from.target, to.target, k);
    if (t < 1) this.requestRender();
    else this.ease = null;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.view) this.fitOrtho();
    this.requestRender();
  }

  /** `anchor`'s canvas position through `camera`; null when off camera. */
  private toScreen(
    anchor: THREE.Vector3 | null,
    camera: THREE.Camera
  ): ScreenPoint {
    if (!anchor) return null;
    const v = anchor.clone().project(camera);
    if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) return null;
    return {
      x: ((v.x + 1) / 2) * this.container.clientWidth,
      y: ((1 - v.y) / 2) * this.container.clientHeight,
    };
  }

  private layoutLabels(): void {
    this.labels.layout(
      this.labelAnchors.map((anchor) => this.toScreen(anchor, this.ortho)),
      this.container.clientWidth,
      this.container.clientHeight
    );
  }

  private layoutTags(): void {
    this.tags.layout(
      this.tagAnchors.map((anchor) => this.toScreen(anchor, this.camera))
    );
  }

  /** The perspective pose that frames everything drawn in the 3D view from
   * direction `from` (scene space, robot toward camera). Null when nothing is
   * drawn yet. */
  private perspectiveFit(from: THREE.Vector3): Pose | null {
    const box = new THREE.Box3().setFromObject(this.models);
    if (box.isEmpty()) return null;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Fit the narrower of the vertical and horizontal fields of view (a tall
    // screen crops the sides, as side-by-side builds would show).
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(halfV, halfH));
    return {
      position: sphere.center
        .clone()
        .addScaledVector(from.normalize(), distance),
      target: sphere.center,
    };
  }

  /** Aim the perspective camera at the robot's center from direction `from`
   * (UE, robot toward camera), far enough back to fit the whole robot. False
   * when nothing is drawn yet. */
  private aimPerspective(from: Vec3): boolean {
    const pose = this.perspectiveFit(ueDirection(from));
    if (!pose) return false;
    this.ease = null;
    this.camera.position.copy(pose.position);
    this.controls.target.copy(pose.target);
    this.controls.update();
    this.requestRender();
    return true;
  }

  /** On the first build with geometry, aim from the default angle. Only once
   * per page load, so later orbit/zoom stays with the user. */
  private frameOnce(): void {
    if (!this.framed) this.framed = this.aimPerspective(DEFAULT_CAMERA_FROM);
  }

  /** One opaque silhouette per hitbox, colored as in the 3D view. */
  private addSilhouettes(assembly: Assembly, colors: BuildColors): void {
    const materials = new Map<number, THREE.MeshBasicMaterial>();
    const materialFor = (color: number): THREE.MeshBasicMaterial => {
      let material = materials.get(color);
      if (!material) {
        material = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
        });
        materials.set(color, material);
      }
      return material;
    };
    for (const body of assembly.hitboxes.bodies) {
      for (const prim of body.primitives) {
        const color = partColor(colors, body.moduleIndex, prim.zone);
        this.silhouettes.add(
          new THREE.Mesh(primitiveGeometry(prim), materialFor(color))
        );
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
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    // With labels, shrink the robot to fit between their columns.
    const gutter = this.labels.isEmpty
      ? 0
      : Math.min(LABEL_GUTTER_PX, width * 0.25);
    const r =
      sphere.radius *
      1.05 *
      Math.max(1, height / Math.max(1, width - 2 * gutter));
    const aspect = width / height;
    this.ortho.up.set(0, 1, 0);
    if (this.view === 'top') this.ortho.up.set(1, 0, 0); // robot's front up
    this.ortho.position
      .copy(sphere.center)
      .addScaledVector(ueDirection(VIEWS[this.view].dir), -r * 4);
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
    this.requestRender();
  }

  /** Show `view`'s A vs B diff raster as a flat image, replacing any other:
   * one texel per ray grid cell, laid on the grid's own plane in UE space (so
   * it lines up with the robot exactly), in front of it. */
  private showDiffPlane(view: ViewName): void {
    clearGroup(this.silhouettes);
    const raster = this.diffRasters[view];
    if (!raster) return;
    const { grid, states } = raster;

    const data = new Uint8Array(states.length * 4);
    states.forEach((state, c) => {
      const rgba = RGBA_BY_STATE.get(state);
      if (rgba) data.set(rgba, c * 4);
    });
    const texture = new THREE.DataTexture(data, grid.nu, grid.nv);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const { dir, u, v } = VIEWS[view];
    const u1 = grid.u0 + grid.nu * grid.cell;
    const v1 = grid.v0 + grid.nv * grid.cell;
    const corner = (su: number, sv: number): number[] =>
      [0, 1, 2].map((k) => u[k] * su + v[k] * sv + dir[k] * grid.start);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          ...corner(grid.u0, grid.v0),
          ...corner(u1, grid.v0),
          ...corner(u1, v1),
          ...corner(grid.u0, v1),
        ],
        3
      )
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.silhouettes.add(new THREE.Mesh(geometry, material));
  }
}
