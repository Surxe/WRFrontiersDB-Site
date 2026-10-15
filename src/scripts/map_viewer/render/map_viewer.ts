/**
 * The 3D map viewer: a free-flying first-person camera (noclip, no physics)
 * over a cooked map (WRFrontiersDB-Parser maps/cook.py), with a mode's pins
 * on top. Desktop only: mouse-look needs pointer lock, moving a keyboard.
 *
 * The map files are glTF (meters, Y up), drawn scaled to centimeters so they
 * line up with the pins, which are in Unreal space (toUeSpace). Frames are
 * drawn on demand, and continuously while the pointer is locked.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Stage, ueDirection } from '../../viewer3d/stage';
import { PinLayer, type PinLabelText, type PinMarker } from '../pins';
import type { Vec3 } from '../../../types/map';

const FIELD_OF_VIEW = 70;
/** Centimeters. Maps are up to ~2 km across. */
const NEAR = 50;
const FAR = 1_000_000;
const METERS = 100;

/** Flying speed, cm/s: the default, the wheel's range, and Shift's boost. */
const DEFAULT_SPEED = 3000;
const MIN_SPEED = 250;
const MAX_SPEED = 40_000;
const WHEEL_STEP = 1.25;
const FAST = 4;
/** A frame longer than this (a hidden tab) moves no further. */
const MAX_FRAME_S = 0.1;

/** Where the camera starts relative to a spawn point: behind it, raised, and
 * to the side, so its pin does not stand in the middle of the view. */
const START_BACK = 4000;
const START_UP = 2000;
const START_SIDE = 2500;

/** Key -> movement in camera space: x right, y up (world), z forward. */
const MOVES: Readonly<Record<string, Vec3>> = {
  KeyW: [0, 0, 1],
  ArrowUp: [0, 0, 1],
  KeyS: [0, 0, -1],
  ArrowDown: [0, 0, -1],
  KeyD: [1, 0, 0],
  ArrowRight: [1, 0, 0],
  KeyA: [-1, 0, 0],
  ArrowLeft: [-1, 0, 0],
  Space: [0, 1, 0],
  KeyQ: [0, 1, 0],
  KeyC: [0, -1, 0],
  KeyE: [0, -1, 0],
};

/** The map's look: untextured, as the model viewer draws robots. */
const MATERIALS = {
  base: 0xa7acb3,
  foliage: 0x6f9a5b,
  /** Geometry only one game mode has (Mont's drill), set apart. */
  mode: 0xc9a46a,
} as const;

type Layer = keyof typeof MATERIALS;

export interface LoadProgress {
  loaded: number;
  total: number;
}

export class MapViewer extends Stage {
  private readonly controls: PointerLockControls;
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  /** glTF content, scaled from meters to centimeters. */
  private readonly world = new THREE.Group();
  private readonly layers: Record<Layer, THREE.Group> = {
    base: new THREE.Group(),
    foliage: new THREE.Group(),
    mode: new THREE.Group(),
  };
  private readonly materials: Record<Layer, THREE.Material>;
  /** Loads can overlap (a quick re-pick); only a layer's latest may land. */
  private readonly generation: Record<Layer, number> = {
    base: 0,
    foliage: 0,
    mode: 0,
  };
  private readonly pins: PinLayer;
  private readonly held = new Set<string>();
  private speed = DEFAULT_SPEED;
  private lastFrame: number | null = null;
  private speedListener: (metersPerSecond: number) => void = () => {};

