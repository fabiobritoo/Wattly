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
type Reading = { id: number; date: string; kwh_reading: number };
type Note = { id: number; date: string; text: string };
type Summary = {
  hasReadings: boolean;
  accumulatedKwh: number;
  todayVariationKwh: number | null;
  dailyAverageKwh: number | null;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  forecastFinalKwh: number | null;
  forecastRemainingKwh: number | null;
  status: "sem_dados" | "dentro_do_esperado" | "acima_da_media" | "acima_da_meta";
  lastReadingDate: string | null;
};

function fmtKwh(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

const statusLabels: Record<Summary["status"], { label: string; className: string }> = {
  sem_dados: { label: "Sem dados ainda", className: "status-ok" },
  dentro_do_esperado: { label: "Dentro do esperado", className: "status-ok" },
  acima_da_media: { label: "Acima da média", className: "status-warn" },
  acima_da_meta: { label: "Acima da meta", className: "status-alert" },
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [lastNote, setLastNote] = useState<Note | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
        {s.todayVariationKwh !== null && (
          <span className="variation-up">↑ {fmtKwh(s.todayVariationKwh)} kWh hoje</span>
        )}

        {!s.hasReadings && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Registre a primeira leitura para começar a ver a evolução.
          </p>
        )}
      </div>

      {s.hasReadings && (
        <div className="card">
          <p className="card-label" style={{ marginBottom: 8 }}>
            Evolução
          </p>
          <EvolutionChart
            startDate={period.start_date}
            endDate={period.end_date}
            initialKwh={period.initial_kwh}
            readings={readings}
            forecastFinalKwh={s.forecastFinalKwh}
          />
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
            <span>
              <span style={{ color: "#2563EB" }}>●</span> Consumo real
            </span>
            <span>
              <span style={{ color: "#FACC15" }}>●</span> Previsão
            </span>
          </div>
        </div>
      )}

      {s.hasReadings && (
        <div className="card">
          <p className="card-label">Previsão</p>
          <p className="meter-value">
            {fmtKwh(s.forecastFinalKwh)}
            <span className="meter-unit">kWh</span>
          </p>
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
        Registrar leitura de hoje
      </button>

      {showForm && (
        <ReadingForm periodId={period.id} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </>
  );
}
