import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse, normalizeNumericFields } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const READING_NUMERIC_FIELDS = ["kwh_reading"] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await migrate();
    const body = await req.json();
    const { reading_at, kwh_reading } = body ?? {};

    if (!reading_at || kwh_reading === undefined || kwh_reading === null || kwh_reading === "") {
      return errorResponse(new Error("Campos obrigatórios: reading_at, kwh_reading."), 400);
    }

    const sql = getSql();
    const rows = await sql`
      UPDATE readings
      SET reading_at = ${reading_at}, kwh_reading = ${kwh_reading}
      WHERE id = ${params.id}
      RETURNING id, period_id,
                to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at,
                kwh_reading
    `;
    if (rows.length === 0) {
      return errorResponse(new Error("Leitura não encontrada."), 404);
    }
    return jsonNoStore({ reading: normalizeNumericFields(rows[0], READING_NUMERIC_FIELDS) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await migrate();
    const sql = getSql();
    const rows = await sql`DELETE FROM readings WHERE id = ${params.id} RETURNING id`;
    if (rows.length === 0) {
      return errorResponse(new Error("Leitura não encontrada."), 404);
    }
    return jsonNoStore({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
