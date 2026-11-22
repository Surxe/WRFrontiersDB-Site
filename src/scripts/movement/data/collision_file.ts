/**
 * Reader for a map's collision export, `Maps/<Map>.collision.bin` (format
 * `wrf-collision` version 1, written by the Parser's map cook): what a
 * robot's movement capsule blocks on, in Unreal units and axes (cm, +Z up).
 *
 * Container (GLB-style): a 12-byte header (`WRFC`, version, total length),
 * a JSON chunk (length, type, bytes), a binary chunk (length, type, bytes).
 * Every array is an `{offset, count, type, width}` view into the binary
 * chunk, little-endian. The file documents itself in its JSON `layout`.
 *
 * This module only decodes and selects parts. Building queryable shapes is
 * collision/'s job. Every field the simulator relies on is required: a
 * missing or renamed one fails loudly.
 */

export const COLLISION_FORMAT = 'wrf-collision';
export const COLLISION_VERSION = 1;

/** FLAG bits per collider (`flags` in the file). */
export interface CollisionFlags {
  hidden: number;
  boundary: number;
  ceiling: number;
  destructible: number;
  moving: number;
  double_sided: number;
}

export interface CollisionPart {
  id: string;
  kind: 'base' | 'sublevel' | 'lighting';
  /** Lighting variants only: the variant's pick weight. */
  weight?: number;
}

type ArrayType =
  | 'float32'
  | 'float64'
  | 'uint32'
  | 'int32'
  | 'uint16'
  | 'uint8';

interface View {
  offset: number;
  count: number;
  type: ArrayType;
  width: number;
}

type TypedArray =
  | Float32Array
  | Float64Array
  | Uint32Array
  | Int32Array
  | Uint16Array
  | Uint8Array;

/** One array from the file: `count` rows of `width` values. */
export interface Rows<T extends TypedArray = TypedArray> {
  data: T;
  count: number;
  width: number;
}

/** Collider `meta` row layout: [part, flags, object_type, source]. */
export const META_WIDTH = 4;
export const META_PART = 0;
export const META_FLAGS = 1;
export const META_OBJECT_TYPE = 2;
export const META_SOURCE = 3;

/** A shape library (hulls or meshes): body-space vertices and triangles,
 * and per entry [first vertex, vertex count, first triangle, triangle count]. */
export interface ShapeLibrary {
  vertices: Rows<Float32Array>;
  triangles: Rows<Uint16Array | Uint32Array>;
  ranges: Rows<Uint32Array>;
}

/** Placed library entries: index and transform (t 3, q 4, s 3). */
export interface Instances {
  index: Rows<Uint32Array>;
  transform: Rows<Float32Array>;
  meta: Rows<Uint32Array>;
}

export interface Heightfields {
  /** [rows, cols, first height, first hole cell or -1]. */
  grid: Rows<Int32Array>;
  /** [min_value, height_per_unit]. */
  decode: Rows<Float64Array>;
  /** t 3, q 4, s 3 (s includes the cell size and 1/128). */
  transform: Rows<Float32Array>;
  meta: Rows<Uint32Array>;
  heights: Rows<Uint16Array>;
  holes: Rows<Uint8Array>;
}

export interface CollisionFile {
  map: string;
  flags: CollisionFlags;
  channels: readonly string[];
  parts: readonly CollisionPart[];
  /** Game mode id -> the sublevel part ids it loads. */
  modes: Readonly<Record<string, readonly string[]>>;
  /** Lighting variant part ids. */
  lighting: readonly string[];
  /** Collider debug names (`meta` source index). */
  sources: readonly string[];
  /** centre 3, rotation 4, half extents 3. */
  boxes: { data: Rows<Float32Array>; meta: Rows<Uint32Array> };
  /** centre 3, radius. */
  spheres: { data: Rows<Float32Array>; meta: Rows<Uint32Array> };
  /** centre 3, rotation 4, radius, half length of the cylinder (local Z). */
  capsules: { data: Rows<Float32Array>; meta: Rows<Uint32Array> };
  hulls: ShapeLibrary;
  hullInstances: Instances;
  meshes: ShapeLibrary;
  meshInstances: Instances;
  heightfields: Heightfields;
}

