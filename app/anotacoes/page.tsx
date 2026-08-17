"use client";

import { useCallback, useEffect, useState } from "react";
import { NotesIcon } from "@/components/icons";

type Note = { id: number; date: string; text: string };
type Period = { id: number; start_date: string; end_date: string };

function todayIso() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function AnotacoesPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayIso());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!period || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: period.id, date, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar anotação.");
      setText("");
      await load();
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
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
        Uma linha do tempo de eventos que podem explicar picos ou quedas no consumo.
      </p>

      <div className="card">
        <form onSubmit={handleAdd}>
          <div className="field">
            <label htmlFor="note-date">Data</label>
            <input
              id="note-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="note-text">Anotação</label>
            <textarea
              id="note-text"
              rows={2}
              placeholder="Ex: Recebemos visitas"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar anotação"}
          </button>
        </form>
      </div>

      <div className="card">
        {notes.length === 0 ? (
          <p className="empty-state" style={{ padding: "20px 0" }}>
            Nenhuma anotação ainda.
          </p>
        ) : (
          notes.map((note) => (
            <div className="timeline-item" key={note.id}>
              <span className="timeline-date">{fmtDate(note.date)}</span>
              <span>{note.text}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
