export type TariffFlag = "verde" | "amarela" | "vermelha_1" | "vermelha_2";

export type Period = {
  id: number;
  start_date: string; // ISO date (yyyy-mm-dd)
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
  tariff_rate: number | null; // R$ per kWh (sum of TUSD + TE from the bill)
  tariff_flag: TariffFlag | null;
  flag_surcharge_rate: number | null; // R$ per 100 kWh, only applies when tariff_flag !== "verde"
  fixed_fees_reais: number | null; // flat charges independent of consumption (COSIP, small taxes, etc.)
};

export type Reading = {
  id: number;
  period_id: number;
  reading_at: string; // ISO datetime (UTC)
  kwh_reading: number;
};

export type DayConsumption = { date: string; consumption: number };

export type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number; // total consumed so far
  todayVariationKwh: number | null; // vs previous reading
  dailyAverageKwh: number | null;
  weeklyAverageKwh: number | null; // dailyAverageKwh * 7
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  forecastFinalKwh: number | null;
  forecastRemainingKwh: number | null;
  status: "sem_dados" | "dentro_do_esperado" | "acima_da_media" | "acima_da_meta";
  lastReadingAt: string | null;
  goalExceededNow: boolean; // actual accumulated consumption already above the goal
  bestDay: DayConsumption | null; // lowest-consumption day
  worstDay: DayConsumption | null; // highest-consumption day
  dailyBreakdown: DayConsumption[]; // one entry per calendar day, for daily/weekly/monthly logs
  alertLevel: "none" | "warning" | "danger";
  alertMessage: string | null;
  currentCostReais: number | null; // estimated energy cost for consumption so far (no fixed fees yet)
  forecastCostReais: number | null; // estimated full bill at forecasted period end (includes fixed fees)
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function toDate(iso: string): Date {
  // Treat as UTC date-only to avoid timezone drift on day counts.
  return new Date(iso + "T00:00:00Z");
}

