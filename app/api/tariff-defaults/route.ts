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
      SELECT tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
      FROM tariff_defaults
      WHERE id = 1
    `;
    return jsonNoStore({ defaults: rows[0] ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await migrate();
    const body = await req.json();
    const { tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais } = body ?? {};

    if (tariff_flag && !VALID_FLAGS.has(tariff_flag)) {
      return errorResponse(new Error("Bandeira tarifária inválida."), 400);
    }

    const sql = getSql();
    const tariffRateValue = tariff_rate === "" || tariff_rate === undefined ? null : tariff_rate;
    const tariffFlagValue = tariff_flag || null;
    const flagSurchargeValue =
      tariffFlagValue && tariffFlagValue !== "verde" && flag_surcharge_rate !== "" && flag_surcharge_rate !== undefined
        ? flag_surcharge_rate
        : null;
    const fixedFeesValue = fixed_fees_reais === "" || fixed_fees_reais === undefined ? null : fixed_fees_reais;

    const rows = await sql`
      INSERT INTO tariff_defaults (id, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais, updated_at)
      VALUES (1, ${tariffRateValue}, ${tariffFlagValue}, ${flagSurchargeValue}, ${fixedFeesValue}, now())
      ON CONFLICT (id)
      DO UPDATE SET
        tariff_rate = EXCLUDED.tariff_rate,
        tariff_flag = EXCLUDED.tariff_flag,
        flag_surcharge_rate = EXCLUDED.flag_surcharge_rate,
        fixed_fees_reais = EXCLUDED.fixed_fees_reais,
        updated_at = now()
      RETURNING tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais
    `;

    return jsonNoStore({ defaults: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}
