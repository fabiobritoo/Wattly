"use client";

import { useState } from "react";

function nowLocalDateTimeInputValue() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  // datetime-local input wants "YYYY-MM-DDTHH:mm" in local time, no timezone.
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function ReadingForm({
  periodId,
  onClose,
  onSaved,
}: {
  periodId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dateTime, setDateTime] = useState(nowLocalDateTimeInputValue());
  const [kwh, setKwh] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!kwh) {
      setError("Informe o valor do medidor.");
      return;
    }

    setSaving(true);
    try {
      // dateTime is a local wall-clock string ("YYYY-MM-DDTHH:mm") from the
      // datetime-local input; convert to a real Date (interpreted in the
      // browser's local timezone) and send as ISO/UTC to the API.
      const readingAt = new Date(dateTime).toISOString();

      const readingRes = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: periodId, reading_at: readingAt, kwh_reading: Number(kwh) }),
      });
      const readingData = await readingRes.json();
      if (!readingRes.ok) throw new Error(readingData.error || "Erro ao salvar leitura.");

      if (note.trim()) {
        const noteRes = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period_id: periodId, date: readingAt.slice(0, 10), text: note.trim() }),
        });
        const noteData = await noteRes.json();
        if (!noteRes.ok) throw new Error(noteData.error || "Erro ao salvar anotação.");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="section-title" style={{ marginBottom: 14 }}>
          Registrar leitura
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="datetime">Data e hora</label>
            <input
              id="datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="kwh">Leitura atual do medidor (kWh)</label>
            <input
              id="kwh"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Ex: 1847.3"
              value={kwh}
              onChange={(e) => setKwh(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="note">Anotação (opcional)</label>
            <textarea
              id="note"
              rows={2}
              placeholder="Ex: Ar-condicionado ligado à tarde"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar leitura"}
          </button>
        </form>
      </div>
    </div>
  );
}
