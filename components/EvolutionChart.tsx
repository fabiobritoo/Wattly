"use client";

type Reading = { date: string; kwh_reading: number };

export default function EvolutionChart({
  startDate,
  endDate,
  initialKwh,
  readings,
  forecastFinalKwh,
}: {
  startDate: string;
  endDate: string;
  initialKwh: number;
  readings: Reading[];
  forecastFinalKwh: number | null;
}) {
  const width = 320;
  const height = 160;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;

  const toTime = (iso: string) => new Date(iso + "T00:00:00Z").getTime();
  const startT = toTime(startDate);
  const endT = toTime(endDate);
  const span = Math.max(endT - startT, 1);

  const points = readings
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({ t: toTime(r.date), v: r.kwh_reading - initialKwh }));

  // Anchor the series at (start_date, 0) if there isn't already a reading
  // for that exact day — the meter's first reading is the zero point.
  if (points.length === 0 || points[0].t !== startT) {
    points.unshift({ t: startT, v: 0 });
  }

  const lastPoint = points[points.length - 1];
  const forecastPoint =
    forecastFinalKwh != null && lastPoint.t < endT
      ? { t: endT, v: forecastFinalKwh }
      : null;

  const allValues = points.map((p) => p.v).concat(forecastPoint ? [forecastPoint.v] : []);
  const maxV = Math.max(...allValues, 1) * 1.12;

  const x = (t: number) => padX + ((t - startT) / span) * (width - padX * 2);
  const y = (v: number) =>
    height - padBottom - (v / maxV) * (height - padBottom - padTop);

  const realPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t)},${y(p.v)}`).join(" ");
  const forecastPath = forecastPoint
    ? `M${x(lastPoint.t)},${y(lastPoint.v)} L${x(forecastPoint.t)},${y(forecastPoint.v)}`
    : "";

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => height - padBottom - f * (height - padBottom - padTop));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Gráfico de evolução do consumo, com projeção até o fim do período"
    >
      {gridLines.map((gy, i) => (
        <line
          key={i}
          x1={padX}
          x2={width - padX}
          y1={gy}
          y2={gy}
          stroke="#E6EBF3"
          strokeWidth="1"
        />
      ))}

      {forecastPath && (
        <path
          d={forecastPath}
          fill="none"
          stroke="#FACC15"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}

      <path d={realPath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r="3.5" fill="#2563EB" />
      ))}

      {forecastPoint && (
        <circle cx={x(forecastPoint.t)} cy={y(forecastPoint.v)} r="3.5" fill="#FACC15" />
      )}
    </svg>
  );
}
