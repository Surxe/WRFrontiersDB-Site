/**
 * The capsule drawn as a wireframe in place of the robot, plus a short line
 * along the floor normal under it.
 */
import * as THREE from 'three';
import { ueDirection } from '../../viewer3d/stage';
import type { Capsule } from '../../movement/collision/world';
import type { Vec3 } from '../../movement/math/vec';

/** Scene colors (drawn over the map, like the viewer's MATERIALS). */
const COLORS = {
  walking: 0x4fd1ff,
  falling: 0xffb347,
  normal: 0x7dff7d,
} as const;
const NORMAL_LENGTH = 300;

export class CapsuleMesh {
  readonly group = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: COLORS.walking,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  private readonly normalMaterial = new THREE.LineBasicMaterial({
    color: COLORS.normal,
    depthTest: false,
  });
  private readonly capsule: THREE.LineSegments;
  private readonly normal: THREE.Line;

  constructor(shape: Capsule) {
    // three's capsule stands along +Y, which is Unreal's +Z here.
    const geometry = new THREE.CapsuleGeometry(
      shape.radius,
      Math.max(0, 2 * (shape.halfHeight - shape.radius)),
      6,
      16
    );
    this.capsule = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      this.material
    );
    geometry.dispose();
    this.capsule.renderOrder = 10;
    const line = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, NORMAL_LENGTH, 0),
    ]);
    this.normal = new THREE.Line(line, this.normalMaterial);
    this.normal.renderOrder = 10;
    this.group.add(this.capsule, this.normal);
  }

  /** Move to `center` (UE cm); `floorNormal` null hides the normal line. */
  update(
    center: Vec3,
    falling: boolean,
    foot: Vec3,
    floorNormal: Vec3 | null
  ): void {
    this.capsule.position.copy(ueDirection([center.x, center.y, center.z]));
    this.material.color.setHex(falling ? COLORS.falling : COLORS.walking);
    this.normal.visible = floorNormal !== null;
    if (floorNormal) {
      this.normal.position.copy(ueDirection([foot.x, foot.y, foot.z]));
      this.normal.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        ueDirection([floorNormal.x, floorNormal.y, floorNormal.z]).normalize()
      );
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.capsule.geometry.dispose();
    this.normal.geometry.dispose();
    this.material.dispose();
    this.normalMaterial.dispose();
  }
}
