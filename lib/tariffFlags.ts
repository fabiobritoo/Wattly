export type TariffFlag = "verde" | "amarela" | "vermelha_1" | "vermelha_2";

export const FLAG_LABELS: Record<TariffFlag, string> = {
  verde: "Verde (sem custo extra)",
  amarela: "Amarela",
  vermelha_1: "Vermelha — patamar 1",
  vermelha_2: "Vermelha — patamar 2",
};

/**
 * Official ANEEL surcharges per flag, in R$ per 100 kWh (the app's unit for
 * flag_surcharge_rate) — converted from ANEEL's published R$/kWh figures:
 * Verde: R$0 | Amarela: R$0,01885/kWh | Vermelha 1: R$0,04463/kWh |
 * Vermelha 2: R$0,07877/kWh.
 *
 * These are set nationally by ANEEL (unlike TUSD/TE, which vary by
 * distributor), so they're a safe default — but ANEEL revises them from
 * time to time, and the field stays editable in the UI for whenever that
 * happens.
 */
export const ANEEL_FLAG_SURCHARGE_PER_100KWH: Record<TariffFlag, number> = {
  verde: 0,
  amarela: 1.885,
  vermelha_1: 4.463,
  vermelha_2: 7.877,
};