  constructor(container: HTMLElement) {
    super(container, { fov: FIELD_OF_VIEW, near: NEAR, far: FAR });
    this.materials = {
      base: this.material(MATERIALS.base),
      foliage: this.material(MATERIALS.foliage),
      mode: this.material(MATERIALS.mode),
    };
    this.world.scale.setScalar(METERS);
    this.world.add(this.layers.base, this.layers.foliage, this.layers.mode);
    this.pins = new PinLayer(container);
    this.scene.add(this.world, this.pins.group);
    this.addLights();

    this.controls = new PointerLockControls(this.camera, this.canvas);
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('unlock', () => this.held.clear());
    // A key released while the window is away never sends its keyup.
    window.addEventListener('blur', () => this.held.clear());
    document.addEventListener('keydown', (event) => this.onKey(event, true));
    document.addEventListener('keyup', (event) => this.onKey(event, false));
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.controls.isLocked) return;
        event.preventDefault();
        this.setSpeed(
          this.speed * (event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP)
        );
      },
      { passive: false }
    );
    this.observeResize();
  }

  get locked(): boolean {
    return this.controls.isLocked;
  }

  /** Call `listener` when flying starts (true) or stops (false). */
  onLockChange(listener: (locked: boolean) => void): void {
    this.controls.addEventListener('lock', () => listener(true));
    this.controls.addEventListener('unlock', () => listener(false));
  }

  /** Call `listener` with the flying speed in m/s whenever it changes. */
  onSpeedChange(listener: (metersPerSecond: number) => void): void {
    this.speedListener = listener;
    listener(this.speed / METERS);
  }

  /** Load a glTF file into one of the layers, replacing what it held. */
  async load(
    layer: Layer,
    url: string | null,
    onProgress: (progress: LoadProgress) => void = () => {}
  ): Promise<void> {
    const group = this.layers[layer];
    const generation = ++this.generation[layer];
    clearLayer(group);
    this.requestRender();
    if (!url) return;
    const gltf = await this.loader.loadAsync(url, (event) =>
      onProgress({ loaded: event.loaded, total: event.total })
    );
    if (generation !== this.generation[layer]) {
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          for (const own of [node.material].flat()) own.dispose();
        }
      });
      clearLayer(gltf.scene);
      return;
    }
    const material = this.materials[layer];
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const own of [node.material].flat()) own.dispose();
      node.material = material;
    });
    clearLayer(group);
    group.add(gltf.scene);
    this.requestRender();
  }

  /** Drop every layer and pin (switching maps). */
  clear(): void {
    for (const layer of Object.keys(this.layers) as Layer[]) {
      this.generation[layer]++;
      clearLayer(this.layers[layer]);
    }
    this.pins.set([], { beacon: String, probe: String });
    this.requestRender();
  }

  setFoliage(visible: boolean): void {
    this.layers.foliage.visible = visible;
    this.requestRender();
  }

  setPins(markers: readonly PinMarker[], text: PinLabelText): void {
    this.pins.set(markers, text);
    this.requestRender();
  }

  /** Put the camera behind `spawn` (UE cm, facing `yaw`), looking toward
   * the middle of `box` (the playable space, UE cm); without a spawn, frame
   * the box (or else the map) from above a corner. */
  placeStart(
    spawn: { position: Vec3; yaw: number } | null,
    box: readonly [Vec3, Vec3] | null
  ): void {
    if (!spawn) {
      // Not the map's own bounds: the landscape reaches far beyond play.
      const from = ueDirection([-1, -1, 0.8]);
      const pose = box
        ? this.boxFit(
            new THREE.Box3().setFromPoints(
              box.map((corner) => ueDirection(corner))
            ),
            from
          )
        : this.perspectiveFit(this.layers.base, from);
      if (!pose) return;
      this.camera.position.copy(pose.position);
      this.camera.lookAt(pose.target);
      this.requestRender();
      return;
    }
    const center: Vec3 | null = box
      ? [(box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2, box[0][2]]
      : null;
    const [x, y, z] = spawn.position;
    const [cx, cy] = center ?? spawn.position;
    // Toward the map's middle, or the way the spawn faces if it is there.
    let dx = cx - x;
    let dy = cy - y;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      const yaw = THREE.MathUtils.degToRad(spawn.yaw);
      dx = Math.cos(yaw);
      dy = Math.sin(yaw);
    } else {
      dx /= length;
      dy /= length;
    }
    // Unreal is left-handed: (-dy, dx) is to the right of (dx, dy), so this
    // steps left.
    const eye: Vec3 = [
      x - dx * START_BACK + dy * START_SIDE,
      y - dy * START_BACK - dx * START_SIDE,
      z + START_UP,
    ];
    const look: Vec3 = [x + dx * START_BACK * 2, y + dy * START_BACK * 2, z];
    this.camera.position.copy(ueDirection(eye));
    this.camera.lookAt(ueDirection(look));
    this.requestRender();
  }

  protected override frame(): void {
    const now = performance.now();
    const moving = this.controls.isLocked && this.held.size > 0;
    if (moving && this.lastFrame !== null) {
      this.fly(Math.min(MAX_FRAME_S, (now - this.lastFrame) / 1000));
    }
    this.lastFrame = moving ? now : null;
    this.renderer.render(this.scene, this.camera);
    this.pins.layout((anchor) => this.toScreen(anchor), this.camera.position);
    if (moving) this.requestRender();
  }

  private fly(seconds: number): void {
    const step = new THREE.Vector3();
    for (const code of this.held) {
      const move = MOVES[code];
      if (move) step.add(new THREE.Vector3(...move));
    }
    if (step.lengthSq() === 0) return;
    const fast = this.held.has('ShiftLeft') || this.held.has('ShiftRight');
    const distance = this.speed * (fast ? FAST : 1) * seconds;
    // Forward is where the camera looks (noclip: up and down too); right is
    // level; up is the world's.
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3()
      .crossVectors(forward, this.camera.up)
      .normalize();
    const motion = new THREE.Vector3()
      .addScaledVector(right, step.x)
      .addScaledVector(this.camera.up, step.y)
      .addScaledVector(forward, step.z);
    if (motion.lengthSq() === 0) return;
    this.camera.position.addScaledVector(motion.normalize(), distance);
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    if (!this.controls.isLocked) return;
    const isMove = event.code in MOVES || event.code.startsWith('Shift');
    if (!isMove) return;
    // Space would scroll the page, arrows too.
    event.preventDefault();
    if (down) this.held.add(event.code);
    else this.held.delete(event.code);
    this.requestRender();
  }

  private setSpeed(speed: number): void {
    this.speed = THREE.MathUtils.clamp(speed, MIN_SPEED, MAX_SPEED);
    this.speedListener(this.speed / METERS);
  }

  private material(color: number): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }
}

/** Free a layer's geometry (its material is the viewer's, kept). */
function clearLayer(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (node instanceof THREE.InstancedMesh) node.dispose();
    if (node instanceof THREE.Mesh) node.geometry.dispose();
  });
  group.clear();
}
