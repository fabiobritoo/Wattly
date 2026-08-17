"use client";

import { useState } from "react";
import { CalendarIcon, NotesIcon } from "@/components/icons";
import { broadcastDataChanged } from "@/lib/events";

const NOTE_MAX_LENGTH = 120;

type ExistingNote = { id: number; date: string; text: string };

function todayIso() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export default function NoteForm({
  periodId,
  editingNote,
  onClose,
  onSaved,
}: {
  periodId: number;
  editingNote?: ExistingNote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editingNote);
  const [date, setDate] = useState(editingNote?.date ?? todayIso());
  const [text, setText] = useState(editingNote?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Escreva uma anotação.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEditing && editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, text: text.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao salvar anotação.");
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period_id: periodId, date, text: text.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao salvar anotação.");
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
    if (!editingNote) return;
    if (!confirm("Excluir esta anotação? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${editingNote.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir anotação.");
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
          {isEditing ? "Editar anotação" : "Nova anotação"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="note-date" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarIcon size={14} />
              Data
            </label>
            <input id="note-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="note-text" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NotesIcon size={14} />
              Anotação
            </label>
            <textarea
              id="note-text"
              rows={3}
              placeholder="Ex: Recebemos visitas"
              value={text}
              maxLength={NOTE_MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "right", margin: "-2px 0 0" }}>
              {text.length}/{NOTE_MAX_LENGTH}
            </p>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving || deleting}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Adicionar anotação"}
            </button>
            {isEditing && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                style={{ color: "var(--color-alert)" }}
              >
                {deleting ? "Excluindo..." : "Excluir anotação"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
