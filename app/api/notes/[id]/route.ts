import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await migrate();
    const body = await req.json();
    const { date, text } = body ?? {};

    if (!date || !text || !String(text).trim()) {
      return errorResponse(new Error("Campos obrigatórios: date, text."), 400);
    }

    const sql = getSql();
    const rows = await sql`
      UPDATE notes
      SET date = ${date}, text = ${String(text).trim()}
      WHERE id = ${params.id}
      RETURNING id, period_id, date::text AS date, text, created_at
    `;
    if (rows.length === 0) {
      return errorResponse(new Error("Anotação não encontrada."), 404);
    }
    return jsonNoStore({ note: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await migrate();
    const sql = getSql();
    const rows = await sql`DELETE FROM notes WHERE id = ${params.id} RETURNING id`;
    if (rows.length === 0) {
      return errorResponse(new Error("Anotação não encontrada."), 404);
    }
    return jsonNoStore({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
