"use client";

type DayConsumption = { date: string; consumption: number };

function fmtDayLabel(iso: string) {
  const [, , d] = iso.split("-");
  return d;
}

/**
 * One bar per day (from the time-weighted daily breakdown in lib/calc.ts —
 * see computeDailyBreakdown for how partial-day readings are handled).
 * Bars are colored against a reference pace: the daily budget implied by
 * the goal when one is set, otherwise the period's own running average —
 * so at a glance you can see which specific days pushed the pace up,
 * instead of just watching the cumulative total climb.
 */
export default function DailyConsumptionChart({
  days,
  referenceKwh,
  referenceLabel,
}: {
  days: DayConsumption[];
  referenceKwh: number | null;
  referenceLabel: string;
}) {
  const width = 320;
  const height = 190;
  const padX = 10;
  const padTop = 14;
  const padBottom = 22;

  if (days.length === 0) {
    return null;
  }

  const maxValue = Math.max(...days.map((d) => d.consumption), referenceKwh ?? 0, 0.1) * 1.15;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const barGap = 2;
  const barW = Math.max(chartW / days.length - barGap, 1.5);

  const xFor = (i: number) => padX + i * (chartW / days.length);
  const yFor = (v: number) => padTop + chartH - (Math.max(v, 0) / maxValue) * chartH;

  const refY = referenceKwh != null ? yFor(referenceKwh) : null;

  // Thin out x-axis labels so they don't collide when there are many days.
  const labelStride = days.length > 15 ? 5 : days.length > 8 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Consumo por dia, comparado com ${referenceLabel}`}
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={width - padX}
          y1={padTop + chartH - f * chartH}
          y2={padTop + chartH - f * chartH}
          stroke="#E6EBF3"
          strokeWidth="1"
        />
      ))}

      {days.map((d, i) => {
        const barHeight = Math.max(yFor(0) - yFor(d.consumption), 0.5);
        const overPace = referenceKwh != null && d.consumption > referenceKwh;
        return (
          <rect
            key={d.date}
            x={xFor(i) + barGap / 2}
            y={yFor(d.consumption)}
            width={barW}
            height={barHeight}
            rx={1.5}
            fill={overPace ? "#EF4444" : "#22C55E"}
            opacity={overPace ? 0.85 : 0.8}
          />
        );
      })}

      {refY != null && (
        <line
          x1={padX}
          x2={width - padX}
          y1={refY}
          y2={refY}
          stroke="#5B6678"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}

      {days.map((d, i) =>
        i % labelStride === 0 ? (
          <text
            key={d.date}
            x={xFor(i) + barW / 2}
            y={height - 6}
            fontSize="8"
            fill="#5B6678"
            textAnchor="middle"
          >
            {fmtDayLabel(d.date)}
          </text>
        ) : null
      )}
    </svg>
  );
}
