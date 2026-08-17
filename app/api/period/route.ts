import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const VALID_FLAGS = new Set(["verde", "amarela", "vermelha_1", "vermelha_2"]);

export async function GET() {
  try {
    await migrate();
    const sql = getSql();
    const rows = await sql`
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
             tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
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
    const {
      id,
      start_date,
      end_date,
      initial_kwh,
      goal_kwh,
      tariff_rate,
      tariff_flag,
      flag_surcharge_rate,
      fixed_fees_reais,
    } = body ?? {};

    if (!start_date || !end_date || initial_kwh === undefined || initial_kwh === null) {
      return errorResponse(
        new Error("Campos obrigatórios: start_date, end_date, initial_kwh."),
        400
      );
    }
    if (new Date(end_date) < new Date(start_date)) {
      return errorResponse(new Error("A data final não pode ser antes da data inicial."), 400);
    }
    if (tariff_flag && !VALID_FLAGS.has(tariff_flag)) {
      return errorResponse(new Error("Bandeira tarifária inválida."), 400);
    }

    const sql = getSql();
    const goalValue = goal_kwh === "" || goal_kwh === undefined ? null : goal_kwh;
    const tariffRateValue = tariff_rate === "" || tariff_rate === undefined ? null : tariff_rate;
    const tariffFlagValue = tariff_flag || null;
    // The flag surcharge only makes sense (and is only stored) for non-"verde" flags.
    const flagSurchargeValue =
      tariffFlagValue && tariffFlagValue !== "verde" && flag_surcharge_rate !== "" && flag_surcharge_rate !== undefined
        ? flag_surcharge_rate
        : null;
    const fixedFeesValue = fixed_fees_reais === "" || fixed_fees_reais === undefined ? null : fixed_fees_reais;

    let rows;
    if (id) {
      rows = await sql`
        UPDATE periods
        SET start_date = ${start_date},
            end_date = ${end_date},
            initial_kwh = ${initial_kwh},
            goal_kwh = ${goalValue},
            tariff_rate = ${tariffRateValue},
            tariff_flag = ${tariffFlagValue},
            flag_surcharge_rate = ${flagSurchargeValue},
            fixed_fees_reais = ${fixedFeesValue},
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                  tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      `;
    } else {
      rows = await sql`
        INSERT INTO periods (start_date, end_date, initial_kwh, goal_kwh, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais)
        VALUES (${start_date}, ${end_date}, ${initial_kwh}, ${goalValue}, ${tariffRateValue}, ${tariffFlagValue}, ${flagSurchargeValue}, ${fixedFeesValue})
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                  tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      `;
    }

    return jsonNoStore({ period: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}
