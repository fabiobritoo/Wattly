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
  date: string;
  kwh_reading: number;
};

export type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number; // total consumed so far
  todayVariationKwh: number | null; // vs previous reading
  dailyAverageKwh: number | null;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  forecastFinalKwh: number | null;
  forecastRemainingKwh: number | null;
  status: "sem_dados" | "dentro_do_esperado" | "acima_da_media" | "acima_da_meta";
  lastReadingDate: string | null;
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function toDate(iso: string): Date {
  // Treat as UTC date-only to avoid timezone drift on day counts.
  return new Date(iso + "T00:00:00Z");
}

/**
 * Computes the dashboard numbers from a period + its ordered readings
 * (ascending by date). Mirrors the formulas in the product spec:
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

  const sorted = [...readings].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (sorted.length === 0) {
    return {
      hasReadings: false,
      accumulatedKwh: 0,
      todayVariationKwh: null,
      dailyAverageKwh: null,
      daysElapsed: 0,
      daysRemaining: totalDays,
      totalDays,
      forecastFinalKwh: null,
      forecastRemainingKwh: null,
      status: "sem_dados",
      lastReadingDate: null,
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestDate = toDate(latest.date);
  const accumulatedKwh = Number(latest.kwh_reading) - Number(period.initial_kwh);

  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const todayVariationKwh = previous
    ? Number(latest.kwh_reading) - Number(previous.kwh_reading)
    : null;

  const daysElapsedRaw = daysBetween(start, latestDate) + 1;
  const daysElapsed = Math.max(daysElapsedRaw, 1); // avoid divide-by-zero on day 0
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);

  const dailyAverageKwh = accumulatedKwh / daysElapsed;
  const forecastRemainingKwh = dailyAverageKwh * daysRemaining;
  const forecastFinalKwh = accumulatedKwh + forecastRemainingKwh;

  let status: Summary["status"] = "dentro_do_esperado";
  if (period.goal_kwh != null) {
    if (forecastFinalKwh > Number(period.goal_kwh)) {
      status = "acima_da_meta";
    } else {
      status = "dentro_do_esperado";
    }
  } else if (todayVariationKwh != null && dailyAverageKwh > 0) {
    // Without a goal, flag if today's pace is notably above the running average.
    status = todayVariationKwh > dailyAverageKwh * 1.2 ? "acima_da_media" : "dentro_do_esperado";
  }

  return {
    hasReadings: true,
    accumulatedKwh,
    todayVariationKwh,
    dailyAverageKwh,
    daysElapsed,
    daysRemaining,
    totalDays,
    forecastFinalKwh,
    forecastRemainingKwh,
    status,
    lastReadingDate: latest.date,
  };
}
