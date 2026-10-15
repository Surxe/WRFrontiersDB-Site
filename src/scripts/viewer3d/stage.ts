/**
 * What every 3D viewer on the site shares: a transparent WebGL canvas in a
 * container, the scene with its lights, a perspective camera, frames drawn on
 * demand, resizing with the container, projecting points to the canvas, and
 * camera framing and easing.
 *
 * Game data is Unreal's: centimeters, Z-up, left-handed. three.js is Y-up and
 * right-handed, so content goes into groups set up by `toUeSpace`.
 */
import * as THREE from 'three';
import type { ScreenPoint } from './anchored_tags';

/** A perspective camera pose. */
export interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface StageOptions {
  /** Vertical field of view, degrees. */
  fov: number;
  near: number;
  far: number;
}

/** How long a camera reframe (easeTo) takes. */
const EASE_MS = 450;

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/** Make `group` take Unreal coordinates: negate UE Y (scale applies before
 * rotation), then rotate Z up to Y, so sides stay true to the game. Net
 * effect: UE (x, y, z) -> three (x, z, y). */
export function toUeSpace(group: THREE.Object3D): void {
  group.scale.y = -1;
  group.rotation.x = -Math.PI / 2;
}

/** A UE direction (or point) in scene space; see toUeSpace. */
export const ueDirection = ([x, y, z]: readonly [
  number,
  number,
  number,
]): THREE.Vector3 => new THREE.Vector3(x, z, y);

export abstract class Stage {
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene = new THREE.Scene();
  protected readonly camera: THREE.PerspectiveCamera;
  private renderRequested = false;
  /** An in-progress camera reframe (easeTo), moving the camera and `target`. */
  private ease: {
    from: Pose;
    to: Pose;
    target: THREE.Vector3;
    start: number;
  } | null = null;

  constructor(
    protected readonly container: HTMLElement,
    { fov, near, far }: StageOptions
  ) {
    // Transparent: the container's (design token) background shows through.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  }

  /** The canvas the viewer draws into. */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** The shared lighting: a cool sky / dark ground fill and a sun. */
  protected addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x22242a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1200, 1600, 900);
    this.scene.add(sun);
  }

  /** Follow the container's size from now on. Call once the subclass is set
   * up, since resize() may be overridden. */
  protected observeResize(): void {
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.resize();
  }

  /** Draw a frame soon (once, however often it is asked for). */
  protected requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => this.render());
  }

  /** Draw the scene; overlays and controls hook in by overriding. */
  protected frame(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private render(): void {
    this.renderRequested = false;
    this.stepEase();
    this.frame();
  }

  protected resize(): void {
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.requestRender();
  }

  /** `anchor`'s canvas position through `camera`; null when off camera. */
  protected toScreen(
    anchor: THREE.Vector3 | null,
    camera: THREE.Camera = this.camera
  ): ScreenPoint {
    if (!anchor) return null;
    const v = anchor.clone().project(camera);
    if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) return null;
    return {
      x: ((v.x + 1) / 2) * this.container.clientWidth,
      y: ((1 - v.y) / 2) * this.container.clientHeight,
    };
  }

  /** The camera pose that frames all of `object` from direction `from`
   * (scene space, object toward camera). Null when it is empty. */
  protected perspectiveFit(
    object: THREE.Object3D,
    from: THREE.Vector3
  ): Pose | null {
    return this.boxFit(new THREE.Box3().setFromObject(object), from);
  }

  /** The camera pose that frames `box` (scene space) from direction `from`.
   * Null when it is empty. */
  protected boxFit(box: THREE.Box3, from: THREE.Vector3): Pose | null {
    if (box.isEmpty()) return null;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Fit the narrower of the vertical and horizontal fields of view (a tall
    // screen crops the sides).
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

  /** Move the camera smoothly to `to`, a frame at a time, carrying `target`
   * (the point the camera's controls orbit or look at) along. */
  protected easeTo(to: Pose, target: THREE.Vector3): void {
    this.ease = {
      from: { position: this.camera.position.clone(), target: target.clone() },
      to,
      target,
      start: performance.now(),
    };
    this.requestRender();
  }

  /** Stop a reframe where it is (the user took the camera back). */
  protected cancelEase(): void {
    this.ease = null;
  }

  private stepEase(): void {
    if (!this.ease) return;
    const { from, to, target, start } = this.ease;
    const t = Math.min(1, (performance.now() - start) / EASE_MS);
    const k = easeInOut(t);
    this.camera.position.lerpVectors(from.position, to.position, k);
    target.lerpVectors(from.target, to.target, k);
    if (t < 1) this.requestRender();
    else this.ease = null;
  }
}
