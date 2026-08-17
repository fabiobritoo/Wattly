import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";
import { computeSummary } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    await migrate();
    const sql = getSql();

    const periods = await sql`
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh
      FROM periods
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const period = periods[0] ?? null;

    if (!period) {
      return jsonNoStore({ period: null, readings: [], lastNote: null, summary: null });
    }

    const readings = await sql`
      SELECT id, period_id, date::text AS date, kwh_reading
      FROM readings
      WHERE period_id = ${period.id}
      ORDER BY date ASC
    `;

    const notes = await sql`
      SELECT id, period_id, date::text AS date, text, created_at
      FROM notes
      WHERE period_id = ${period.id}
      ORDER BY date DESC, created_at DESC
      LIMIT 1
    `;

    const summary = computeSummary(
      {
        id: period.id,
        start_date: period.start_date,
        end_date: period.end_date,
        initial_kwh: Number(period.initial_kwh),
        goal_kwh: period.goal_kwh === null ? null : Number(period.goal_kwh),
      },
      readings.map((r: any) => ({
        id: r.id,
        period_id: r.period_id,
        date: r.date,
        kwh_reading: Number(r.kwh_reading),
      }))
    );

    return jsonNoStore({
      period,
      readings,
      lastNote: notes[0] ?? null,
      summary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
