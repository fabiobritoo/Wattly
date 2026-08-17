"use client";

type Point = { t: number; v: number };

export default function EvolutionChart({
  startDate,
  endDate,
  currentAt,
  accumulatedKwh,
  forecastFinalKwh,
}: {
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  currentAt: string; // ISO datetime of the latest reading
  accumulatedKwh: number;
  forecastFinalKwh: number;
}) {
  const width = 320;
  const height = 180;
  const padX = 12;
  const padTop = 34;
  const padBottom = 30;

  const toTime = (iso: string) => new Date(iso).getTime();
  const startT = toTime(startDate + "T00:00:00Z");
  const endT = toTime(endDate + "T00:00:00Z");
  const currentT = Math.min(Math.max(toTime(currentAt), startT), endT);
  const span = Math.max(endT - startT, 1);

  const points: Point[] = [
    { t: startT, v: 0 },
    { t: currentT, v: accumulatedKwh },
    { t: endT, v: forecastFinalKwh },
  ];

  const maxV = Math.max(...points.map((p) => p.v), 1) * 1.2;

  const x = (t: number) => padX + ((t - startT) / span) * (width - padX * 2);
  const y = (v: number) =>
    height - padBottom - (v / maxV) * (height - padBottom - padTop);

  const [inicio, atual, previsto] = points;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const gridLines = [0.25, 0.5, 0.75, 1].map(
    (f) => height - padBottom - f * (height - padBottom - padTop)
  );

  // Keep the middle label from overlapping the edges when "atual" sits
  // close to start or end.
  const atualAnchor =
    x(atual.t) < padX + 40 ? "start" : x(atual.t) > width - padX - 40 ? "end" : "middle";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Evolução do consumo: início 0 kWh, atual ${fmt(atual.v)} kWh, previsto ${fmt(previsto.v)} kWh`}
    >
      {gridLines.map((gy, i) => (
        <line key={i} x1={padX} x2={width - padX} y1={gy} y2={gy} stroke="#E6EBF3" strokeWidth="1" />
      ))}

      {/* forecast segment: atual -> previsto */}
      <path
        d={`M${x(atual.t)},${y(atual.v)} L${x(previsto.t)},${y(previsto.v)}`}
        fill="none"
        stroke="#FACC15"
        strokeWidth="2.5"
        strokeDasharray="5 4"
        strokeLinecap="round"
      />

      {/* real segment: início -> atual */}
      <path
        d={`M${x(inicio.t)},${y(inicio.v)} L${x(atual.t)},${y(atual.v)}`}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* início */}
      <circle cx={x(inicio.t)} cy={y(inicio.v)} r="4" fill="#2563EB" />
      <text x={x(inicio.t)} y={y(inicio.v) - 12} fontSize="10" fontWeight="600" fill="#5B6678" textAnchor="start">
        Início
      </text>
      <text x={x(inicio.t)} y={height - 8} fontSize="10" fill="#5B6678" textAnchor="start">
        {fmt(inicio.v)} kWh
      </text>

      {/* atual */}
      <circle cx={x(atual.t)} cy={y(atual.v)} r="4.5" fill="#2563EB" />
      <text x={x(atual.t)} y={y(atual.v) - 14} fontSize="10" fontWeight="700" fill="#172033" textAnchor={atualAnchor}>
        Atual
      </text>
      <text x={x(atual.t)} y={y(atual.v) - 3} fontSize="11" fontWeight="700" fill="#2563EB" textAnchor={atualAnchor}>
        {fmt(atual.v)} kWh
      </text>

      {/* previsto */}
      <circle cx={x(previsto.t)} cy={y(previsto.v)} r="4" fill="#FACC15" />
      <text x={x(previsto.t)} y={y(previsto.v) - 12} fontSize="10" fontWeight="600" fill="#5B6678" textAnchor="end">
        Previsto
      </text>
      <text x={x(previsto.t)} y={height - 8} fontSize="10" fill="#92660A" textAnchor="end">
        {fmt(previsto.v)} kWh
      </text>
    </svg>
  );
}
