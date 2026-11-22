/**
 * UE's FRichCurve as the exported data carries it (`EditorCurveData`), and
 * its evaluation, ported from UE 5.4.4:
 * - FRichCurve::Eval (Engine/Private/Curves/RichCurve.cpp)
 * - UE::Curves::EvalForTwoKeys, BezierInterp
 *   (Engine/Private/Curves/CurveEvaluation.cpp, Public/Curves/CurveEvaluation.h)
 *
 * Only what the data uses or can cheaply be ported is supported: linear,
 * constant and unweighted cubic keys; constant and linear extrapolation.
 * Anything else fails loudly when the curve is parsed, so a patch that
 * starts using it is noticed instead of silently mis-evaluated.
 */

export type InterpMode = 'RCIM_Linear' | 'RCIM_Constant' | 'RCIM_Cubic';
export type Extrapolation = 'constant' | 'linear';

export interface CurveKey {
  time: number;
  value: number;
  interpMode: InterpMode;
  arriveTangent: number;
  leaveTangent: number;
}

export interface RichCurve {
  keys: readonly CurveKey[];
  preInfinity: Extrapolation;
  postInfinity: Extrapolation;
  /** FRichCurve::DefaultValue; null when unset (MAX_flt in the data). */
  defaultValue: number | null;
}

/** The raw JSON shape: `{ EditorCurveData: { Keys: [...], ... } }`. */
interface RawKey {
  InterpMode: string;
  TangentWeightMode?: string;
  Time: number;
  Value: number;
  ArriveTangent?: number;
  LeaveTangent?: number;
}

const MAX_FLT = 3.4028234e38;
const INTERP_MODES: readonly string[] = [
  'RCIM_Linear',
  'RCIM_Constant',
  'RCIM_Cubic',
];
const UNWEIGHTED = new Set([undefined, 'RCTWM_WeightedNone']);

function parseExtrapolation(raw: unknown, where: string): Extrapolation {
  // Missing means UE's default, RCCE_Constant.
  if (raw === undefined || raw === null) return 'constant';
  const name = String(raw).replace(/^ERichCurveExtrapolation::/, '');
  if (name === 'RCCE_Constant' || name === 'RCCE_None') return 'constant';
  if (name === 'RCCE_Linear') return 'linear';
  throw new Error(`${where}: unsupported curve extrapolation ${name}`);
}

/** Parse an exported FRichCurve; `where` names it in errors. */
export function parseRichCurve(raw: unknown, where: string): RichCurve {
  const data = (raw as { EditorCurveData?: Record<string, unknown> } | null)
    ?.EditorCurveData;
  if (!data || typeof data !== 'object') {
    throw new Error(`${where}: not a curve (no EditorCurveData)`);
  }
  // A curve with no keys is cooked as `EditorCurveData: {}`.
  const rawKeys = data.Keys ?? [];
  if (!Array.isArray(rawKeys))
    throw new Error(`${where}: EditorCurveData.Keys is not a list`);
  const keys = (rawKeys as RawKey[]).map((key, index): CurveKey => {
    if (!INTERP_MODES.includes(key.InterpMode)) {
      throw new Error(`${where} key ${index}: unsupported ${key.InterpMode}`);
    }
    if (
      key.InterpMode === 'RCIM_Cubic' &&
      !UNWEIGHTED.has(key.TangentWeightMode)
    ) {
      throw new Error(`${where} key ${index}: weighted tangents unsupported`);
    }
    if (typeof key.Time !== 'number' || typeof key.Value !== 'number') {
      throw new Error(`${where} key ${index}: missing Time or Value`);
    }
    return {
      // FRichCurveKey's fields are float.
      time: Math.fround(key.Time),
      value: Math.fround(key.Value),
      interpMode: key.InterpMode as InterpMode,
      arriveTangent: Math.fround(key.ArriveTangent ?? 0),
      leaveTangent: Math.fround(key.LeaveTangent ?? 0),
    };
  });
  const defaultValue =
    typeof data.DefaultValue === 'number' && data.DefaultValue < MAX_FLT
      ? Math.fround(data.DefaultValue)
      : null;
  return {
    keys,
    preInfinity: parseExtrapolation(data.PreInfinityExtrap, where),
    postInfinity: parseExtrapolation(data.PostInfinityExtrap, where),
    defaultValue,
  };
}

