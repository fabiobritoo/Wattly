export type Period = {
  id: number;
  start_date: string; // ISO date (yyyy-mm-dd)
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
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
  alertLevel: "none" | "warning" | "danger";
  alertMessage: string | null;
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

function addDaysToDateStr(dateStr: string, n: number): string {
  const d = toDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmt(v: number, decimals = 1): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Breaks total consumption down into one entry per calendar day, using the
 * last reading of each day as that day's "closing" meter value. When there's
 * a gap between two days with readings (e.g. user skipped a day), the
 * consumption across the gap is spread evenly across the missing days
 * instead of being dumped entirely onto the next reading's day — otherwise
 * a single missed day would falsely look like the "worst day".
 */
function computeDailyBreakdown(period: Period, readings: Reading[]): DayConsumption[] {
  const closing = new Map<string, number>();
  const sorted = [...readings].sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1));
  for (const r of sorted) {
    closing.set(dateOnly(r.reading_at), Number(r.kwh_reading));
  }

  const dates = Array.from(closing.keys()).sort();
  if (dates.length === 0) return [];

  const results: DayConsumption[] = [];
  let prevDate = period.start_date;
  let prevValue = Number(period.initial_kwh);

  for (const d of dates) {
    const gapDays = daysBetween(toDate(prevDate), toDate(d));
    const closingValue = closing.get(d)!;
    const totalDelta = closingValue - prevValue;

    if (gapDays <= 0) {
      results.push({ date: d, consumption: totalDelta });
    } else {
      const perDay = totalDelta / gapDays;
      for (let i = 1; i <= gapDays; i++) {
        results.push({ date: addDaysToDateStr(prevDate, i), consumption: perDay });
      }
    }

    prevDate = d;
    prevValue = closingValue;
  }

  return results;
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
      alertLevel: "none",
      alertMessage: null,
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
  let bestDay: DayConsumption | null = null;
  let worstDay: DayConsumption | null = null;
  for (const day of dailyBreakdown) {
    if (!bestDay || day.consumption < bestDay.consumption) bestDay = day;
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
    alertLevel,
    alertMessage,
  };
}
