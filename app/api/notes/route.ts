import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await migrate();
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("period_id");
    if (!periodId) {
      return errorResponse(new Error("period_id é obrigatório."), 400);
    }
    const sql = getSql();
    const rows = await sql`
      SELECT id, period_id, date::text AS date, text, created_at
      FROM notes
      WHERE period_id = ${periodId}
      ORDER BY date DESC, created_at DESC
    `;
    return jsonNoStore({ notes: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { period_id, date, text } = body ?? {};

    if (!period_id || !date || !text || !String(text).trim()) {
      return errorResponse(new Error("Campos obrigatórios: period_id, date, text."), 400);
    }

    const sql = getSql();
    const rows = await sql`
      INSERT INTO notes (period_id, date, text)
      VALUES (${period_id}, ${date}, ${String(text).trim()})
      RETURNING id, period_id, date::text AS date, text, created_at
    `;
    return jsonNoStore({ note: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}
