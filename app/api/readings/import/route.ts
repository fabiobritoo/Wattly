import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { period_id, replace, readings } = body ?? {};

    if (!period_id) {
      return errorResponse(new Error("period_id é obrigatório."), 400);
    }
    if (!Array.isArray(readings) || readings.length === 0) {
      return errorResponse(new Error("Nenhuma leitura para importar."), 400);
    }
    for (const r of readings) {
      if (!r || !r.reading_at || typeof r.kwh_reading !== "number" || Number.isNaN(r.kwh_reading)) {
        return errorResponse(
          new Error("Cada leitura precisa de reading_at (ISO) e kwh_reading (número)."),
          400
        );
      }
    }

    const sql = getSql();

    if (replace) {
      await sql`DELETE FROM readings WHERE period_id = ${period_id}`;
    }

    // The neon HTTP driver doesn't expose a clean multi-row insert helper,
    // and import batches here are small (a person's manual log, not bulk
    // sensor data), so a sequential loop is simple and fast enough.
    let inserted = 0;
    for (const r of readings) {
      await sql`
        INSERT INTO readings (period_id, reading_at, kwh_reading)
        VALUES (${period_id}, ${r.reading_at}, ${r.kwh_reading})
      `;
      inserted++;
    }

    return jsonNoStore({ inserted, replaced: Boolean(replace) });
  } catch (err) {
    return errorResponse(err);
  }
}
