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

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    { kind: "idle" } | { kind: "current" } | { kind: "outdated"; serverVersion: string } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [forcingUpdate, setForcingUpdate] = useState(false);

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

  async function handleCheckForUpdate() {
    setCheckingUpdate(true);
    setUpdateStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao verificar versão.");
      if (data.version === APP_VERSION) {
        setUpdateStatus({ kind: "current" });
      } else {
        setUpdateStatus({ kind: "outdated", serverVersion: data.version });
      }
    } catch (err) {
      setUpdateStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleForceUpdate() {
    setForcingUpdate(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      // Reload regardless of whether SW/cache cleanup succeeded, so the
      // user always ends up on whatever the server has right now.
      window.location.reload();
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
        <p className="card-label" style={{ marginBottom: 8 }}>
          Atualizações
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          Versão instalada neste dispositivo:{" "}
          <span style={{ fontFamily: "var(--font-meter)", color: "var(--color-text)" }}>
            v{APP_VERSION}
          </span>
        </p>

        {updateStatus.kind === "current" && (
          <p style={{ fontSize: 13, color: "var(--color-primary-dark)", marginBottom: 12 }}>
            Você já está na versão mais recente.
          </p>
        )}
        {updateStatus.kind === "outdated" && (
          <p style={{ fontSize: 13, color: "var(--color-alert)", marginBottom: 12 }}>
            Nova versão disponível no servidor: v{updateStatus.serverVersion}. Toque em "Forçar
            atualização" para carregar a versão mais recente.
          </p>
        )}
        {updateStatus.kind === "error" && (
          <p className="error-text" style={{ marginBottom: 12 }}>
            {updateStatus.message}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleCheckForUpdate} disabled={checkingUpdate}>
            {checkingUpdate ? "Verificando..." : "Verificar atualização"}
          </button>
          <button className="btn btn-primary" onClick={handleForceUpdate} disabled={forcingUpdate}>
            {forcingUpdate ? "Atualizando..." : "Forçar atualização"}
          </button>
        </div>
      </div>

      <div className="card">
        <p className="card-label">Sobre</p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wattly — Entenda seu consumo.
        </p>
      </div>

      <InstallGuide open={showInstall} onClose={() => setShowInstall(false)} />
    </>
  );
}
