/**
 * Correctly rounded sin and cos (MVP session 4.5, D27).
 *
 * UE's Linux editor builds FRotator::Quaternion's VectorSinCos (no SVML on
 * clang, UnrealMathSSE.h) from per-lane FMath::Sin / FMath::Cos, that is
 * glibc's sin and cos, which are correctly rounded. V8's Math.sin and
 * Math.cos (an fdlibm port) are within an ulp but not always correctly
 * rounded: on the session 4.5 oracle's 16,254 capsule rotations, 315
 * quaternions came out one ulp off. These evaluate in double-double
 * (about 106 bits: Cody-Waite reduction by pi/2 in three parts, Taylor
 * series) and round once, which gives glibc's bits.
 *
 * Accuracy is for the angles the movement code passes (|x| up to a few
 * pi); larger arguments would need a wider reduction.
 */

type DD = [number, number];

const SPLITTER = 134217729; // 2^27 + 1

function twoSum(a: number, b: number): DD {
  const s = a + b;
  const bb = s - a;
  return [s, a - (s - bb) + (b - bb)];
}

function quickTwoSum(a: number, b: number): DD {
  const s = a + b;
  return [s, b - (s - a)];
}

function split(a: number): DD {
  const c = SPLITTER * a;
  const hi = c - (c - a);
  return [hi, a - hi];
}

function twoProd(a: number, b: number): DD {
  const p = a * b;
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return [p, ah * bh - p + ah * bl + al * bh + al * bl];
}

function add(a: DD, b: DD): DD {
  const [s, e] = twoSum(a[0], b[0]);
  const [t, f] = twoSum(a[1], b[1]);
  let [hi, lo] = quickTwoSum(s, e + t);
  [hi, lo] = quickTwoSum(hi, lo + f);
  return [hi, lo];
}

function mul(a: DD, b: DD): DD {
  const [p, e] = twoProd(a[0], b[0]);
  return quickTwoSum(p, e + (a[0] * b[1] + a[1] * b[0]));
}

function divD(a: DD, b: number): DD {
  const q1 = a[0] / b;
  const [p, pe] = twoProd(q1, b);
  const r = (a[0] - p - pe + a[1]) / b;
  return quickTwoSum(q1, r);
}

// pi / 2 in three parts (fdlibm's PIO2_1, PIO2_1T split further).
const PIO2_1 = 1.5707963267948966;
const PIO2_2 = 6.123233995736766e-17;
const PIO2_3 = -1.4973849048591698e-33;

/** x - k pi / 2 in double-double. */
function reduce(x: number, k: number): DD {
  let r: DD = [x, 0];
  r = add(r, twoProd(-k, PIO2_1));
  r = add(r, twoProd(-k, PIO2_2));
  r = add(r, twoProd(-k, PIO2_3));
  return r;
}

/** sin(r) and cos(r) for |r| <= pi / 4, double-double. */
function series(r: DD): [DD, DD] {
  const r2 = mul(r, r);
  let s: DD = r;
  let term: DD = r;
  for (let n = 2; n < 40; n += 2) {
    term = divD(mul(term, r2), -(n * (n + 1)));
    s = add(s, term);
    if (Math.abs(term[0]) < 1e-40) break;
  }
  let c: DD = [1, 0];
  term = [1, 0];
  for (let n = 1; n < 40; n += 2) {
    term = divD(mul(term, r2), -(n * (n + 1)));
    c = add(c, term);
    if (Math.abs(term[0]) < 1e-40) break;
  }
  return [s, c];
}

/** sin(x) and cos(x), each correctly rounded to double. */
export function sinCos(x: number): [number, number] {
  if (x === 0) return [x, 1];
  if (!Number.isFinite(x)) return [NaN, NaN];
  const k = Math.round(x / PIO2_1);
  const [s, c] = series(reduce(x, k));
  const q = ((k % 4) + 4) % 4;
  const sv = s[0] + s[1];
  const cv = c[0] + c[1];
  switch (q) {
    case 0:
      return [sv, cv];
    case 1:
      return [cv, -sv];
    case 2:
      return [-sv, -cv];
    default:
      return [-cv, sv];
  }
}