const CONSTRUCTORS = {
  float32: Float32Array,
  float64: Float64Array,
  uint32: Uint32Array,
  int32: Int32Array,
  uint16: Uint16Array,
  uint8: Uint8Array,
} as const;

function fail(message: string): never {
  throw new Error(`collision file: ${message}`);
}

function field<T>(object: unknown, key: string, where: string): T {
  if (typeof object !== 'object' || object === null || !(key in object))
    fail(`missing ${where}.${key}`);
  return (object as Record<string, T>)[key];
}

/** Decode a collision file. */
export function parseCollisionFile(buffer: ArrayBuffer): CollisionFile {
  const bytes = new Uint8Array(buffer);
  const header = new DataView(buffer);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== 'WRFC') fail(`bad magic ${JSON.stringify(magic)}`);
  const version = header.getUint32(4, true);
  if (version !== COLLISION_VERSION)
    fail(`container version ${version}, expected ${COLLISION_VERSION}`);
  if (header.getUint32(8, true) !== buffer.byteLength)
    fail('length in the header does not match the file');
  const jsonLength = header.getUint32(12, true);
  const doc: unknown = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))
  );
  const binHeader = 20 + jsonLength;
  const binLength = header.getUint32(binHeader, true);
  const binStart = binHeader + 8;
  if (binStart + binLength > buffer.byteLength) fail('binary chunk truncated');

  if (field(doc, 'format', 'file') !== COLLISION_FORMAT)
    fail(`format is not ${COLLISION_FORMAT}`);
  if (field(doc, 'version', 'file') !== COLLISION_VERSION)
    fail(`format version is not ${COLLISION_VERSION}`);

  const read = <T extends TypedArray>(owner: unknown, key: string): Rows<T> => {
    const view = field<View>(owner, key, 'array');
    const Ctor = CONSTRUCTORS[view.type];
    if (!Ctor) fail(`unknown array type ${view.type}`);
    const length = view.count * view.width;
    const byteLength = length * Ctor.BYTES_PER_ELEMENT;
    if (view.offset + byteLength > binLength) fail(`array ${key} out of range`);
    // Copy: views into the chunk need not be aligned for their type.
    const copy = buffer.slice(
      binStart + view.offset,
      binStart + view.offset + byteLength
    );
    return {
      data: new Ctor(copy, 0, length) as T,
      count: view.count,
      width: view.width,
    };
  };
  const expectWidth = (rows: Rows, width: number, what: string): void => {
    if (rows.width !== width)
      fail(`${what} has width ${rows.width}, expected ${width}`);
  };
  const colliders = (key: string, width: number) => {
    const group = field<unknown>(doc, key, 'file');
    const data = read<Float32Array>(group, 'data');
    const meta = read<Uint32Array>(group, 'meta');
    expectWidth(data, width, `${key}.data`);
    expectWidth(meta, META_WIDTH, `${key}.meta`);
    if (meta.count !== data.count) fail(`${key}: meta count differs`);
    return { data, meta };
  };
  const library = (key: string): ShapeLibrary => {
    const group = field<unknown>(doc, key, 'file');
    const lib = {
      vertices: read<Float32Array>(group, 'vertices'),
      triangles: read<Uint16Array | Uint32Array>(group, 'triangles'),
      ranges: read<Uint32Array>(group, 'ranges'),
    };
    expectWidth(lib.vertices, 3, `${key}.vertices`);
    expectWidth(lib.triangles, 3, `${key}.triangles`);
    expectWidth(lib.ranges, 4, `${key}.ranges`);
    return lib;
  };
  const instances = (key: string, indexKey: string): Instances => {
    const group = field<unknown>(doc, key, 'file');
    const result = {
      index: read<Uint32Array>(group, indexKey),
      transform: read<Float32Array>(group, 'transform'),
      meta: read<Uint32Array>(group, 'meta'),
    };
    expectWidth(result.transform, 10, `${key}.transform`);
    expectWidth(result.meta, META_WIDTH, `${key}.meta`);
    return result;
  };
  const hf = field<unknown>(doc, 'heightfields', 'file');
  const heightfields: Heightfields = {
    grid: read(hf, 'grid'),
    decode: read(hf, 'decode'),
    transform: read(hf, 'transform'),
    meta: read(hf, 'meta'),
    heights: read(hf, 'heights'),
    holes: read(hf, 'holes'),
  };
  expectWidth(heightfields.grid, 4, 'heightfields.grid');
  expectWidth(heightfields.decode, 2, 'heightfields.decode');
  expectWidth(heightfields.transform, 10, 'heightfields.transform');

  const flags = field<CollisionFlags>(doc, 'flags', 'file');
  for (const name of [
    'hidden',
    'boundary',
    'ceiling',
    'destructible',
    'moving',
    'double_sided',
  ] as const)
    field<number>(flags, name, 'flags');

  return {
    map: field(doc, 'map', 'file'),
    flags,
    channels: field(doc, 'channels', 'file'),
    parts: field(doc, 'parts', 'file'),
    modes: field(doc, 'modes', 'file'),
    lighting: field(doc, 'lighting', 'file'),
    sources: field(doc, 'sources', 'file'),
    boxes: colliders('boxes', 10),
    spheres: colliders('spheres', 4),
    capsules: colliders('capsules', 9),
    hulls: library('hulls'),
    hullInstances: instances('hull_instances', 'hull'),
    meshes: library('meshes'),
    meshInstances: instances('mesh_instances', 'mesh'),
    heightfields,
  };
}

