"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReadingForm from "@/components/ReadingForm";
import { AddIcon } from "@/components/icons";

type PeriodInfo = { id: number; initial_kwh: number } | null;

export default function GlobalAddReadingFab() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodInfo>(null);
  const [lastKwh, setLastKwh] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function refreshPeriodInfo() {
    try {
      const res = await fetch("/api/summary", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      if (data.period) {
        setPeriod({ id: data.period.id, initial_kwh: data.period.initial_kwh });
        setLastKwh(data.summary?.hasReadings ? data.period.initial_kwh + data.summary.accumulatedKwh : null);
      } else {
        setPeriod(null);
        setLastKwh(null);
      }
    } catch {
      // Silent — the FAB just won't open a working form until this
      // resolves; not worth surfacing an error for a background fetch.
    } finally {
      setChecked(true);
    }
  }

  useEffect(() => {
    refreshPeriodInfo();
  }, []);

  function handleClick() {
    if (!checked) return;
    if (!period) {
      router.push("/configuracoes");
      return;
    }
    setShowForm(true);
  }

  return (
    <>
      <button
        type="button"
        className="fab-add"
        onClick={handleClick}
        aria-label="Registrar leitura"
        title="Registrar leitura"
      >
        <AddIcon size={26} />
      </button>

      {showForm && period && (
        <ReadingForm
          periodId={period.id}
          lastKwh={lastKwh}
          onClose={() => setShowForm(false)}
          onSaved={refreshPeriodInfo}
        />
      )}
    </>
  );
}
