/**
 * Lasers shot from the flying camera: what the crosshair hits (a depth pick
 * of the screen's center pixel, as a CPU raycast over a map's tens of
 * millions of triangles would stall) and the red beams drawn to it, which
 * stay until cleared.
 */
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

export const LASER_COLOR = 0xff2a2a;
/** Beam width and hit dot size, px. */
const BEAM_PX = 3;
const DOT_PX = 9;

/**
 * Each fragment's distance from the eye (cm) in red, alpha 1; a cleared
 * pixel keeps alpha 0, i.e. nothing was hit. project_vertex applies an
 * InstancedMesh's instance matrix, as the map's meshes are instanced.
 */
const DISTANCE_MATERIAL = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    #include <common>
    varying float vDistance;
    void main() {
      #include <begin_vertex>
      #include <project_vertex>
      vDistance = length(mvPosition.xyz);
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vDistance;
    void main() {
      gl_FragColor = vec4(vDistance, 0.0, 0.0, 1.0);
    }
  `,
});

/** Reads the distance to whatever is under the screen's center pixel. */
export class CenterPick {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
  });
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly pixel = new Float32Array(4);
  private readonly clearColor = new THREE.Color();

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  /** How far (scene units) the nearest surface is along `camera`'s view
   * axis; null for open sky. The caller hides what a shot passes through
   * (pins, the lasers). */
  distance(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): number | null {
    const { renderer } = this;
    this.camera.copy(camera);
    // The 1x1 sub-view centered on the screen's middle.
    this.camera.setViewOffset(
      width,
      height,
      width / 2 - 0.5,
      height / 2 - 0.5,
      1,
      1
    );
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    scene.overrideMaterial = DISTANCE_MATERIAL;
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, this.camera);
      renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this.pixel);
    } finally {
      scene.overrideMaterial = null;
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(this.clearColor, previousAlpha);
    }
    return this.pixel[3]! > 0.5 ? this.pixel[0]! : null;
  }
}

/** The beams and their hit dots (scene space). */
export class LaserLayer {
  readonly group = new THREE.Group();
  private readonly segments: number[] = [];
  private readonly hits: number[] = [];
  private readonly beamMaterial = new LineMaterial({
    color: LASER_COLOR,
    linewidth: BEAM_PX,
  });
  private readonly dotMaterial = new THREE.PointsMaterial({
    color: LASER_COLOR,
    size: DOT_PX,
    sizeAttenuation: false,
  });
  private beams: LineSegments2 | null = null;
  private dots: THREE.Points | null = null;

  get count(): number {
    return this.segments.length / 6;
  }

  /** A beam from `from` to `to`, with a dot at `to` when it hit something. */
  add(from: THREE.Vector3, to: THREE.Vector3, hit: boolean): void {
    this.segments.push(...from.toArray(), ...to.toArray());
    if (hit) this.hits.push(...to.toArray());
    this.rebuild();
  }

  clear(): void {
    this.segments.length = 0;
    this.hits.length = 0;
    this.rebuild();
  }

  private rebuild(): void {
    this.beams?.geometry.dispose();
    this.dots?.geometry.dispose();
    this.group.clear();
    this.beams = null;
    this.dots = null;
    if (this.segments.length > 0) {
      const geometry = new LineSegmentsGeometry().setPositions(this.segments);
      this.beams = new LineSegments2(geometry, this.beamMaterial);
      this.group.add(this.beams);
    }
    if (this.hits.length > 0) {
      const geometry = new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(this.hits, 3)
      );
      this.dots = new THREE.Points(geometry, this.dotMaterial);
      this.group.add(this.dots);
    }
  }
}
