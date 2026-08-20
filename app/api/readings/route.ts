import { getSql, migrate, getNeighborReadings } from "@/lib/db";
import { jsonNoStore, errorResponse, normalizeNumericFields, decreasingReadingConflict } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const READING_NUMERIC_FIELDS = ["kwh_reading"] as const;

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
      SELECT id, period_id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
      FROM readings
      WHERE period_id = ${periodId}
      ORDER BY reading_at ASC
    `;
    return jsonNoStore({ readings: rows.map((r: any) => normalizeNumericFields(r, READING_NUMERIC_FIELDS)) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { period_id, reading_at, kwh_reading, force } = body ?? {};

    if (!period_id || !reading_at || kwh_reading === undefined || kwh_reading === null || kwh_reading === "") {
      return errorResponse(
        new Error("Campos obrigatórios: period_id, reading_at, kwh_reading."),
        400
      );
    }

    const kwhNum = Number(kwh_reading);

    if (!force) {
      const { previous, next } = await getNeighborReadings(period_id, reading_at);
      const decreasesFromPrevious = previous != null && kwhNum < previous.kwh_reading;
      const increasesAboveNext = next != null && kwhNum > next.kwh_reading;
      if (decreasesFromPrevious || increasesAboveNext) {
        return decreasingReadingConflict({ kwh_reading: kwhNum, previous, next });
      }
    }

    const sql = getSql();
    // Several readings per day are allowed now, so this is a plain insert —
    // no more upsert-by-day. Each reading is its own point in time.
    const rows = await sql`
      INSERT INTO readings (period_id, reading_at, kwh_reading)
      VALUES (${period_id}, ${reading_at}, ${kwhNum})
      RETURNING id, period_id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
    `;
    return jsonNoStore({ reading: normalizeNumericFields(rows[0], READING_NUMERIC_FIELDS) });
  } catch (err) {
    return errorResponse(err);
  }
}
