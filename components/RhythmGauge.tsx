"use client";

/**
 * Semicircular "rhythm" gauge. The needle position is the current daily
 * average as a fraction of a reasonable max (2x the expected pace), so the
 * needle sits center when exactly on pace, left when under, right when over.
 * Zones: green (on/under pace) -> yellow (a bit over) -> red (well over).
 */
export default function RhythmGauge({
  dailyAverageKwh,
  expectedDailyKwh,
}: {
  dailyAverageKwh: number;
  expectedDailyKwh: number | null;
}) {
  const width = 220;
  const height = 130;
  const cx = width / 2;
  const cy = 112;
  const r = 92;

  // Without a goal-derived expected pace, just show the gauge centered
  // with neutral zones (still useful as a "how much per day" readout).
  const expected = expectedDailyKwh && expectedDailyKwh > 0 ? expectedDailyKwh : dailyAverageKwh || 1;
  const maxScale = expected * 2;
  const fraction = Math.min(Math.max(dailyAverageKwh / maxScale, 0), 1);
  const angle = -180 + fraction * 180; // -180 (left) .. 0 (right), degrees

  const needleRad = (angle * Math.PI) / 180;
  const needleLen = r - 14;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  function arcPoint(deg: number, radius: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(fromDeg: number, toDeg: number, radius: number) {
    const from = arcPoint(fromDeg, radius);
    const to = arcPoint(toDeg, radius);
    return `M${from.x},${from.y} A${radius},${radius} 0 0 1 ${to.x},${to.y}`;
  }

  const pct = Math.round(
    expectedDailyKwh && expectedDailyKwh > 0
      ? ((dailyAverageKwh - expectedDailyKwh) / expectedDailyKwh) * 100
      : 0
  );

  let statusColor = "var(--color-primary)";
  let statusLabel = expectedDailyKwh ? "no ritmo esperado" : "";
  if (expectedDailyKwh) {
    if (pct > 15) {
      statusColor = "var(--color-alert)";
      statusLabel = `${pct}% acima do esperado`;
    } else if (pct > 0) {
      statusColor = "var(--color-accent)";
      statusLabel = `${pct}% acima do esperado`;
    } else if (pct < 0) {
      statusColor = "var(--color-primary)";
      statusLabel = `${Math.abs(pct)}% abaixo do esperado`;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: 240 }}>
        <path d={arcPath(-180, -60, r)} fill="none" stroke="#DCFCE7" strokeWidth="16" strokeLinecap="round" />
        <path d={arcPath(-60, -20, r)} fill="none" stroke="#FEF3C7" strokeWidth="16" strokeLinecap="round" />
        <path d={arcPath(-20, 0, r)} fill="none" stroke="#FEE2E2" strokeWidth="16" strokeLinecap="round" />

        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="var(--color-text)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="7" fill="var(--color-text)" />
      </svg>

      <p className="meter-value" style={{ marginTop: -8, marginBottom: 0 }}>
        {dailyAverageKwh.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        <span className="meter-unit">kWh/dia</span>
      </p>
      {statusLabel && (
        <p style={{ fontSize: 13, fontWeight: 600, color: statusColor, margin: "2px 0 0" }}>
          {pct !== 0 ? (pct > 0 ? "↑ " : "↓ ") : ""}
          {statusLabel}
        </p>
      )}
    </div>
  );
}
