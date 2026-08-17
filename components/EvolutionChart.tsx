"use client";

type Reading = { reading_at: string; kwh_reading: number };

export default function EvolutionChart({
  startDate,
  endDate,
  initialKwh,
  readings,
  forecastFinalKwh,
  goalKwh,
}: {
  startDate: string;
  endDate: string;
  initialKwh: number;
  readings: Reading[];
  forecastFinalKwh: number | null;
  goalKwh: number | null;
}) {
  const width = 320;
  const height = 190;
  const padX = 10;
  const padTop = 34; // room for the forecast callout bubble
  const padBottom = 22;

  const toTime = (iso: string) => new Date(iso).getTime();
  const startT = toTime(startDate + "T00:00:00Z");
  const endT = toTime(endDate + "T00:00:00Z");
  const span = Math.max(endT - startT, 1);

  const points = readings
    .slice()
    .sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1))
    .map((r) => ({ t: toTime(r.reading_at), v: r.kwh_reading - initialKwh }));

  // Anchor the series at (start_date, 0) if there isn't already a reading
  // for that exact moment — the meter's first reading is the zero point.
  if (points.length === 0 || points[0].t !== startT) {
    points.unshift({ t: startT, v: 0 });
  }

  const lastPoint = points[points.length - 1];
  const forecastPoint =
    forecastFinalKwh != null && lastPoint.t < endT ? { t: endT, v: forecastFinalKwh } : null;

  const allValues = points
    .map((p) => p.v)
    .concat(forecastPoint ? [forecastPoint.v] : [])
    .concat(goalKwh != null ? [goalKwh] : []);
  const maxV = Math.max(...allValues, 1) * 1.15;

  const x = (t: number) => padX + ((t - startT) / span) * (width - padX * 2);
  const y = (v: number) => height - padBottom - (v / maxV) * (height - padBottom - padTop);

  const realPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t)},${y(p.v)}`).join(" ");
  const forecastPath = forecastPoint
    ? `M${x(lastPoint.t)},${y(lastPoint.v)} L${x(forecastPoint.t)},${y(forecastPoint.v)}`
    : "";

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => height - padBottom - f * (height - padBottom - padTop));

  // "Zona segura": the shaded band from 0 up to the goal line, when a goal
  // is set — a quick visual read of how much headroom is left.
  const safeZoneTop = goalKwh != null ? y(goalKwh) : null;
  const safeZonePath =
    safeZoneTop != null
      ? `M${padX},${height - padBottom} L${padX},${safeZoneTop} L${width - padX},${safeZoneTop} L${width - padX},${height - padBottom} Z`
      : null;

  const forecastAbove = goalKwh != null && forecastPoint != null && forecastPoint.v > goalKwh;
  const forecastColor = goalKwh == null ? "#F5B91E" : forecastAbove ? "#EF4444" : "#16C76A";

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Keep the forecast callout bubble from clipping off the right edge.
  const bubbleW = 74;
  const bubbleX = forecastPoint ? Math.min(x(forecastPoint.t) - bubbleW / 2, width - padX - bubbleW) : 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Gráfico de evolução do consumo, com zona segura, meta e projeção até o fim do período"
      >
        {gridLines.map((gy, i) => (
          <line key={i} x1={padX} x2={width - padX} y1={gy} y2={gy} stroke="#E6EBF3" strokeWidth="1" />
        ))}

        {safeZonePath && <path d={safeZonePath} fill="#16C76A" opacity="0.08" />}

        {goalKwh != null && (
          <line
            x1={padX}
            x2={width - padX}
            y1={y(goalKwh)}
            y2={y(goalKwh)}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke={forecastColor}
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
          <>
            <circle cx={x(forecastPoint.t)} cy={y(forecastPoint.v)} r="3.5" fill={forecastColor} />
            <g transform={`translate(${bubbleX}, ${Math.max(y(forecastPoint.v) - 30, 2)})`}>
              <rect width={bubbleW} height={20} rx={10} fill={forecastColor} />
              <text
                x={bubbleW / 2}
                y={14}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="700"
                fill="#fff"
              >
                {fmt(forecastPoint.v)} kWh
              </text>
            </g>
          </>
        )}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 6, fontSize: 11.5, color: "var(--color-text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2.5, background: "#2563EB", borderRadius: 2, display: "inline-block" }} />
          Real
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 12,
              height: 2.5,
              background: `repeating-linear-gradient(90deg, ${forecastColor} 0 4px, transparent 4px 7px)`,
              display: "inline-block",
            }}
          />
          Previsão
        </span>
        {goalKwh != null && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 12,
                  height: 2,
                  background: "repeating-linear-gradient(90deg, #94A3B8 0 4px, transparent 4px 7px)",
                  display: "inline-block",
                }}
              />
              Meta
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, background: "#16C76A", opacity: 0.35, borderRadius: 2, display: "inline-block" }} />
              Zona segura
            </span>
          </>
        )}
      </div>
    </div>
  );
}
