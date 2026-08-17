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
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
             tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      FROM periods
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const period = periods[0] ?? null;

    if (!period) {
      return jsonNoStore({ period: null, readings: [], lastNote: null, summary: null });
    }

    const readings = await sql`
      SELECT id, period_id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
      FROM readings
      WHERE period_id = ${period.id}
      ORDER BY reading_at ASC
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
        tariff_rate: period.tariff_rate === null ? null : Number(period.tariff_rate),
        tariff_flag: period.tariff_flag ?? null,
        flag_surcharge_rate: period.flag_surcharge_rate === null ? null : Number(period.flag_surcharge_rate),
        fixed_fees_reais: period.fixed_fees_reais === null ? null : Number(period.fixed_fees_reais),
      },
      readings.map((r: any) => ({
        id: r.id,
        period_id: r.period_id,
        reading_at: r.reading_at,
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
