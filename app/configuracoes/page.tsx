"use client";

import { useCallback, useEffect, useState } from "react";
import InstallGuide, { useIsInstalled } from "@/components/InstallGuide";
import { APP_VERSION } from "@/lib/version";

type TariffFlag = "verde" | "amarela" | "vermelha_1" | "vermelha_2";

type Period = {
  id: number;
  start_date: string;
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
  tariff_rate: number | null;
  tariff_flag: TariffFlag | null;
  flag_surcharge_rate: number | null;
};

const FLAG_LABELS: Record<TariffFlag, string> = {
  verde: "Verde (sem custo extra)",
  amarela: "Amarela",
  vermelha_1: "Vermelha — patamar 1",
  vermelha_2: "Vermelha — patamar 2",
};

export default function ConfiguracoesPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const installed = useIsInstalled();
  const [mode, setMode] = useState<"edit" | "new">("edit");

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    { kind: "idle" } | { kind: "current" } | { kind: "outdated"; serverVersion: string } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [forcingUpdate, setForcingUpdate] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialKwh, setInitialKwh] = useState("");
  const [goalKwh, setGoalKwh] = useState("");
  const [tariffRate, setTariffRate] = useState("");
  const [tariffFlag, setTariffFlag] = useState<TariffFlag>("verde");
  const [flagSurcharge, setFlagSurcharge] = useState("");

  function fillFormFrom(p: Period) {
    setStartDate(p.start_date);
    setEndDate(p.end_date);
    setInitialKwh(String(p.initial_kwh));
    setGoalKwh(p.goal_kwh != null ? String(p.goal_kwh) : "");
    setTariffRate(p.tariff_rate != null ? String(p.tariff_rate) : "");
    setTariffFlag(p.tariff_flag ?? "verde");
    setFlagSurcharge(p.flag_surcharge_rate != null ? String(p.flag_surcharge_rate) : "");
  }

  function dayAfter(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/period", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar período.");
      if (data.period) {
        setPeriod(data.period);
        fillFormFrom(data.period);
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

  function startNewPeriod() {
    setMode("new");
    setSaved(false);
    setError(null);
    if (period) {
      setStartDate(dayAfter(period.end_date));
      // Tariff rate tends to stay similar across periods, so carry it over
      // as a starting point — but not the flag/surcharge, since the
      // "bandeira tarifária" changes monthly and shouldn't be assumed.
      setTariffRate(period.tariff_rate != null ? String(period.tariff_rate) : "");
    } else {
      setStartDate("");
      setTariffRate("");
    }
    setEndDate("");
    setInitialKwh("");
    setGoalKwh("");
    setTariffFlag("verde");
    setFlagSurcharge("");
  }

  function cancelNewPeriod() {
    setMode("edit");
    setError(null);
    if (period) fillFormFrom(period);
  }

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
          id: mode === "edit" ? period?.id : undefined,
          start_date: startDate,
          end_date: endDate,
          initial_kwh: Number(initialKwh),
          goal_kwh: goalKwh ? Number(goalKwh) : null,
          tariff_rate: tariffRate ? Number(tariffRate) : null,
          tariff_flag: tariffFlag,
          flag_surcharge_rate: flagSurcharge ? Number(flagSurcharge) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar período.");
      setPeriod(data.period);
      setMode("edit");
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
          {mode === "new" ? "Novo período" : period ? "Editar período atual" : "Configurar período"}
        </p>

        {mode === "new" && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
            O período atual será arquivado e continua disponível na aba Histórico para comparação.
          </p>
        )}

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

          <div className="field">
            <label htmlFor="tariff">Tarifa de energia (R$/kWh) — opcional</label>
            <input
              id="tariff"
              type="number"
              inputMode="decimal"
              step="0.0001"
              placeholder="Ex: 0.85 — veja no seu último boleto"
              value={tariffRate}
              onChange={(e) => setTariffRate(e.target.value)}
            />
          </div>

          {tariffRate && (
            <>
              <div className="field">
                <label htmlFor="flag">Bandeira tarifária</label>
                <select
                  id="flag"
                  value={tariffFlag}
                  onChange={(e) => setTariffFlag(e.target.value as TariffFlag)}
                >
                  {(Object.keys(FLAG_LABELS) as TariffFlag[]).map((flag) => (
                    <option key={flag} value={flag}>
                      {FLAG_LABELS[flag]}
                    </option>
                  ))}
                </select>
              </div>

              {tariffFlag !== "verde" && (
                <div className="field">
                  <label htmlFor="flag-surcharge">Valor adicional da bandeira (R$ a cada 100 kWh)</label>
                  <input
                    id="flag-surcharge"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="Confira no site da sua distribuidora ou no boleto"
                    value={flagSurcharge}
                    onChange={(e) => setFlagSurcharge(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="error-text">{error}</p>}
          {saved && (
            <p style={{ color: "var(--color-primary-dark)", fontSize: 13, marginTop: -6, marginBottom: 12 }}>
              Salvo com sucesso.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving
                ? "Salvando..."
                : mode === "new"
                ? "Arquivar atual e começar novo período"
                : "Salvar período"}
            </button>
            {mode === "new" ? (
              <button className="btn btn-secondary" type="button" onClick={cancelNewPeriod}>
                Cancelar
              </button>
            ) : (
              period && (
                <button className="btn btn-secondary" type="button" onClick={startNewPeriod}>
                  Iniciar novo período
                </button>
              )
            )}
          </div>
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
