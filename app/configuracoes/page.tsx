"use client";

import { useCallback, useEffect, useState } from "react";
import InstallGuide, { useIsInstalled } from "@/components/InstallGuide";
import ReadingsImport from "@/components/ReadingsImport";
import { SettingsIcon } from "@/components/icons";
import { APP_VERSION } from "@/lib/version";
import { FLAG_LABELS, ANEEL_FLAG_SURCHARGE_PER_100KWH, type TariffFlag } from "@/lib/tariffFlags";

type Period = {
  id: number;
  start_date: string;
  end_date: string;
  initial_kwh: number;
  goal_kwh: number | null;
  tariff_rate: number | null;
  tariff_flag: TariffFlag | null;
  flag_surcharge_rate: number | null;
  fixed_fees_reais: number | null;
};

type TariffDefaults = {
  tariff_rate: number | null;
  tariff_flag: TariffFlag | null;
  flag_surcharge_rate: number | null;
  fixed_fees_reais: number | null;
};

export default function ConfiguracoesPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [defaults, setDefaults] = useState<TariffDefaults | null>(null);
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
  const [fixedFees, setFixedFees] = useState("");

  // "Calibrar pela fatura" — lets the user re-derive tariff_rate,
  // flag_surcharge_rate and fixed_fees_reais straight from the numbers
  // printed on a real bill, instead of trusting stale defaults. The ANEEL
  // base rate for the bandeira surcharge doesn't include taxes (ICMS/PIS/
  // COFINS), while the energy rate here is already tax-inclusive — so a
  // bandeira ≠ verde period calibrated only from the ANEEL default tends to
  // under-estimate cost. Real bills are the source of truth.
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [calKwh, setCalKwh] = useState("");
  const [calEnergyReais, setCalEnergyReais] = useState("");
  const [calFlagReais, setCalFlagReais] = useState("");
  const [calOtherReais, setCalOtherReais] = useState("");

  function applyCalibration() {
    const kwh = Number(calKwh);
    if (!kwh || kwh <= 0) return;

    const energy = Number(calEnergyReais || 0);
    const flag = Number(calFlagReais || 0);
    const other = Number(calOtherReais || 0);

    setTariffRate((energy / kwh).toFixed(8));
    if (flag > 0) {
      setFlagSurcharge(((flag / kwh) * 100).toFixed(4));
    }
    setFixedFees(other.toFixed(2));
    setShowCalibrate(false);
  }

  function fillFormFrom(p: Period) {
    setStartDate(p.start_date);
    setEndDate(p.end_date);
    setInitialKwh(String(p.initial_kwh));
    setGoalKwh(p.goal_kwh != null ? String(p.goal_kwh) : "");
    setTariffRate(p.tariff_rate != null ? String(p.tariff_rate) : "");
    setTariffFlag(p.tariff_flag ?? "verde");
    setFlagSurcharge(p.flag_surcharge_rate != null ? String(p.flag_surcharge_rate) : "");
    setFixedFees(p.fixed_fees_reais != null ? String(p.fixed_fees_reais) : "");
  }

  function fillFormFromDefaults(d: TariffDefaults | null) {
    setTariffRate(d?.tariff_rate != null ? String(d.tariff_rate) : "");
    setTariffFlag(d?.tariff_flag ?? "verde");
    setFlagSurcharge(d?.flag_surcharge_rate != null ? String(d.flag_surcharge_rate) : "");
    setFixedFees(d?.fixed_fees_reais != null ? String(d.fixed_fees_reais) : "");
  }

  function dayAfter(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  const load = useCallback(async () => {
    try {
      const [periodRes, defaultsRes] = await Promise.all([
        fetch("/api/period", { cache: "no-store" }),
        fetch("/api/tariff-defaults", { cache: "no-store" }),
      ]);
      const periodData = await periodRes.json();
      if (!periodRes.ok) throw new Error(periodData.error || "Erro ao carregar período.");
      const defaultsData = await defaultsRes.json();
      if (!defaultsRes.ok) throw new Error(defaultsData.error || "Erro ao carregar padrões.");

      setDefaults(defaultsData.defaults ?? null);

      if (periodData.period) {
        setPeriod(periodData.period);
        fillFormFrom(periodData.period);
      } else {
        // No period yet — start the form from the standing tariff defaults
        // instead of blank fields.
        fillFormFromDefaults(defaultsData.defaults ?? null);
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
    } else {
      setStartDate("");
    }
    setEndDate("");
    setInitialKwh("");
    setGoalKwh("");
    // Always start a new period from the standing defaults, not from
    // whatever the previous period happened to have.
    fillFormFromDefaults(defaults);
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
          fixed_fees_reais: fixedFees ? Number(fixedFees) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar período.");
      setPeriod(data.period);
      setMode("edit");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      // Keep the standing defaults in sync with whatever tariff info was
      // just saved, so the next new period starts from these same values
      // without having to type them again. Best-effort — a failure here
      // shouldn't block the period save that already succeeded.
      if (tariffRate) {
        try {
          const defaultsRes = await fetch("/api/tariff-defaults", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tariff_rate: Number(tariffRate),
              tariff_flag: tariffFlag,
              flag_surcharge_rate: flagSurcharge ? Number(flagSurcharge) : null,
              fixed_fees_reais: fixedFees ? Number(fixedFees) : null,
            }),
          });
          const defaultsData = await defaultsRes.json();
          if (defaultsRes.ok) setDefaults(defaultsData.defaults);
        } catch {
          // Non-critical — ignore.
        }
      }
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
      <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <SettingsIcon size={20} />
        Ajustes
      </h1>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p className="card-label" style={{ marginBottom: 0 }}>
            {mode === "new" ? "Novo período" : period ? "Editar período atual" : "Configurar período"}
          </p>
          {mode === "edit" && period && (
            <a
              className="link-btn"
              href={`/api/report?period_id=${period.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver relatório
            </a>
          )}
        </div>

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
              placeholder="Ex: 1.0754"
              value={tariffRate}
              onChange={(e) => setTariffRate(e.target.value)}
            />
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "-2px 0 0" }}>
              No boleto, some os itens "Consumo-TUSD" e "Consumo-TE" (preço unitário de cada um) — o
              resultado é essa tarifa.
            </p>
          </div>

          <div className="field" style={{ marginTop: -6 }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowCalibrate((v) => !v)}
              style={{ fontSize: 13 }}
            >
              {showCalibrate ? "Fechar calibração" : "Calibrar pela última fatura"}
            </button>
          </div>

          {showCalibrate && (
            <div
              style={{
                background: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0, marginBottom: 10 }}>
                Preencha com os valores exatos do boleto e a tarifa, a bandeira e as taxas fixas são
                recalculadas automaticamente — evita ter que fazer conta de cabeça, e reduz o erro entre a
                previsão e a fatura real.
              </p>
              <div className="field">
                <label htmlFor="cal-kwh">Consumo do boleto (kWh)</label>
                <input
                  id="cal-kwh"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 92"
                  value={calKwh}
                  onChange={(e) => setCalKwh(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cal-energy">Valor de "Consumo-TUSD" + "Consumo-TE" (R$)</label>
                <input
                  id="cal-energy"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 97.03"
                  value={calEnergyReais}
                  onChange={(e) => setCalEnergyReais(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cal-flag">Valor da linha "Acrés. Bandeira" (R$) — 0 se verde</label>
                <input
                  id="cal-flag"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 2.28"
                  value={calFlagReais}
                  onChange={(e) => setCalFlagReais(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="cal-other">Soma de tudo mais (iluminação, ICMS-CDE, créditos...) (R$)</label>
                <input
                  id="cal-other"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 2.00 (pode ser negativo)"
                  value={calOtherReais}
                  onChange={(e) => setCalOtherReais(e.target.value)}
                />
                <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                  Some linhas como "Ilum. Púb. Municipal" e "ICMS-CDE", e subtraia créditos (ex: linha
                  "ITAIPU" negativa). O resultado pode ser negativo — e costuma variar de mês a mês.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={applyCalibration}>
                Calcular e preencher os campos abaixo
              </button>
            </div>
          )}

          {tariffRate && (
            <>
              <div className="field">
                <label htmlFor="flag">Bandeira tarifária</label>
                <select
                  id="flag"
                  value={tariffFlag}
                  onChange={(e) => {
                    const flag = e.target.value as TariffFlag;
                    setTariffFlag(flag);
                    // Pre-fill with ANEEL's official rate for the newly
                    // selected flag — still editable below, in case ANEEL
                    // revises it and this hasn't been updated yet.
                    setFlagSurcharge(flag === "verde" ? "" : String(ANEEL_FLAG_SURCHARGE_PER_100KWH[flag]));
                  }}
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
                    step="0.001"
                    placeholder="Ex: 1.885"
                    value={flagSurcharge}
                    onChange={(e) => setFlagSurcharge(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "-2px 0 0" }}>
                    R$ {ANEEL_FLAG_SURCHARGE_PER_100KWH[tariffFlag].toLocaleString("pt-BR", { minimumFractionDigits: 3 })}{" "}
                    a cada 100 kWh é o valor oficial da ANEEL, mas ele não inclui ICMS/PIS/COFINS — no boleto
                    real, o valor da linha "Bandeira" costuma vir mais alto. Use "Calibrar pela última fatura"
                    acima para pegar o valor exato que você está pagando.
                  </p>
                </div>
              )}

              <div className="field">
                <label htmlFor="fixed-fees">Taxas fixas do período (R$) — opcional</label>
                <input
                  id="fixed-fees"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 29.45"
                  value={fixedFees}
                  onChange={(e) => setFixedFees(e.target.value)}
                />
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "-2px 0 0" }}>
                  Itens do boleto que não variam com o consumo, como "Ilum. Púb. Municipal" e pequenas
                  taxas (ICMS-CDE, etc). Pode ser negativo se houver créditos (ex: linha "ITAIPU"). Esse
                  valor costuma variar de um boleto para outro — vale reconferir todo mês.
                </p>
              </div>
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

      {period && mode === "edit" && (
        <ReadingsImport periodId={period.id} onImported={load} />
      )}

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
          <span style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}>
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
