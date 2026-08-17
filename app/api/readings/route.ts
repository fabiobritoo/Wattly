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
      SELECT id, period_id, date::text AS date, kwh_reading
      FROM readings
      WHERE period_id = ${periodId}
      ORDER BY date ASC
    `;
    return jsonNoStore({ readings: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { period_id, date, kwh_reading } = body ?? {};

    if (!period_id || !date || kwh_reading === undefined || kwh_reading === null || kwh_reading === "") {
      return errorResponse(
        new Error("Campos obrigatórios: period_id, date, kwh_reading."),
        400
      );
    }

    const sql = getSql();
    // Upsert: one reading per (period_id, date). Editing a day just
    // overwrites that day's value instead of creating duplicates.
    const rows = await sql`
      INSERT INTO readings (period_id, date, kwh_reading)
      VALUES (${period_id}, ${date}, ${kwh_reading})
      ON CONFLICT (period_id, date)
      DO UPDATE SET kwh_reading = EXCLUDED.kwh_reading
      RETURNING id, period_id, date::text AS date, kwh_reading
    `;
    return jsonNoStore({ reading: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}
