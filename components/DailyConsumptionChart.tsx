"use client";

type DayConsumption = { date: string; consumption: number };

function fmtDayLabel(iso: string) {
  const [, , d] = iso.split("-");
  return d;
}

function fmtValueLabel(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * One bar per day (from the time-weighted daily breakdown in lib/calc.ts —
 * see computeDailyBreakdown for how partial-day readings are handled).
 * Bars are colored against a reference pace: the daily budget implied by
 * the goal when one is set, otherwise the period's own running average —
 * so at a glance you can see which specific days pushed the pace up,
 * instead of just watching the cumulative total climb. Each bar is also
 * labeled with its exact value — vertical (rotated) once there are enough
 * days that horizontal labels would collide.
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
  // Labels need room above the tallest bar — vertical labels need more
  // than horizontal ones, since the text runs the label's full length.
  const useVerticalLabels = days.length > 10;
  const padTop = useVerticalLabels ? 46 : 26;
  const padBottom = 22;

  if (days.length === 0) {
    return null;
  }

  const maxValue = Math.max(...days.map((d) => d.consumption), referenceKwh ?? 0, 0.1) * 1.12;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const barGap = 2;
  const barW = Math.max(chartW / days.length - barGap, 1.5);

  const xFor = (i: number) => padX + i * (chartW / days.length);
  const yFor = (v: number) => padTop + chartH - (Math.max(v, 0) / maxValue) * chartH;

  const refY = referenceKwh != null ? yFor(referenceKwh) : null;

  // Thin out x-axis (day-of-month) labels so they don't collide when there
  // are many days — the value labels above each bar stay on every bar
  // regardless, since that's the number that actually matters here.
  const labelStride = days.length > 15 ? 5 : days.length > 8 ? 2 : 1;
  const valueFontSize = useVerticalLabels ? 6.5 : 8.5;

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
        const barTop = yFor(d.consumption);
        const barHeight = Math.max(yFor(0) - barTop, 0.5);
        const overPace = referenceKwh != null && d.consumption > referenceKwh;
        const cx = xFor(i) + barGap / 2 + barW / 2;
        return (
          <g key={d.date}>
            <rect
              x={xFor(i) + barGap / 2}
              y={barTop}
              width={barW}
              height={barHeight}
              rx={1.5}
              fill={overPace ? "#EF4444" : "#22C55E"}
              opacity={overPace ? 0.85 : 0.8}
            />
            {useVerticalLabels ? (
              <text
                x={cx}
                y={barTop - 3}
                fontSize={valueFontSize}
                fill="#5B6678"
                textAnchor="start"
                transform={`rotate(-90 ${cx} ${barTop - 3})`}
              >
                {fmtValueLabel(d.consumption)}
              </text>
            ) : (
              <text x={cx} y={barTop - 4} fontSize={valueFontSize} fill="#5B6678" textAnchor="middle">
                {fmtValueLabel(d.consumption)}
              </text>
            )}
          </g>
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

