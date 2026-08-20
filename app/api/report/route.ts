import { NextResponse } from "next/server";
import { getSql, migrate } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { type Period as CalcPeriod, type Reading as CalcReading } from "@/lib/calc";
import { type TariffFlag } from "@/lib/tariffFlags";
import { buildReportPdf, type ReportNote } from "@/lib/report";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await migrate();
    const { searchParams } = new URL(req.url);
    const periodIdParam = searchParams.get("period_id");
    const sql = getSql();

    const periodRows = periodIdParam
      ? await sql`
          SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                 tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
          FROM periods WHERE id = ${periodIdParam}
        `
      : await sql`
          SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                 tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
          FROM periods ORDER BY created_at DESC LIMIT 1
        `;

    if (periodRows.length === 0) {
      return errorResponse(new Error("Nenhum período encontrado."), 404);
    }
    const p = periodRows[0];
    const period: CalcPeriod = {
      id: p.id,
      start_date: p.start_date,
      end_date: p.end_date,
      initial_kwh: Number(p.initial_kwh),
      goal_kwh: p.goal_kwh === null ? null : Number(p.goal_kwh),
      tariff_rate: p.tariff_rate === null ? null : Number(p.tariff_rate),
      tariff_flag: (p.tariff_flag as TariffFlag | null) ?? null,
      flag_surcharge_rate: p.flag_surcharge_rate === null ? null : Number(p.flag_surcharge_rate),
      fixed_fees_reais: p.fixed_fees_reais === null ? null : Number(p.fixed_fees_reais),
    };

    const readingRows = await sql`
      SELECT id, period_id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
      FROM readings
      WHERE period_id = ${period.id}
      ORDER BY reading_at ASC
    `;
    const readings: CalcReading[] = readingRows.map((r: any) => ({
      id: r.id,
      period_id: r.period_id,
      reading_at: r.reading_at,
      kwh_reading: Number(r.kwh_reading),
    }));

    const noteRows = await sql`
      SELECT date::text AS date, text
      FROM notes
      WHERE period_id = ${period.id}
      ORDER BY date ASC, created_at ASC
    `;
    const notes: ReportNote[] = noteRows.map((n: any) => ({ date: n.date, text: n.text }));

    const pdfBytes = await buildReportPdf(period, readings, notes);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // "inline" (not "attachment") is what makes the browser open the
        // PDF in its viewer instead of forcing a download.
        "Content-Disposition": `inline; filename="wattly-relatorio-${period.start_date}-a-${period.end_date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
