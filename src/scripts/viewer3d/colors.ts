/**
 * Color helpers shared by the 3D viewers (data colors are raw 0xRRGGBB values,
 * drawn in the scene and repeated in swatches).
 */

/** `0xrrggbb` -> `#rrggbb`. */
export function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
