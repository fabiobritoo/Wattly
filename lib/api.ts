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