export interface PartChoice {
  /** Game mode id (a key of `modes`); null loads no mode sublevels. */
  mode: string | null;
  /** Lighting variant part id; null picks the heaviest weight (the first
   * on a tie, in file order). */
  lighting: string | null;
}

export interface PartSelection {
  /** Part indices to load. */
  parts: ReadonlySet<number>;
  /** The lighting variant chosen, or null when the map has none. */
  lighting: string | null;
  mode: string | null;
}

/** The parts a match loads: `base`, the mode's sublevels and one lighting
 * variant (the game picks it per match; the client gets it as a launch
 * option, findings/map-dynamics.md). */
export function selectParts(
  file: CollisionFile,
  choice: PartChoice
): PartSelection {
  const index = new Map(file.parts.map((p, i) => [p.id, i]));
  const parts = new Set<number>();
  const base = file.parts.findIndex((p) => p.kind === 'base');
  if (base < 0) fail('no base part');
  parts.add(base);
  if (choice.mode !== null) {
    const sublevels = file.modes[choice.mode];
    if (!sublevels)
      fail(
        `map ${file.map} has no mode ${choice.mode} (has ${Object.keys(file.modes).join(', ')})`
      );
    for (const id of sublevels) {
      const i = index.get(id);
      if (i === undefined) fail(`mode ${choice.mode} part ${id} not in parts`);
      parts.add(i);
    }
  }
  let lighting: string | null = null;
  const variants = file.parts.filter((p) => p.kind === 'lighting');
  if (choice.lighting !== null) {
    const i = index.get(choice.lighting);
    if (i === undefined || file.parts[i].kind !== 'lighting')
      fail(
        `map ${file.map} has no lighting variant ${choice.lighting} (has ${variants.map((v) => v.id).join(', ') || 'none'})`
      );
    lighting = choice.lighting;
    parts.add(i);
  } else if (variants.length > 0) {
    let best = variants[0];
    for (const v of variants) {
      if (typeof v.weight !== 'number') fail(`lighting ${v.id} has no weight`);
      if ((v.weight ?? 0) > (best.weight ?? 0)) best = v;
    }
    lighting = best.id;
    parts.add(index.get(best.id)!);
  }
  return { parts, lighting, mode: choice.mode };
}
