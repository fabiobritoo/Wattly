import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    await migrate();
    const sql = getSql();
    const rows = await sql`
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh
      FROM periods
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return jsonNoStore({ period: rows[0] ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { id, start_date, end_date, initial_kwh, goal_kwh } = body ?? {};

    if (!start_date || !end_date || initial_kwh === undefined || initial_kwh === null) {
      return errorResponse(
        new Error("Campos obrigatórios: start_date, end_date, initial_kwh."),
        400
      );
    }
    if (new Date(end_date) < new Date(start_date)) {
      return errorResponse(new Error("A data final não pode ser antes da data inicial."), 400);
    }

    const sql = getSql();
    const goalValue = goal_kwh === "" || goal_kwh === undefined ? null : goal_kwh;

    let rows;
    if (id) {
      rows = await sql`
        UPDATE periods
        SET start_date = ${start_date},
            end_date = ${end_date},
            initial_kwh = ${initial_kwh},
            goal_kwh = ${goalValue},
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh
      `;
    } else {
      rows = await sql`
        INSERT INTO periods (start_date, end_date, initial_kwh, goal_kwh)
        VALUES (${start_date}, ${end_date}, ${initial_kwh}, ${goalValue})
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh
      `;
    }

    return jsonNoStore({ period: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}
