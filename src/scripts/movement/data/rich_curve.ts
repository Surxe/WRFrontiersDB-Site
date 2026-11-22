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
      time: key.Time,
      value: key.Value,
      interpMode: key.InterpMode as InterpMode,
      arriveTangent: key.ArriveTangent ?? 0,
      leaveTangent: key.LeaveTangent ?? 0,
    };
  });
  const defaultValue =
    typeof data.DefaultValue === 'number' && data.DefaultValue < MAX_FLT
      ? data.DefaultValue
      : null;
  return {
    keys,
    preInfinity: parseExtrapolation(data.PreInfinityExtrap, where),
    postInfinity: parseExtrapolation(data.PostInfinityExtrap, where),
    defaultValue,
  };
}

/** UE::Curves::BezierInterp. */
function bezierInterp(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  alpha: number
): number {
  const p01 = p0 + (p1 - p0) * alpha;
  const p12 = p1 + (p2 - p1) * alpha;
  const p23 = p2 + (p3 - p2) * alpha;
  const p012 = p01 + (p12 - p01) * alpha;
  const p123 = p12 + (p23 - p12) * alpha;
  return p012 + (p123 - p012) * alpha;
}

/** UE::Curves::EvalForTwoKeys (unweighted). */
function evalForTwoKeys(key1: CurveKey, key2: CurveKey, time: number): number {
  const diff = key2.time - key1.time;
  if (!(diff > 0)) return key1.value;
  if (key1.interpMode === 'RCIM_Constant') {
    return time < key2.time ? key1.value : key2.value;
  }
  const alpha = (time - key1.time) / diff;
  const p0 = key1.value;
  const p3 = key2.value;
  if (key1.interpMode === 'RCIM_Linear') return p0 + (p3 - p0) * alpha;
  const p1 = p0 + (key1.leaveTangent * diff) / 3;
  const p2 = p3 - (key2.arriveTangent * diff) / 3;
  return bezierInterp(p0, p1, p2, p3, alpha);
}

const isNearlyZero = (value: number): boolean => Math.abs(value) <= 1e-8;

/** FRichCurve::Eval. */
export function evalCurve(
  curve: RichCurve,
  time: number,
  defaultValue = 0
): number {
  const { keys } = curve;
  const n = keys.length;
  if (n === 0) return curve.defaultValue ?? defaultValue;
  if (n < 2 || time < keys[0].time) {
    if (curve.preInfinity === 'linear' && n > 1) {
      const dt = keys[1].time - keys[0].time;
      if (isNearlyZero(dt)) return keys[0].value;
      const slope = (keys[1].value - keys[0].value) / dt;
      return slope * (time - keys[0].time) + keys[0].value;
    }
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
  if (curve.postInfinity === 'linear') {
    const dt = keys[n - 2].time - keys[n - 1].time;
    if (isNearlyZero(dt)) return keys[n - 1].value;
    const slope = (keys[n - 2].value - keys[n - 1].value) / dt;
    return slope * (time - keys[n - 1].time) + keys[n - 1].value;
  }
  return keys[n - 1].value;
}
