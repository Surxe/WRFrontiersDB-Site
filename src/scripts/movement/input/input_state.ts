/**
 * Player input as plain data, whatever device it came from (keyboard and
 * mouse now; a gamepad in 1.0), and the movement input vector it asks for.
 */
import { clampedToMaxSize, vec, type Vec3 } from '../math/vec';

export interface InputState {
  /** -1 (back) to 1 (forward). */
  forward: number;
  /** -1 (left) to 1 (right). */
  right: number;
  /** Where the view looks, UE degrees: yaw 0 faces +X, 90 faces +Y. */
  viewYaw: number;
  /** Degrees, positive up. */
  viewPitch: number;
  /** The jump input (Space) is held: the Jump Jet's activation. */
  jump: boolean;
  /** The dash input (Left Shift, the game's default, K1) is held. */
  dash: boolean;
}

export const NO_INPUT: InputState = {
  forward: 0,
  right: 0,
  viewYaw: 0,
  viewPitch: 0,
  jump: false,
  dash: false,
};

/**
 * The movement input vector (UE's AddMovementInput summed over the view's
 * forward and right axes, level with the ground), length at most 1.
 */
export function inputVector({ forward, right, viewYaw }: InputState): Vec3 {
  const yaw = (viewYaw * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // FRotationMatrix(yaw): X axis (cos, sin), Y axis (right) (-sin, cos).
  return clampedToMaxSize(
    vec(cos * forward - sin * right, sin * forward + cos * right, 0),
    1
  );
}

/**
 * Where the dash aims: the view's forward (FRotator(pitch, yaw, 0).Vector()).
 * The game aims from the capsule at its aim component's target point
 * (ASCharacter+0x1010, unread); the view ray's direction is that target
 * taken infinitely far along the view (a labelled known gap).
 */
export function aimVector({ viewYaw, viewPitch }: InputState): Vec3 {
  const yaw = (viewYaw * Math.PI) / 180;
  const pitch = (viewPitch * Math.PI) / 180;
  const cp = Math.cos(pitch);
  return vec(cp * Math.cos(yaw), cp * Math.sin(yaw), Math.sin(pitch));
}
