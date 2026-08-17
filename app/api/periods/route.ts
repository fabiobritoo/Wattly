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
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh, created_at,
             tariff_rate, tariff_flag, flag_surcharge_rate
      FROM periods
      ORDER BY created_at DESC
    `;

    if (periods.length === 0) {
      return jsonNoStore({ periods: [] });
    }

    // Current = most recently created period; every other row is history.
    const currentId = periods[0].id;

    const enriched = await Promise.all(
      periods.map(async (p: any) => {
        const readings = await sql`
          SELECT id, period_id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
          FROM readings
          WHERE period_id = ${p.id}
          ORDER BY reading_at ASC
        `;
        const summary = computeSummary(
          {
            id: p.id,
            start_date: p.start_date,
            end_date: p.end_date,
            initial_kwh: Number(p.initial_kwh),
            goal_kwh: p.goal_kwh === null ? null : Number(p.goal_kwh),
            tariff_rate: p.tariff_rate === null ? null : Number(p.tariff_rate),
            tariff_flag: p.tariff_flag ?? null,
            flag_surcharge_rate: p.flag_surcharge_rate === null ? null : Number(p.flag_surcharge_rate),
          },
          readings.map((r: any) => ({
            id: r.id,
            period_id: r.period_id,
            reading_at: r.reading_at,
            kwh_reading: Number(r.kwh_reading),
          }))
        );

        return {
          id: p.id,
          start_date: p.start_date,
          end_date: p.end_date,
          initial_kwh: Number(p.initial_kwh),
          goal_kwh: p.goal_kwh === null ? null : Number(p.goal_kwh),
          tariff_rate: p.tariff_rate === null ? null : Number(p.tariff_rate),
          isCurrent: p.id === currentId,
          summary,
        };
      })
    );

    return jsonNoStore({ periods: enriched });
  } catch (err) {
    return errorResponse(err);
  }
}
