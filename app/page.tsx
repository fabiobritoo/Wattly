"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EvolutionChart from "@/components/EvolutionChart";
import ReadingForm from "@/components/ReadingForm";

type Period = {
  id: number;
  start_date: string;
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
};
type Reading = { id: number; reading_at: string; kwh_reading: number };
type Note = { id: number; date: string; text: string };
type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number;
  todayVariationKwh: number | null;
  dailyAverageKwh: number | null;
  weeklyAverageKwh: number | null;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  forecastFinalKwh: number | null;
  forecastRemainingKwh: number | null;
  status: "sem_dados" | "dentro_do_esperado" | "acima_da_media" | "acima_da_meta";
  lastReadingAt: string | null;
  goalExceededNow: boolean;
  bestDay: { date: string; consumption: number } | null;
  worstDay: { date: string; consumption: number } | null;
  alertLevel: "none" | "warning" | "danger";
  alertMessage: string | null;
  currentCostReais: number | null;
  forecastCostReais: number | null;
};

function fmtKwh(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

const statusLabels: Record<Summary["status"], { label: string; className: string }> = {
  sem_dados: { label: "Sem dados ainda", className: "status-ok" },
  dentro_do_esperado: { label: "Dentro do esperado", className: "status-ok" },
  acima_da_media: { label: "Acima da média", className: "status-warn" },
  acima_da_meta: { label: "Acima da meta", className: "status-alert" },
};

function ReadingsTable({ readings }: { readings: Reading[] }) {
  const sorted = [...readings].sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1));
  const enriched = sorted.map((r, i) => ({
    ...r,
    delta: i > 0 ? r.kwh_reading - sorted[i - 1].kwh_reading : null,
  }));
  const lastFive = enriched.slice(-5).reverse();

  if (lastFive.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Nenhuma leitura ainda.</p>;
  }

  return (
    <table className="readings-table">
      <thead>
        <tr>
          <th>Data / hora</th>
          <th>Leitura</th>
          <th>Variação</th>
        </tr>
      </thead>
      <tbody>
        {lastFive.map((r) => (
          <tr key={r.id}>
            <td>{fmtDateTime(r.reading_at)}</td>
            <td>{fmtKwh(r.kwh_reading, 1)} kWh</td>
            <td>{r.delta !== null ? `+${fmtKwh(r.delta, 1)} kWh` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [lastNote, setLastNote] = useState<Note | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [evolutionView, setEvolutionView] = useState<"chart" | "table">("chart");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/summary", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar dados.");
      setPeriod(data.period);
      setReadings(data.readings ?? []);
      setLastNote(data.lastNote ?? null);
      setSummary(data.summary);
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
        <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={load}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 16, color: "var(--color-text)", fontWeight: 600, marginBottom: 8 }}>
          Nenhum período configurado ainda
        </p>
        <p style={{ marginBottom: 20 }}>
          Defina a data de início, fim e a leitura inicial do medidor para começar a acompanhar seu
          consumo.
        </p>
        <Link href="/configuracoes" className="btn btn-primary" style={{ display: "inline-block" }}>
          Configurar período
        </Link>
      </div>
    );
  }

  const s = summary!;
  const statusInfo = statusLabels[s.status];

  return (
    <>
      {s.alertLevel !== "none" && s.alertMessage && (
        <div
          className={`card ${s.alertLevel === "danger" ? "status-alert" : "status-warn"}`}
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            boxShadow: "none",
          }}
        >
          <span className="status-dot" style={{ marginTop: 5, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{s.alertMessage}</p>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <p className="period-range">
            {fmtDate(period.start_date)} — {fmtDate(period.end_date)}
          </p>
          <Link href="/configuracoes" className="link-btn">
            Editar
          </Link>
        </div>

        <p className="card-label" style={{ marginTop: 10 }}>
          Consumo atual
        </p>
        <p className="meter-value">
          {fmtKwh(s.accumulatedKwh)}
          <span className="meter-unit">kWh</span>
        </p>
        {s.currentCostReais != null && (
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-secondary)", margin: "2px 0 0" }}>
            ≈ {fmtBRL(s.currentCostReais)}{" "}
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}>
              (só energia, sem taxas fixas)
            </span>
          </p>
        )}
        {s.todayVariationKwh !== null && (
          <span className="variation-up">↑ {fmtKwh(s.todayVariationKwh)} kWh desde a última leitura</span>
        )}
        {s.lastReadingAt && (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
            Última leitura: {fmtDateTime(s.lastReadingAt)}
          </p>
        )}

        {!s.hasReadings && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Registre a primeira leitura para começar a ver a evolução.
          </p>
        )}
      </div>

      {s.hasReadings && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p className="card-label" style={{ margin: 0 }}>
              Evolução
            </p>
            <div className="platform-tabs" style={{ margin: 0, width: "auto" }}>
              <button
                type="button"
                className={`platform-tab${evolutionView === "chart" ? " active" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setEvolutionView("chart")}
              >
                Gráfico
              </button>
              <button
                type="button"
                className={`platform-tab${evolutionView === "table" ? " active" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setEvolutionView("table")}
              >
                Tabela
              </button>
            </div>
          </div>

          {evolutionView === "chart" ? (
            <EvolutionChart
              startDate={period.start_date}
              endDate={period.end_date}
              initialKwh={period.initial_kwh}
              readings={readings}
              forecastFinalKwh={s.forecastFinalKwh}
            />
          ) : (
            <ReadingsTable readings={readings} />
          )}
        </div>
      )}

      {s.hasReadings && (
        <div className="card">
          <p className="card-label">Previsão</p>
          <p className="meter-value">
            {fmtKwh(s.forecastFinalKwh)}
            <span className="meter-unit">kWh</span>
          </p>
          {s.forecastCostReais != null && (
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-secondary)", margin: "2px 0 0" }}>
              ≈ {fmtBRL(s.forecastCostReais)}{" "}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}>
                (conta estimada)
              </span>
            </p>
          )}
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="stat-block">
              <span className="stat-block-label">Média diária</span>
              <span className="meter-value-md">{fmtKwh(s.dailyAverageKwh, 2)} kWh</span>
            </div>
            <div className="stat-block">
              <span className="stat-block-label">Restante</span>
              <span className="meter-value-md">{s.daysRemaining} dias</span>
            </div>
          </div>

          {period.goal_kwh != null && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 10 }}>
              Meta do período: {fmtKwh(period.goal_kwh)} kWh
            </p>
          )}

          <span className={`status-pill ${statusInfo.className}`} style={{ marginTop: 12 }}>
            <span className="status-dot" />
            {statusInfo.label}
          </span>
        </div>
      )}

      {s.hasReadings && (s.bestDay || s.worstDay || s.weeklyAverageKwh != null) && (
        <div className="card">
          <p className="card-label">Ritmo de consumo</p>

          {s.weeklyAverageKwh != null && (
            <div style={{ marginTop: 10 }}>
              <span className="stat-block-label">Média semanal</span>
              <p className="meter-value-md" style={{ marginTop: 2 }}>
                {fmtKwh(s.weeklyAverageKwh)} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>kWh/semana</span>
              </p>
            </div>
          )}

          {(s.bestDay || s.worstDay) && (
            <div className="grid-2" style={{ marginTop: 14 }}>
              {s.bestDay && (
                <div className="stat-block">
                  <span className="stat-block-label">Melhor dia</span>
                  <span className="meter-value-md" style={{ fontSize: 16 }}>
                    {fmtKwh(s.bestDay.consumption)} kWh
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{fmtDate(s.bestDay.date)}</span>
                </div>
              )}
              {s.worstDay && (
                <div className="stat-block">
                  <span className="stat-block-label">Pior dia</span>
                  <span className="meter-value-md" style={{ fontSize: 16 }}>
                    {fmtKwh(s.worstDay.consumption)} kWh
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{fmtDate(s.worstDay.date)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lastNote && (
        <div className="card">
          <p className="card-label">Última anotação</p>
          <div className="note-box">
            <p className="note-date">{fmtDate(lastNote.date)}</p>
            <p style={{ margin: 0 }}>{lastNote.text}</p>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => setShowForm(true)}>
        Registrar leitura
      </button>

      {showForm && (
        <ReadingForm periodId={period.id} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </>
  );
}
