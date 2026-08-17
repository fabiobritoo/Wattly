export type ParsedReading = { reading_at: string; kwh_reading: number };

export type CsvParseResult = {
  readings: ParsedReading[];
  errors: string[];
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // strip accents
}

/**
 * Parses a CSV with flexible headers into {reading_at, kwh_reading} pairs.
 * Expects columns roughly like "Data" (DD/MM/YYYY), "Hora" (HH:MM, optional
 * — defaults to 00:00), and a meter-reading column containing "kwh" that
 * isn't the "consumo desde leitura anterior" delta column (that one is
 * ignored — the app recomputes deltas itself from consecutive readings).
 */
export function parseReadingsCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { readings: [], errors: ["O arquivo precisa de um cabeçalho e pelo menos uma linha de dados."] };
  }

  const headers = lines[0].split(",").map(normalize);
  const dateIdx = headers.findIndex((h) => h.includes("data"));
  const timeIdx = headers.findIndex((h) => h.includes("hora"));

  // Prefer a "leitura ... kwh" style column over any "consumo" delta column.
  let kwhIdx = headers.findIndex((h) => h.includes("leitura") && h.includes("kwh"));
  if (kwhIdx === -1) {
    kwhIdx = headers.findIndex((h) => h.includes("kwh") && !h.includes("consumo"));
  }
  if (kwhIdx === -1) {
    kwhIdx = headers.findIndex((h) => h.includes("kwh"));
  }

  if (dateIdx === -1 || kwhIdx === -1) {
    return {
      readings: [],
      errors: [
        'Não consegui identificar as colunas de data e leitura (kWh) no cabeçalho. Esperado algo como "Data", "Hora", "Leitura_kWh".',
      ],
    };
  }

  const readings: ParsedReading[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cols = lines[i].split(",").map((c) => c.trim());

    const dateStr = cols[dateIdx];
    const timeStr = timeIdx !== -1 ? cols[timeIdx] : "00:00";
    const kwhStr = cols[kwhIdx];

    const dateMatch = dateStr?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dateMatch) {
      errors.push(`Linha ${lineNumber}: data inválida ("${dateStr}"). Esperado DD/MM/AAAA.`);
      continue;
    }
    const [, dd, mm, yyyy] = dateMatch;

    let hh = 0;
    let min = 0;
    if (timeStr) {
      const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        hh = Number(timeMatch[1]);
        min = Number(timeMatch[2]);
      }
    }

    const kwhValue = Number((kwhStr ?? "").replace(",", "."));
    if (!kwhStr || Number.isNaN(kwhValue)) {
      errors.push(`Linha ${lineNumber}: leitura de kWh inválida ("${kwhStr}").`);
      continue;
    }

    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hh, min);
    if (Number.isNaN(date.getTime())) {
      errors.push(`Linha ${lineNumber}: data/hora não pôde ser interpretada.`);
      continue;
    }

    readings.push({ reading_at: date.toISOString(), kwh_reading: kwhValue });
  }

  return { readings, errors };
}
