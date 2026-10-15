/**
 * Colors a material by height while switched on, so the view from above
 * reads as terrain: low ground slate blue, through sage, to pale sand up high.
 * Lighting still shades it, so slopes keep their relief. Built into the
 * material's shader once (onBeforeCompile); switching is a uniform.
 */
import * as THREE from 'three';

const LOW = 0x3f5f7a;
const MID = 0x8f9f7a;
const HIGH = 0xe6dcc6;

export class HeightTint {
  private readonly uniforms = {
    heightTint: { value: 0 },
    /** Scene Y (UE Z, cm) of the ramp's ends. */
    heightRange: { value: new THREE.Vector2(0, 1) },
    heightLow: { value: new THREE.Color(LOW) },
    heightMid: { value: new THREE.Color(MID) },
    heightHigh: { value: new THREE.Color(HIGH) },
  };

  /** Make `material` take the tint. */
  apply(material: THREE.Material): void {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying float vHeight;\nvoid main() {')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 heightWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            heightWorld = instanceMatrix * heightWorld;
          #endif
          vHeight = (modelMatrix * heightWorld).y;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform float heightTint;
          uniform vec2 heightRange;
          uniform vec3 heightLow;
          uniform vec3 heightMid;
          uniform vec3 heightHigh;
          varying float vHeight;
          void main() {`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (heightTint > 0.5) {
            float h = clamp(
              (vHeight - heightRange.x) / max(heightRange.y - heightRange.x, 1.0),
              0.0,
              1.0
            );
            diffuseColor.rgb = h < 0.5
              ? mix(heightLow, heightMid, h * 2.0)
              : mix(heightMid, heightHigh, h * 2.0 - 1.0);
          }`
        );
    };
    material.needsUpdate = true;
  }

  set enabled(on: boolean) {
    this.uniforms.heightTint.value = on ? 1 : 0;
  }

  /** Ramp from `low` to `high` (scene Y). */
  setRange(low: number, high: number): void {
    this.uniforms.heightRange.value.set(low, high);
  }
}
