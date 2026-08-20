import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { computeSummary, type Period as CalcPeriod, type Reading as CalcReading } from "@/lib/calc";
import { FLAG_LABELS, type TariffFlag } from "@/lib/tariffFlags";
import { APP_VERSION } from "@/lib/version";

export type ReportNote = { date: string; text: string };

// --- layout constants -------------------------------------------------
const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const GREEN = rgb(0x22 / 255, 0xc5 / 255, 0x5e / 255);
const TEXT = rgb(0x17 / 255, 0x20 / 255, 0x33 / 255);
const MUTED = rgb(0x5b / 255, 0x66 / 255, 0x78 / 255);
const BORDER = rgb(0xe6 / 255, 0xeb / 255, 0xf3 / 255);
const ALERT = rgb(0xef / 255, 0x44 / 255, 0x44 / 255);

function fmtKwh(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kWh`;
}

function fmtReais(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Small stateful helper that tracks the current page/cursor and adds new
 * pages automatically when content would run past the bottom margin —
 * keeps every drawing call below oblivious to pagination.
 */
class ReportWriter {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page!: PDFPage;
  y = 0;

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.addPage();
  }

  text(
    str: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; x?: number } = {}
  ) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.regular;
    const color = opts.color ?? TEXT;
    this.ensureSpace(size + 4);
    this.page.drawText(str, { x: opts.x ?? MARGIN, y: this.y - size, size, font, color });
    this.y -= size + (opts.gap ?? 6);
  }

  /** Wraps `str` to fit within CONTENT_WIDTH (minus optional indent) and draws each line. */
  paragraph(str: string, opts: { size?: number; color?: ReturnType<typeof rgb>; indent?: number } = {}) {
    const size = opts.size ?? 10;
    const color = opts.color ?? MUTED;
    const indent = opts.indent ?? 0;
    const maxWidth = CONTENT_WIDTH - indent;
    const words = str.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.regular.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      this.ensureSpace(size + 4);
      this.page.drawText(l, { x: MARGIN + indent, y: this.y - size, size, font: this.regular, color });
      this.y -= size + 3;
    }
  }

  spacer(h: number) {
    this.y -= h;
  }

  hr() {
    this.ensureSpace(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: BORDER,
    });
    this.y -= 14;
  }

  sectionTitle(str: string) {
    this.ensureSpace(28);
    this.spacer(6);
    this.text(str, { size: 14, bold: true, gap: 10 });
  }
}

/**
 * Builds the period report PDF from already-fetched data (no DB access
 * here) — keeps this logic independently testable and keeps the route
 * handler a thin HTTP wrapper.
 */
export async function buildReportPdf(
  period: CalcPeriod,
  readings: CalcReading[],
  notes: ReportNote[]
): Promise<Uint8Array> {
  const summary = computeSummary(period, readings);

  const doc = await PDFDocument.create();
  doc.setTitle(`Wattly — Relatório do período ${fmtDate(period.start_date)} a ${fmtDate(period.end_date)}`);
  doc.setProducer("Wattly");
  doc.setCreator("Wattly");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new ReportWriter(doc, regular, bold);

  // Header band
  w.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: GREEN });
  w.spacer(6);
  w.text("Wattly", { size: 20, bold: true, gap: 2 });
  w.text("Entenda seu consumo.", { size: 10, color: MUTED, gap: 16 });

  w.text("Relatório do período", { size: 15, bold: true, gap: 4 });
  w.text(`${fmtDate(period.start_date)} — ${fmtDate(period.end_date)}`, { size: 11, color: MUTED, gap: 2 });
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  w.text(`Gerado em ${generatedAt}`, { size: 9, color: MUTED, gap: 18 });

  if (!summary.hasReadings) {
    w.hr();
    w.paragraph(
      "Nenhuma leitura registrada neste período ainda. Registre a primeira leitura no Wattly para ver o consumo, a previsão e a estimativa de custo aqui."
    );
  } else {
    // --- Consumo ---------------------------------------------------
    w.hr();
    w.sectionTitle("Consumo");

    w.text("Consumo acumulado", { size: 9, color: MUTED, gap: 2 });
    w.text(fmtKwh(summary.accumulatedKwh), { size: 18, bold: true, gap: 4 });
    w.text(`Média diária: ${fmtKwh(summary.dailyAverageKwh, 2)}/dia`, { size: 10, color: MUTED, gap: 2 });
    w.text(`Dias: ${summary.daysElapsed} decorridos, ${summary.daysRemaining} restantes (de ${summary.totalDays})`, {
      size: 10,
      color: MUTED,
      gap: 10,
    });

    w.text(`Previsão de fechamento: ${fmtKwh(summary.forecastFinalKwh)}`, { size: 12, bold: true, gap: 2 });
    if (period.goal_kwh != null) {
      const diff = (summary.forecastFinalKwh ?? 0) - period.goal_kwh;
      const overGoal = diff > 0;
      w.text(
        `Meta do período: ${fmtKwh(period.goal_kwh)} — previsão ${
          overGoal ? fmtKwh(diff) + " acima" : fmtKwh(-diff) + " abaixo"
        } da meta.`,
        { size: 10, color: overGoal ? ALERT : MUTED, gap: 4 }
      );
    }

    // --- Custos estimados -------------------------------------------
    w.hr();
    w.sectionTitle("Custos estimados");

    if (period.tariff_rate == null) {
      w.paragraph(
        "Nenhuma tarifa configurada para este período — configure em Ajustes para ver a estimativa de custo em R$."
      );
    } else {
      const energyCost = summary.forecastFinalKwh != null ? summary.forecastFinalKwh * period.tariff_rate : null;
      const flagApplies = period.tariff_flag && period.tariff_flag !== "verde" && period.flag_surcharge_rate != null;
      const flagCost =
        flagApplies && summary.forecastFinalKwh != null
          ? (summary.forecastFinalKwh / 100) * (period.flag_surcharge_rate as number)
          : 0;
      const fixedCost = period.fixed_fees_reais ?? 0;

      type Row = { label: string; calc: string; value: string };
      const rows: Row[] = [];
      rows.push({
        label: "Consumo de energia (TUSD + TE)",
        calc: `${fmtKwh(summary.forecastFinalKwh)} × ${fmtReais(period.tariff_rate)}/kWh`,
        value: fmtReais(energyCost),
      });
      if (flagApplies) {
        rows.push({
          label: `Adicional bandeira ${FLAG_LABELS[period.tariff_flag as TariffFlag]}`,
          calc: `(${fmtKwh(summary.forecastFinalKwh)} ÷ 100) × ${fmtReais(period.flag_surcharge_rate)}`,
          value: fmtReais(flagCost),
        });
      }
      rows.push({ label: "Taxas fixas (iluminação pública e outras)", calc: "—", value: fmtReais(fixedCost) });

      // simple 3-column table
      const col1 = MARGIN;
      const col2 = MARGIN + 230;
      const col3 = PAGE_WIDTH - MARGIN - 90;
      const rowHeight = 30;

      w.ensureSpace(rowHeight);
      w.page.drawRectangle({ x: MARGIN, y: w.y - 18, width: CONTENT_WIDTH, height: 20, color: rgb(0.97, 0.98, 0.99) });
      w.page.drawText("Parcela", { x: col1 + 6, y: w.y - 13, size: 9, font: bold, color: MUTED });
      w.page.drawText("Cálculo", { x: col2, y: w.y - 13, size: 9, font: bold, color: MUTED });
      w.page.drawText("Valor", { x: col3, y: w.y - 13, size: 9, font: bold, color: MUTED });
      w.y -= 24;

      for (const row of rows) {
        w.ensureSpace(rowHeight);
        w.page.drawText(row.label, { x: col1 + 6, y: w.y - 12, size: 9.5, font: regular, color: TEXT });
        w.page.drawText(row.calc, { x: col2, y: w.y - 12, size: 8.5, font: regular, color: MUTED });
        w.page.drawText(row.value, { x: col3, y: w.y - 12, size: 9.5, font: bold, color: TEXT });
        w.y -= 20;
        w.page.drawLine({
          start: { x: MARGIN, y: w.y + 4 },
          end: { x: PAGE_WIDTH - MARGIN, y: w.y + 4 },
          thickness: 0.5,
          color: BORDER,
        });
      }

      const total = (energyCost ?? 0) + flagCost + fixedCost;
      w.ensureSpace(rowHeight + 6);
      w.spacer(4);
      w.page.drawText("Total estimado (previsão de fechamento)", {
        x: col1 + 6,
        y: w.y - 14,
        size: 11,
        font: bold,
        color: TEXT,
      });
      w.page.drawText(fmtReais(total), { x: col3, y: w.y - 14, size: 12, font: bold, color: GREEN });
      w.y -= 30;

      if (summary.currentCostReais != null) {
        w.text(`Custo do consumo já realizado até agora: ${fmtReais(summary.currentCostReais)} (sem taxas fixas).`, {
          size: 9.5,
          color: MUTED,
          gap: 14,
        });
      }

      // explanations
      w.sectionTitle("O que é cada parcela");
      w.paragraph(
        "Consumo de energia (TUSD + TE): valor cobrado pela distribuidora pelo uso da rede de distribuição (TUSD) e pela energia efetivamente consumida (TE). É o componente que mais varia conforme o quanto você consome."
      );
      w.spacer(6);
      w.paragraph(
        "Bandeira tarifária: cobrança adicional definida mensalmente pela ANEEL, de acordo com as condições de geração de energia no país. A bandeira verde não tem custo extra; as bandeiras amarela e vermelha (patamares 1 e 2) aplicam um valor adicional a cada 100 kWh consumidos."
      );
      w.spacer(6);
      w.paragraph(
        "Taxas fixas: valores que aparecem na fatura independentemente do quanto você consome, como a Contribuição para Custeio da Iluminação Pública (COSIP) e outras taxas municipais."
      );
      w.spacer(10);
      w.paragraph(
        "Estes valores são uma estimativa calculada com a tarifa configurada em Ajustes. A fatura real da distribuidora pode incluir outros itens que este relatório não contempla.",
        { size: 8.5 }
      );
    }

    // --- Anotações ---------------------------------------------------
    if (notes.length > 0) {
      w.hr();
      w.sectionTitle("Anotações do período");
      for (const n of notes) {
        w.ensureSpace(14);
        w.text(fmtDate(n.date), { size: 8.5, bold: true, color: MUTED, gap: 2 });
        w.paragraph(n.text, { size: 9.5, color: TEXT });
        w.spacer(6);
      }
    }
  }

  // footer on every page
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(`Wattly v${APP_VERSION} — Entenda seu consumo.`, {
      x: MARGIN,
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
    pg.drawText(`${i + 1}/${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 20,
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
