"use client";

type Reading = { id: number; reading_at: string; kwh_reading: number };

function fmtKwh(v: number, decimals = 1) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

export default function AllReadingsModal({
  readings,
  onEdit,
  onClose,
}: {
  readings: Reading[];
  onEdit: (r: Reading) => void;
  onClose: () => void;
}) {
  const sorted = [...readings].sort((a, b) => (a.reading_at < b.reading_at ? -1 : 1));
  const enriched = sorted.map((r, i) => ({
    ...r,
    delta: i > 0 ? r.kwh_reading - sorted[i - 1].kwh_reading : null,
  }));
  const reversed = [...enriched].reverse();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="section-title" style={{ marginBottom: 4 }}>
          Todas as leituras
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0, marginBottom: 12 }}>
          {reversed.length} leituras neste período. Toque em uma para editar ou excluir.
        </p>

        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          <table className="readings-table">
            <thead>
              <tr>
                <th>Data / hora</th>
                <th>Leitura</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {reversed.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    onEdit(r);
                    onClose();
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td>{fmtDateTime(r.reading_at)}</td>
                  <td>{fmtKwh(r.kwh_reading)} kWh</td>
                  <td>{r.delta !== null ? `+${fmtKwh(r.delta)} kWh` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
