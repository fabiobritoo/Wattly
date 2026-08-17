"use client";

import { useState } from "react";
import { CalendarIcon, ConsumptionIcon, NotesIcon } from "@/components/icons";
import { broadcastDataChanged } from "@/lib/events";

const NOTE_MAX_LENGTH = 120;

type ExistingReading = { id: number; reading_at: string; kwh_reading: number };

function nowLocalDateTimeInputValue() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  // datetime-local input wants "YYYY-MM-DDTHH:mm" in local time, no timezone.
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toLocalDateTimeInputValue(iso: string) {
  const d = new Date(iso);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function ReadingForm({
  periodId,
  lastKwh,
  editingReading,
  onClose,
  onSaved,
}: {
  periodId: number;
  lastKwh: number | null;
  editingReading?: ExistingReading | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editingReading);
  const [dateTime, setDateTime] = useState(
    editingReading ? toLocalDateTimeInputValue(editingReading.reading_at) : nowLocalDateTimeInputValue()
  );
  const [kwh, setKwh] = useState(editingReading ? String(editingReading.kwh_reading) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kwhValue = kwh ? Number(kwh) : null;
  const delta = lastKwh != null && kwhValue != null && !Number.isNaN(kwhValue) ? kwhValue - lastKwh : null;

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

      if (isEditing && editingReading) {
        const res = await fetch(`/api/readings/${editingReading.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reading_at: readingAt, kwh_reading: Number(kwh) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao salvar leitura.");
      } else {
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
      }

      broadcastDataChanged();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingReading) return;
    if (!confirm("Excluir esta leitura? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/readings/${editingReading.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir leitura.");
      broadcastDataChanged();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="section-title" style={{ marginBottom: 14 }}>
          {isEditing ? "Editar leitura" : "Registrar leitura"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="datetime" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarIcon size={14} />
              Data e hora
            </label>
            <input
              id="datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="kwh" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ConsumptionIcon size={14} />
              Leitura atual do medidor (kWh)
            </label>
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
            {delta != null && !Number.isNaN(delta) && (
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: delta >= 0 ? "var(--color-primary-dark)" : "var(--color-alert)",
                  margin: "2px 0 0",
                }}
              >
                Consumo desde a última leitura: {delta.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh
                {delta < 0 && " (menor que a leitura anterior — confira o valor)"}
              </p>
            )}
          </div>

          {!isEditing && (
            <div className="field">
              <label htmlFor="note" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <NotesIcon size={14} />
                Observação (opcional)
              </label>
              <textarea
                id="note"
                rows={2}
                placeholder="Ex: Ar-condicionado ligado à tarde"
                value={note}
                maxLength={NOTE_MAX_LENGTH}
                onChange={(e) => setNote(e.target.value)}
              />
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "right", margin: "-2px 0 0" }}>
                {note.length}/{NOTE_MAX_LENGTH}
              </p>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving || deleting}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Salvar leitura"}
            </button>
            {isEditing && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                style={{ color: "var(--color-alert)" }}
              >
                {deleting ? "Excluindo..." : "Excluir leitura"}
              </button>
            )}
          </div>

          {!isEditing && (
            <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", marginTop: 12 }}>
              🔒 Seus dados são privados e protegidos.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
