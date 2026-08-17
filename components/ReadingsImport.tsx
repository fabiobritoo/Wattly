"use client";

import { useState } from "react";
import { parseReadingsCsv, type ParsedReading } from "@/lib/csv";

export default function ReadingsImport({
  periodId,
  onImported,
}: {
  periodId: number;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReading[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { readings, errors } = parseReadingsCsv(text);
      setParsed(readings);
      setParseErrors(errors);
    };
    reader.onerror = () => setError("Não foi possível ler o arquivo.");
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (parsed.length === 0) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/readings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: periodId, replace: replaceExisting, readings: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar leituras.");
      setResult(`${data.inserted} leituras importadas${data.replaced ? " (leituras anteriores foram substituídas)" : ""}.`);
      setParsed([]);
      setFileName(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setImporting(false);
    }
  }

  const first = parsed[0];
  const last = parsed[parsed.length - 1];

  return (
    <div className="card">
      <p className="card-label" style={{ marginBottom: 8 }}>
        Importar leituras (CSV)
      </p>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
        Colunas esperadas: Data (DD/MM/AAAA), Hora (HH:MM, opcional) e uma coluna de leitura em kWh.
        Colunas de consumo/delta são ignoradas — o app recalcula isso sozinho.
      </p>

      <div className="field">
        <label htmlFor="csv-file">Arquivo CSV</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} />
      </div>

      {fileName && parseErrors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {parseErrors.slice(0, 5).map((e, i) => (
            <p key={i} className="error-text" style={{ marginTop: 2 }}>
              {e}
            </p>
          ))}
          {parseErrors.length > 5 && (
            <p className="error-text" style={{ marginTop: 2 }}>
              ...e mais {parseErrors.length - 5} linha(s) com problema.
            </p>
          )}
        </div>
      )}

      {parsed.length > 0 && (
        <>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            {parsed.length} leituras reconhecidas — de{" "}
            <strong>{new Date(first.reading_at).toLocaleString("pt-BR")}</strong> até{" "}
            <strong>{new Date(last.reading_at).toLocaleString("pt-BR")}</strong>.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Substituir leituras já existentes deste período
          </label>

          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? "Importando..." : `Importar ${parsed.length} leituras`}
          </button>
        </>
      )}

      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      {result && (
        <p style={{ color: "var(--color-primary-dark)", fontSize: 13, marginTop: 10 }}>{result}</p>
      )}
    </div>
  );
}
