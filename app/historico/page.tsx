"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryIcon } from "@/components/icons";

type DayConsumption = { date: string; consumption: number };

type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number;
  dailyAverageKwh: number | null;
  forecastFinalKwh: number | null;
  goalExceededNow: boolean;
  bestDay: DayConsumption | null;
  worstDay: DayConsumption | null;
  forecastCostReais: number | null;
  dailyBreakdown: DayConsumption[];
};

type PeriodEntry = {
  id: number;
  start_date: string;
  end_date: string;
  goal_kwh: number | null;
  isCurrent: boolean;
  summary: Summary;
};

function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtKwh(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type LogRow = { label: string; sublabel?: string; consumption: number; variationPct: number | null };

function toDayRows(breakdown: DayConsumption[]): LogRow[] {
  const sorted = [...breakdown].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((d, i) => {
    const prev = i > 0 ? sorted[i - 1].consumption : null;
    const variationPct = prev && prev !== 0 ? ((d.consumption - prev) / prev) * 100 : null;
    return { label: fmtDate(d.date), consumption: d.consumption, variationPct };
  });
}

function toWeekRows(breakdown: DayConsumption[]): LogRow[] {
  const sorted = [...breakdown].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return [];
  const buckets = new Map<number, { start: string; total: number }>();
  const start0 = new Date(sorted[0].date + "T00:00:00Z").getTime();
  for (const d of sorted) {
    const t = new Date(d.date + "T00:00:00Z").getTime();
    const weekIdx = Math.floor((t - start0) / (7 * 86400000));
    const bucket = buckets.get(weekIdx);
    if (bucket) {
      bucket.total += d.consumption;
    } else {
      buckets.set(weekIdx, { start: d.date, total: d.consumption });
    }
  }
  const weeks = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
  return weeks.map(([idx, bucket], i) => {
    const prevTotal = i > 0 ? weeks[i - 1][1].total : null;
    const variationPct = prevTotal && prevTotal !== 0 ? ((bucket.total - prevTotal) / prevTotal) * 100 : null;
    return { label: `Semana ${idx + 1}`, sublabel: `a partir de ${fmtDate(bucket.start)}`, consumption: bucket.total, variationPct };
  });
}

function toMonthRows(breakdown: DayConsumption[]): LogRow[] {
  const buckets = new Map<string, number>();
  for (const d of breakdown) {
    const key = d.date.slice(0, 7); // yyyy-mm
    buckets.set(key, (buckets.get(key) ?? 0) + d.consumption);
  }
  const months = Array.from(buckets.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return months.map(([key, total], i) => {
    const prevTotal = i > 0 ? months[i - 1][1] : null;
    const variationPct = prevTotal && prevTotal !== 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    const [y, m] = key.split("-");
    return { label: `${MONTH_LABELS[Number(m) - 1]} ${y}`, consumption: total, variationPct };
  });
}

function LogTable({ rows }: { rows: LogRow[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "12px 0" }}>Sem dados suficientes ainda.</p>;
  }
  const reversed = [...rows].reverse();
  return (
    <table className="readings-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Consumo</th>
          <th>Variação</th>
        </tr>
      </thead>
      <tbody>
        {reversed.map((r, i) => (
          <tr key={i}>
            <td>
              {r.label}
              {r.sublabel && (
                <div style={{ fontSize: 10.5, color: "var(--color-text-muted)", fontFamily: "var(--font-sans)" }}>
                  {r.sublabel}
                </div>
              )}
            </td>
            <td>{fmtKwh(r.consumption)} kWh</td>
            <td>
              {r.variationPct == null ? (
                "—"
              ) : (
                <span style={{ color: r.variationPct > 0 ? "var(--color-alert)" : "var(--color-primary-dark)" }}>
                  {r.variationPct > 0 ? "↑" : "↓"} {Math.abs(Math.round(r.variationPct))}%
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HistoricoPage() {
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logView, setLogView] = useState<"dia" | "semana" | "mes">("dia");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/periods", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar histórico.");
      setPeriods(data.periods ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = periods.find((p) => p.isCurrent) ?? null;

  const dayRows = useMemo(() => (current ? toDayRows(current.summary.dailyBreakdown) : []), [current]);
  const weekRows = useMemo(() => (current ? toWeekRows(current.summary.dailyBreakdown) : []), [current]);
  const monthRows = useMemo(() => (current ? toMonthRows(current.summary.dailyBreakdown) : []), [current]);

  if (loading) {
    return (
      <div className="empty-state" role="status">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="card-label">Erro</p>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="empty-state">
        Nenhum período registrado ainda. Configure um período em Ajustes para começar.
      </div>
    );
  }

  const finished = periods.filter((p) => p.summary.hasReadings);
  const maxAccumulated = Math.max(...finished.map((p) => p.summary.accumulatedKwh), 1);

  return (
    <>
      <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HistoryIcon size={20} />
        Histórico
      </h1>

      {current && current.summary.hasReadings && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p className="card-label" style={{ margin: 0 }}>Registro de consumo</p>
            <div className="platform-tabs" style={{ margin: 0, width: "auto" }}>
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`platform-tab${logView === v ? " active" : ""}`}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  onClick={() => setLogView(v)}
                >
                  {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          </div>
          <LogTable rows={logView === "dia" ? dayRows : logView === "semana" ? weekRows : monthRows} />
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
        Compare o consumo entre os períodos que você já acompanhou.
      </p>

      {periods.map((p) => {
        const s = p.summary;
        const barWidth = s.hasReadings ? Math.max((s.accumulatedKwh / maxAccumulated) * 100, 3) : 0;
        const metGoal = p.goal_kwh != null && s.hasReadings ? !s.goalExceededNow : null;

        return (
          <div className="card" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p className="period-range" style={{ margin: 0 }}>
                {fmtDate(p.start_date)} — {fmtDate(p.end_date)}
              </p>
              {p.isCurrent && (
                <span className="status-pill status-ok" style={{ padding: "3px 10px", fontSize: 11 }}>
                  <span className="status-dot" />
                  Atual
                </span>
              )}
            </div>

            {!s.hasReadings ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 10 }}>
                Sem leituras registradas neste período.
              </p>
            ) : (
              <>
                <p className="meter-value-md" style={{ marginTop: 10 }}>
                  {fmtKwh(s.accumulatedKwh)} <span className="meter-unit">kWh</span>
                </p>
                {s.forecastCostReais != null && (
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-secondary)", margin: "2px 0 0" }}>
                    ≈ {fmtBRL(s.forecastCostReais)}
                  </p>
                )}

                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "var(--color-bg)",
                    marginTop: 8,
                    marginBottom: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${barWidth}%`,
                      background: "var(--color-secondary)",
                      borderRadius: 999,
                    }}
                  />
                </div>

                <div className="grid-2">
                  <div className="stat-block">
                    <span className="stat-block-label">Média diária</span>
                    <span className="meter-value-md" style={{ fontSize: 16 }}>
                      {fmtKwh(s.dailyAverageKwh, 2)} kWh
                    </span>
                  </div>
                  {p.goal_kwh != null && (
                    <div className="stat-block">
                      <span className="stat-block-label">Meta</span>
                      <span className="meter-value-md" style={{ fontSize: 16 }}>
                        {fmtKwh(p.goal_kwh)} kWh
                      </span>
                    </div>
                  )}
                </div>

                {(s.bestDay || s.worstDay) && (
                  <div className="grid-2" style={{ marginTop: 10 }}>
                    {s.bestDay && (
                      <div className="stat-block">
                        <span className="stat-block-label">Melhor dia</span>
                        <span style={{ fontSize: 13 }}>
                          {fmtDate(s.bestDay.date)} · {fmtKwh(s.bestDay.consumption)} kWh
                        </span>
                      </div>
                    )}
                    {s.worstDay && (
                      <div className="stat-block">
                        <span className="stat-block-label">Pior dia</span>
                        <span style={{ fontSize: 13 }}>
                          {fmtDate(s.worstDay.date)} · {fmtKwh(s.worstDay.consumption)} kWh
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {metGoal !== null && (
                  <span
                    className={`status-pill ${metGoal ? "status-ok" : "status-alert"}`}
                    style={{ marginTop: 12 }}
                  >
                    <span className="status-dot" />
                    {metGoal ? "Meta cumprida" : "Meta ultrapassada"}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
