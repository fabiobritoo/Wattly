"use client";

import { useCallback, useEffect, useState } from "react";
import { NotesIcon } from "@/components/icons";
import NoteForm from "@/components/NoteForm";

type Note = { id: number; date: string; text: string };
type Period = { id: number; start_date: string; end_date: string };

const MONTH_ABBR = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const BADGE_COLORS = ["var(--color-primary)", "var(--color-secondary)"];

function badgeParts(iso: string) {
  const [, m, d] = iso.split("-");
  return { day: d, month: MONTH_ABBR[Number(m) - 1] };
}

export default function AnotacoesPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const load = useCallback(async () => {
    try {
      const periodRes = await fetch("/api/period", { cache: "no-store" });
      const periodData = await periodRes.json();
      if (!periodRes.ok) throw new Error(periodData.error || "Erro ao carregar período.");
      setPeriod(periodData.period);

      if (periodData.period) {
        const notesRes = await fetch(`/api/notes?period_id=${periodData.period.id}`, {
          cache: "no-store",
        });
        const notesData = await notesRes.json();
        if (!notesRes.ok) throw new Error(notesData.error || "Erro ao carregar anotações.");
        setNotes(notesData.notes ?? []);
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

  if (loading) {
    return (
      <div className="empty-state" role="status">
        Carregando...
      </div>
    );
  }

  if (!period) {
    return (
      <div className="empty-state">
        Configure um período em Ajustes antes de adicionar anotações.
      </div>
    );
  }

  return (
    <>
      <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NotesIcon size={20} />
        Anotações
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0, marginBottom: 16 }}>
        Uma linha do tempo de eventos que podem explicar picos ou quedas no consumo.
      </p>

      {error && (
        <div className="card">
          <p className="error-text">{error}</p>
        </div>
      )}

      <div className="card">
        {notes.length === 0 ? (
          <p className="empty-state" style={{ padding: "20px 0" }}>
            Nenhuma anotação ainda.
          </p>
        ) : (
          <div className="notes-timeline">
            {notes.map((note, i) => {
              const { day, month } = badgeParts(note.date);
              const color = BADGE_COLORS[i % BADGE_COLORS.length];
              const isLast = i === notes.length - 1;
              return (
                <div className="notes-timeline-item" key={note.id} onClick={() => setEditingNote(note)}>
                  <div className="notes-badge-col">
                    <div className="notes-badge" style={{ background: color }}>
                      {day}
                      <span>{month}</span>
                    </div>
                    {!isLast && <div className="notes-connector" />}
                  </div>
                  <div className="notes-content">
                    <span className="notes-dot" style={{ background: color }} />
                    <p>{note.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={() => setShowForm(true)}>
        + Nova anotação
      </button>

      {showForm && (
        <NoteForm periodId={period.id} onClose={() => setShowForm(false)} onSaved={load} />
      )}

      {editingNote && (
        <NoteForm
          periodId={period.id}
          editingNote={editingNote}
          onClose={() => setEditingNote(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
