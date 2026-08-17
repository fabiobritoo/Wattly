import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { "Cache-Control": "no-store" } }
  );
}
