"use client";

import { useCallback, useEffect, useState } from "react";

type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number;
  dailyAverageKwh: number | null;
  forecastFinalKwh: number | null;
  goalExceededNow: boolean;
  bestDay: { date: string; consumption: number } | null;
  worstDay: { date: string; consumption: number } | null;
  forecastCostReais: number | null;
};

function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type PeriodEntry = {
  id: number;
  start_date: string;
  end_date: string;
  goal_kwh: number | null;
  isCurrent: boolean;
  summary: Summary;
};

function fmtKwh(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default function HistoricoPage() {
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <h1 className="section-title">Histórico</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
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
