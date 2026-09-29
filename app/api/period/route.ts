import { getSql, migrate } from "@/lib/db";
import { jsonNoStore, errorResponse, normalizeNumericFields } from "@/lib/api";
import { effectiveGoalKwh, totalDaysOf } from "@/lib/calc";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const VALID_FLAGS = new Set(["verde", "amarela", "vermelha_1", "vermelha_2"]);
const PERIOD_NUMERIC_FIELDS = [
  "initial_kwh",
  "goal_kwh",
  "goal_kwh_per_day",
  "tariff_rate",
  "flag_surcharge_rate",
  "fixed_fees_reais",
] as const;

// goal_kwh is set as a daily rate and extended to the period's own length
// (see lib/calc.ts effectiveGoalKwh) — every period row leaving this route
// gets its goal_kwh overwritten with that recomputed total, so it's always
// correct for the period's CURRENT dates even if they were edited after
// the goal was last saved, without every consumer of this response having
// to know about goal_kwh_per_day at all.
function withEffectiveGoal<T extends Record<string, any>>(period: T): T {
  return { ...period, goal_kwh: effectiveGoalKwh(period as any) };
}

export async function GET() {
  try {
    await migrate();
    const sql = getSql();
    const rows = await sql`
      SELECT id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
             goal_kwh_per_day, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      FROM periods
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const period = rows[0] ? withEffectiveGoal(normalizeNumericFields(rows[0], PERIOD_NUMERIC_FIELDS)) : null;
    return jsonNoStore({ period });
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
      goal_kwh_per_day,
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
    const goalPerDayValue =
      goal_kwh_per_day === "" || goal_kwh_per_day === undefined || goal_kwh_per_day === null
        ? null
        : Number(goal_kwh_per_day);
    // Store the extended total alongside the daily rate — the raw SQL in
    // the PDF report reads goal_kwh directly, and this keeps that number
    // correct without importing calc.ts into a query-only route.
    const goalTotalValue =
      goalPerDayValue != null ? goalPerDayValue * totalDaysOf({ start_date, end_date }) : null;
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
            goal_kwh = ${goalTotalValue},
            goal_kwh_per_day = ${goalPerDayValue},
            tariff_rate = ${tariffRateValue},
            tariff_flag = ${tariffFlagValue},
            flag_surcharge_rate = ${flagSurchargeValue},
            fixed_fees_reais = ${fixedFeesValue},
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                  goal_kwh_per_day, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      `;
    } else {
      rows = await sql`
        INSERT INTO periods (start_date, end_date, initial_kwh, goal_kwh, goal_kwh_per_day, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais)
        VALUES (${start_date}, ${end_date}, ${initial_kwh}, ${goalTotalValue}, ${goalPerDayValue}, ${tariffRateValue}, ${tariffFlagValue}, ${flagSurchargeValue}, ${fixedFeesValue})
        RETURNING id, start_date::text AS start_date, end_date::text AS end_date, initial_kwh, goal_kwh,
                  goal_kwh_per_day, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      `;
    }

    return jsonNoStore({ period: withEffectiveGoal(normalizeNumericFields(rows[0], PERIOD_NUMERIC_FIELDS)) });
  } catch (err) {
    return errorResponse(err);
  }
}
