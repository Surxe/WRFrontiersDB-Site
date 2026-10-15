/**
 * A viewer's camera mode: free 3D, or a flat 2D view (ortho.ts). The buttons
 * are components/viewer/CameraModeToggle.astro (`data-camera`).
 */
export type CameraMode = '3d' | '2d';

export const isCameraMode = (value: unknown): value is CameraMode =>
  value === '3d' || value === '2d';
