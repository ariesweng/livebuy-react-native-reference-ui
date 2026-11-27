// Safe number → integer conversion for reference-ui price / discount display
// (rb-rn-price-int-conversion-guard, parity iOS `ReferenceUINumberFormat.safeInt(_:)` from
// rb-ios-price-int-conversion-guard / Flutter `referenceUiSafeInt` from
// rb-flutter-price-int-conversion-guard).
//
// Why: RN `LBProduct.price` / `originalPrice` are STRINGS produced by the native bridge from
// the core's unbounded `Double` (iOS bridge `String(product.price)` → `"1990.0"`, `"1e+20"`,
// `"inf"`, `"nan"`; Android bridge `product.price.toString()` → `"1990.0"`, `"1.0E20"`,
// `"Infinity"`, `"NaN"`). iOS / Flutter show these as a 64-bit integer (truncated toward zero)
// and show nothing when the value is not representable as one; these helpers give RN the same
// result.
//
// Pure (no react / react-native import) so it is unit-testable. Not exported from the package.

/** 2^63 — the first value above the int64 range. `-2^63` itself is the smallest int64 and is
 *  exactly representable as a JS number. */
const TWO_POW_63 = 9223372036854775808;
/** 2^32, used to split a large integer into two exactly-representable halves. */
const TWO_POW_32 = 4294967296;
/** Limb base for the exact decimal printer below. */
const LIMB_BASE = 1000000;

/** A plain decimal literal as both native bridges print a finite `Double` (`1990.0`, `1e+20`,
 *  `1.0E20`, `-0.0`, …). Anything else — `inf` / `nan` (Swift), `Infinity` / `NaN` (Kotlin),
 *  blank, hex, garbage — is not a number for display purposes. */
const DECIMAL_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Parses a bridge numeric string. Returns `NaN` unless the trimmed string is a plain decimal
 * literal (so `''`, `'inf'`, `'nan'`, `'Infinity'`, `'abc'` → `NaN`; note `Number('')` would
 * be `0`). A literal too large for a double (e.g. `'1e400'`) parses to `±Infinity`.
 */
export function referenceUiParseDecimal(raw: string): number {
  const s = raw.trim();
  return DECIMAL_LITERAL.test(s) ? Number(s) : NaN;
}

/**
 * Truncates `value` toward zero. Returns `null` when `value` is NaN / ±Infinity, or when the
 * truncated value is outside the signed 64-bit range (`-2^63 <= t < 2^63`) — no clamping, same
 * as iOS `Int(exactly: value.rounded(.towardZero))`. `-0` is returned as `0`.
 */
export function referenceUiSafeInt(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const t = Math.trunc(value);
  if (t < -TWO_POW_63 || t >= TWO_POW_63) return null;
  return t === 0 ? 0 : t;
}

/**
 * Exact base-10 digits of an integer-valued `value` from `referenceUiSafeInt` — the same text
 * as iOS `String(Int)`. JS `String(n)` prints the SHORTEST round-trip form, which for integers
 * at or above 2^53 is not the exact value (`String(2 ** 62)` is `"4611686018427388000"`, the
 * exact value is `4611686018427387904`), so those go through a small limb printer instead of
 * `BigInt` (the package targets ES2017).
 */
export function referenceUiIntString(value: number): string {
  if (Number.isSafeInteger(value)) return String(value);
  const digits = exactDigitsOfLargeInteger(Math.abs(value));
  return value < 0 ? `-${digits}` : digits;
}

/** Splits `abs` (integer, 2^53 <= abs <= 2^63) as `hi * 2^32 + lo` — both exact — and sums
 *  `hi * 4294967296 + lo` in base-10^6 limbs (every intermediate stays below 2^53). */
function exactDigitsOfLargeInteger(abs: number): string {
  const hi = Math.floor(abs / TWO_POW_32);
  const lo = abs - hi * TWO_POW_32;
  // 4294967296 = 4294 * 10^6 + 967296.
  const loLow = lo % LIMB_BASE;
  const limbs = [loLow + hi * 967296, (lo - loLow) / LIMB_BASE + hi * 4294, 0, 0];
  for (let i = 0; i < limbs.length - 1; i += 1) {
    const x = limbs[i]!;
    const r = x % LIMB_BASE;
    limbs[i + 1] = limbs[i + 1]! + (x - r) / LIMB_BASE;
    limbs[i] = r;
  }
  let top = limbs.length - 1;
  while (top > 0 && limbs[top] === 0) top -= 1;
  let out = String(limbs[top]);
  for (let i = top - 1; i >= 0; i -= 1) out += String(limbs[i]).padStart(6, '0');
  return out;
}