/** Extracts the UTC calendar date (yyyy-mm-dd) from an ISO datetime. */
function dateOnly(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function fmt(v: number, decimals = 1): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Estimated bill for a given consumption, using the period's tariff rate
 * plus the "bandeira tarifária" surcharge when applicable. Returns null
 * when no tariff rate has been configured for the period (financial
 * tracking is opt-in). This is an estimate of the energy charge (+ flag +
 * optional fixed fees) — real bills may still include other small taxes
 * this app has no way to know about.
 *
 * `includeFixedFees` controls whether the flat, non-proportional charges
 * (public lighting contribution, small tax line items) are added — these
 * apply once per bill, not per kWh, so they only make sense on a "final
 * bill" estimate, not on a "cost of what I've used so far" figure.
 */
function estimateCostReais(kwh: number, period: Period, includeFixedFees: boolean): number | null {
  if (period.tariff_rate == null) return null;
  const energyCost = kwh * Number(period.tariff_rate);
  const flagCost =
    period.tariff_flag && period.tariff_flag !== "verde" && period.flag_surcharge_rate != null
      ? (kwh / 100) * Number(period.flag_surcharge_rate)
      : 0;
  const fixedCost = includeFixedFees && period.fixed_fees_reais != null ? Number(period.fixed_fees_reais) : 0;
  return energyCost + flagCost + fixedCost;
}

/**
 * Breaks total consumption down into one entry per calendar day.
 *
 * Each interval between two consecutive readings has a known total delta
 * (kWh) and a known duration (real elapsed time, from the readings'
 * timestamps — not just calendar dates). When that interval spans more
 * than one calendar day, the delta is split proportionally by how many
 * hours of the interval actually fall on each day, assuming a constant
 * consumption rate within the interval (the only assumption possible with
 * two endpoint readings and nothing in between).
 *
 * This is what correctly handles a reading taken mid-morning instead of
 * at day's end: only the hours that actually elapsed *that* day get
 * credited to it, and the remaining hours (overnight, into the next
 * reading) roll over to the following day(s) — instead of the whole gap
 * being dumped onto whichever day happens to have the next reading, which
 * used to make an ordinary day look like a consumption spike just because
 * the previous reading was taken early.
 */
function computeDailyBreakdown(period: Period, readings: Reading[]): DayConsumption[] {
  const sorted = [...readings].sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1));
  if (sorted.length === 0) return [];

  // Prepend the period's start as an implicit first point (midnight UTC of
  // start_date, at initial_kwh) so the interval up to the first real
  // reading is also split proportionally instead of landing entirely on
  // whichever day that first reading happens to be on.
  const points: { at: number; kwh: number }[] = [
    { at: toDate(period.start_date).getTime(), kwh: Number(period.initial_kwh) },
    ...sorted.map((r) => ({ at: new Date(r.reading_at).getTime(), kwh: Number(r.kwh_reading) })),
  ];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const byDay = new Map<string, number>();

  for (let i = 0; i < points.length - 1; i++) {
    const t0 = points[i].at;
    const t1 = points[i + 1].at;
    const delta = points[i + 1].kwh - points[i].kwh;
    const durationMs = t1 - t0;
    if (durationMs <= 0) continue; // out-of-order or duplicate timestamps — skip defensively

    const ratePerMs = delta / durationMs;
    let cursor = t0;
    while (cursor < t1) {
      const cursorDateStr = new Date(cursor).toISOString().slice(0, 10);
      const nextMidnight = toDate(cursorDateStr).getTime() + DAY_MS;
      const segmentEnd = Math.min(nextMidnight, t1);
      const segmentShare = ratePerMs * (segmentEnd - cursor);
      byDay.set(cursorDateStr, (byDay.get(cursorDateStr) ?? 0) + segmentShare);
      cursor = segmentEnd;
    }
  }

  return Array.from(byDay.entries())
    .map(([date, consumption]) => ({ date, consumption }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Computes the dashboard numbers from a period + its readings (any order).
 * Several readings per day are allowed — only the latest one (by
 * timestamp) counts for "current" numbers; day counts use its calendar date.
 * Mirrors the formulas in the product spec:
 * - Accumulated = latest reading - initial reading of the period.
 * - Daily average = accumulated / days elapsed since start.
 * - Forecast remaining = daily average * days remaining until end_date.
 * - Forecast final = accumulated + forecast remaining.
 */
export function computeSummary(period: Period, readings: Reading[]): Summary {
  const start = toDate(period.start_date);
  const end = toDate(period.end_date);
  // Inclusive day counts (day 1 = start_date itself), matching how the
  // product spec talks about "10 dias decorridos, 21 restantes" for a
  // 31-day period — not a raw date subtraction, which would be off by one.
  const totalDays = Math.max(daysBetween(start, end) + 1, 1);

  const sorted = [...readings].sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1));

  if (sorted.length === 0) {
    return {
      hasReadings: false,
      accumulatedKwh: 0,
      todayVariationKwh: null,
      dailyAverageKwh: null,
      weeklyAverageKwh: null,
      daysElapsed: 0,
      daysRemaining: totalDays,
      totalDays,
      forecastFinalKwh: null,
      forecastRemainingKwh: null,
      status: "sem_dados",
      lastReadingAt: null,
      goalExceededNow: false,
      bestDay: null,
      worstDay: null,
      dailyBreakdown: [],
      alertLevel: "none",
      alertMessage: null,
      currentCostReais: null,
      forecastCostReais: null,
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestDate = toDate(dateOnly(latest.reading_at));
  const accumulatedKwh = Number(latest.kwh_reading) - Number(period.initial_kwh);

  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const todayVariationKwh = previous
    ? Number(latest.kwh_reading) - Number(previous.kwh_reading)
    : null;

  const daysElapsedRaw = daysBetween(start, latestDate) + 1;
  const daysElapsed = Math.max(daysElapsedRaw, 1); // avoid divide-by-zero on day 0
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);

  const dailyAverageKwh = accumulatedKwh / daysElapsed;
  const weeklyAverageKwh = dailyAverageKwh * 7;
  const forecastRemainingKwh = dailyAverageKwh * daysRemaining;
  const forecastFinalKwh = accumulatedKwh + forecastRemainingKwh;

  const goal = period.goal_kwh != null ? Number(period.goal_kwh) : null;
  const goalExceededNow = goal != null && accumulatedKwh > goal;

  let status: Summary["status"] = "dentro_do_esperado";
  if (goal != null) {
    status = forecastFinalKwh > goal ? "acima_da_meta" : "dentro_do_esperado";
  } else if (todayVariationKwh != null && dailyAverageKwh > 0) {
    // Without a goal, flag if the last reading's pace is notably above the running average.
    status = todayVariationKwh > dailyAverageKwh * 1.2 ? "acima_da_media" : "dentro_do_esperado";
  }

  const dailyBreakdown = computeDailyBreakdown(period, readings);
  // "Melhor dia" only makes sense for a day that's actually over — a day
  // still in progress will always look artificially good just because
  // fewer hours have had a chance to add consumption yet. A day counts as
  // closed once there's a reading on a later calendar date (which is what
  // gives that day's bucket its full, real 24h of measured consumption —
  // see computeDailyBreakdown). "Pior dia" doesn't have this problem: a
  // partial day that's already the highest is still a real, verified
  // signal, not an artifact of less time having passed.
  const latestDay = dateOnly(latest.reading_at);
  const closedDays = dailyBreakdown.filter((d) => d.date < latestDay);

  let bestDay: DayConsumption | null = null;
  let worstDay: DayConsumption | null = null;
  for (const day of closedDays) {
    if (!bestDay || day.consumption < bestDay.consumption) bestDay = day;
  }
  for (const day of dailyBreakdown) {
    if (!worstDay || day.consumption > worstDay.consumption) worstDay = day;
  }

  // In-app alerts: the strongest true signal wins. Actual consumption
  // already past the goal beats a mere forecast, which beats a same-day spike.
  let alertLevel: Summary["alertLevel"] = "none";
  let alertMessage: string | null = null;
  if (goalExceededNow && goal != null) {
    alertLevel = "danger";
    alertMessage = `Você já ultrapassou sua meta em ${fmt(accumulatedKwh - goal)} kWh.`;
  } else if (goal != null && forecastFinalKwh > goal) {
    alertLevel = "warning";
    alertMessage = `No ritmo atual, você deve fechar o período ${fmt(forecastFinalKwh - goal)} kWh acima da meta.`;
  } else if (todayVariationKwh != null && dailyAverageKwh > 0 && todayVariationKwh > dailyAverageKwh * 1.3) {
    alertLevel = "warning";
    alertMessage = `Sua última leitura veio acima do ritmo normal: ${fmt(todayVariationKwh)} kWh contra uma média de ${fmt(dailyAverageKwh, 2)} kWh/dia.`;
  }

  return {
    hasReadings: true,
    accumulatedKwh,
    todayVariationKwh,
    dailyAverageKwh,
    weeklyAverageKwh,
    daysElapsed,
    daysRemaining,
    totalDays,
    forecastFinalKwh,
    forecastRemainingKwh,
    status,
    lastReadingAt: latest.reading_at,
    goalExceededNow,
    bestDay,
    worstDay,
    dailyBreakdown,
    alertLevel,
    alertMessage,
    currentCostReais: estimateCostReais(accumulatedKwh, period, false),
    forecastCostReais: forecastFinalKwh != null ? estimateCostReais(forecastFinalKwh, period, true) : null,
  };
}
