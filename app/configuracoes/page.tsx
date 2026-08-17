"use client";

import { useCallback, useEffect, useState } from "react";
import InstallGuide, { useIsInstalled } from "@/components/InstallGuide";
import { APP_VERSION } from "@/lib/version";

type Period = {
  id: number;
  start_date: string;
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
};

export default function ConfiguracoesPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const installed = useIsInstalled();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialKwh, setInitialKwh] = useState("");
  const [goalKwh, setGoalKwh] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/period", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar período.");
      if (data.period) {
        setPeriod(data.period);
        setStartDate(data.period.start_date);
        setEndDate(data.period.end_date);
        setInitialKwh(String(data.period.initial_kwh));
        setGoalKwh(data.period.goal_kwh != null ? String(data.period.goal_kwh) : "");
      }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: period?.id,
          start_date: startDate,
          end_date: endDate,
          initial_kwh: Number(initialKwh),
          goal_kwh: goalKwh ? Number(goalKwh) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar período.");
      setPeriod(data.period);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" role="status">
        Carregando...
      </div>
    );
  }

  return (
    <>
      <h1 className="section-title">Ajustes</h1>

      <div className="card">
        <p className="card-label" style={{ marginBottom: 12 }}>
          {period ? "Editar período" : "Configurar período"}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="start">Data de início</label>
            <input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="end">Data de fim</label>
            <input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="initial">Leitura inicial do medidor (kWh)</label>
            <input
              id="initial"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Valor do medidor no 1º dia do período"
              value={initialKwh}
              onChange={(e) => setInitialKwh(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="goal">Meta de consumo para o período (kWh) — opcional</label>
            <input
              id="goal"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Ex: 230"
              value={goalKwh}
              onChange={(e) => setGoalKwh(e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {saved && (
            <p style={{ color: "var(--color-primary-dark)", fontSize: 13, marginTop: -6, marginBottom: 12 }}>
              Salvo com sucesso.
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar período"}
          </button>
        </form>
      </div>

      {!installed && (
        <div className="card">
          <p className="card-label" style={{ marginBottom: 8 }}>
            Instalação
          </p>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Instale o Wattly na tela inicial do seu celular para acessar como um aplicativo.
          </p>
          <button className="btn btn-secondary" onClick={() => setShowInstall(true)}>
            Como instalar?
          </button>
        </div>
      )}

      <div className="card">
        <p className="card-label">Sobre</p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wattly — Entenda seu consumo.
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-meter)" }}>
          Versão {APP_VERSION}
        </p>
      </div>

      <InstallGuide open={showInstall} onClose={() => setShowInstall(false)} />
    </>
  );
}