const f32 = Math.fround;

/** FMath::Lerp on floats: `A + Alpha * (B - A)`, each step rounded. */
const lerp32 = (a: number, b: number, alpha: number): number =>
  f32(a + f32(alpha * f32(b - a)));

/** UE::Curves::BezierInterp (float). */
function bezierInterp(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  alpha: number
): number {
  const p01 = lerp32(p0, p1, alpha);
  const p12 = lerp32(p1, p2, alpha);
  const p23 = lerp32(p2, p3, alpha);
  const p012 = lerp32(p01, p12, alpha);
  const p123 = lerp32(p12, p23, alpha);
  return lerp32(p012, p123, alpha);
}

/** UE::Curves::EvalForTwoKeys (unweighted), in float as UE runs it. */
function evalForTwoKeys(key1: CurveKey, key2: CurveKey, time: number): number {
  const diff = f32(key2.time - key1.time);
  if (!(diff > 0)) return key1.value;
  if (key1.interpMode === 'RCIM_Constant') {
    return time < key2.time ? key1.value : key2.value;
  }
  const alpha = f32(f32(time - key1.time) / diff);
  const p0 = key1.value;
  const p3 = key2.value;
  if (key1.interpMode === 'RCIM_Linear') return lerp32(p0, p3, alpha);
  const oneThird = f32(1 / 3);
  const p1 = f32(p0 + f32(f32(key1.leaveTangent * diff) * oneThird));
  const p2 = f32(p3 - f32(f32(key2.arriveTangent * diff) * oneThird));
  return bezierInterp(p0, p1, p2, p3, alpha);
}

/** FMath::IsNearlyZero(float), UE_SMALL_NUMBER. */
const isNearlyZero = (value: number): boolean => Math.abs(value) <= 1e-8;

/** Linear extrapolation from key `a` with the slope from `b` to `a`. */
function extrapolate(a: CurveKey, b: CurveKey, time: number): number {
  const dt = f32(b.time - a.time);
  if (isNearlyZero(dt)) return a.value;
  const slope = f32(f32(b.value - a.value) / dt);
  return f32(f32(slope * f32(time - a.time)) + a.value);
}

/**
 * FRichCurve::Eval. UE evaluates in float32 (`float InTime`, float keys
 * and locals; 09-editor.md 2.5): the time is rounded to float on the way
 * in and every step after it, so the result is UE's bit for bit.
 */
export function evalCurve(
  curve: RichCurve,
  timeIn: number,
  defaultValue = 0
): number {
  const time = f32(timeIn);
  const { keys } = curve;
  const n = keys.length;
  if (n === 0) return f32(curve.defaultValue ?? defaultValue);
  if (n < 2 || time < keys[0].time) {
    if (curve.preInfinity === 'linear' && n > 1)
      return extrapolate(keys[0], keys[1], time);
    return keys[0].value;
  }
  if (time <= keys[n - 1].time) {
    // Lower bound for the second of the two keys around `time`.
    let first = 1;
    let count = n - 1 - first;
    while (count > 0) {
      const step = Math.floor(count / 2);
      const middle = first + step;
      if (time >= keys[middle].time) {
        first = middle + 1;
        count -= step + 1;
      } else {
        count = step;
      }
    }
    return evalForTwoKeys(keys[first - 1], keys[first], time);
  }
  if (curve.postInfinity === 'linear')
    return extrapolate(keys[n - 1], keys[n - 2], time);
  return keys[n - 1].value;
}
