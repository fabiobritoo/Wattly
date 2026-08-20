import { NextResponse } from "next/server";

export function jsonNoStore(data: unknown, init?: number) {
  return NextResponse.json(data, {
    status: init ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * A reading that breaks the "meter only increases" assumption isn't
 * rejected outright — it's very likely a typo, but a real meter swap or
 * correction can legitimately produce one. Returns 409 with enough context
 * for the client to show a confirmation prompt; the client resubmits with
 * `force: true` to save anyway.
 */
export function decreasingReadingConflict(params: {
  kwh_reading: number;
  previous: { reading_at: string; kwh_reading: number } | null;
  next: { reading_at: string; kwh_reading: number } | null;
}) {
  return NextResponse.json(
    { warning: "decreasing_reading", ...params },
    { status: 409, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * The Postgres driver returns NUMERIC/DECIMAL columns as strings (to avoid
 * silent float precision loss), not as JS numbers. Every API response that
 * includes one of these columns MUST convert it with this helper before
 * sending JSON — otherwise frontend code that does `a + b` arithmetic on
 * these fields silently does string concatenation instead of addition
 * (e.g. "4010" + 54 === "401054", not 4064). Division/multiplication don't
 * have this problem (JS auto-coerces for those operators), but `+` does.
 */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Converts every field in `keys` on `obj` via toNum(), returning a new object. */
export function normalizeNumericFields<T extends Record<string, any>>(
  obj: T,
  keys: readonly (keyof T)[]
): T {
  const out = { ...obj };
  for (const key of keys) {
    out[key] = toNum(obj[key]) as any;
  }
  return out;
}
