import {
  PDFDocument,
  StandardFonts,
  type PDFPage,
  rgb,
} from "pdf-lib";

export type RcaPdfSection = {
  heading: string;
  body: string | string[];
};

export type RcaPdfInput = {
  title: string;
  subtitle?: string;
  reference?: string;
  generatedAt?: string;
  sections: RcaPdfSection[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const BOTTOM_Y = 58;
const BG = rgb(0.039, 0.043, 0.055);
const CREAM = rgb(0.925, 0.902, 0.839);
const GOLD = rgb(0.788, 0.710, 0.541);
const TITAN = rgb(0.698, 0.659, 0.596);
const MUTED = rgb(0.42, 0.40, 0.37);

function cleanText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
): string[] {
  const words = cleanText(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawFooter(page: PDFPage, pageNumber: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  page.drawLine({
    start: { x: MARGIN_X, y: 38 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 38 },
    thickness: 0.5,
    color: rgb(0.15, 0.15, 0.16),
  });
  page.drawText("JAMES ROMAN ADVISORY", {
    x: MARGIN_X,
    y: 24,
    size: 7,
    font,
    color: MUTED,
  });
  page.drawText(`PAGE ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN_X - 45,
    y: 24,
    size: 7,
    font,
    color: MUTED,
  });
}

/** Render a compact, RCA-styled document suitable for vault download or email attachment. */
export async function renderRcaPdf(input: RcaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const pages: PDFPage[] = [];

  const addPage = () => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: BG });
    page.drawRectangle({ x: MARGIN_X, y: PAGE_HEIGHT - 42, width: 70, height: 2, color: GOLD });
    pages.push(page);
    return page;
  };

  let page = addPage();
  let y = PAGE_HEIGHT - 102;

  const titleLines = wrapText(cleanText(input.title).slice(0, 120), bold, 28, PAGE_WIDTH - MARGIN_X * 2);
  page.drawText(titleLines.join("\n"), {
    x: MARGIN_X,
    y,
    size: 28,
    lineHeight: 32,
    font: bold,
    color: CREAM,
  });
  y -= titleLines.length * 32 + 2;

  if (input.subtitle) {
    const subtitleLines = wrapText(cleanText(input.subtitle).slice(0, 200), regular, 11, PAGE_WIDTH - MARGIN_X * 2);
    page.drawText(subtitleLines.join("\n"), {
      x: MARGIN_X,
      y,
      size: 11,
      lineHeight: 14,
      font: regular,
      color: TITAN,
    });
    y -= subtitleLines.length * 14 + 10;
  }

  const metadata = [
    input.reference ? `REFERENCE  ${cleanText(input.reference)}` : "",
    `ISSUED  ${cleanText(input.generatedAt ?? new Date().toISOString().slice(0, 10))}`,
  ].filter(Boolean).join("   /   ");
  page.drawText(metadata, {
    x: MARGIN_X,
    y,
    size: 7,
    font: mono,
    color: GOLD,
  });
  y -= 24;

  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 0.7,
    color: rgb(0.23, 0.21, 0.18),
  });
  y -= 28;

  for (const section of input.sections) {
    const headingLines = wrapText(section.heading, bold, 11, PAGE_WIDTH - MARGIN_X * 2);
    const bodyItems = Array.isArray(section.body) ? section.body : [section.body];
    const bodyLines = bodyItems.flatMap((item) => wrapText(item, regular, 10, PAGE_WIDTH - MARGIN_X * 2));
    const requiredHeight = 24 + bodyLines.length * 15 + 18;

    if (y - requiredHeight < BOTTOM_Y) {
      drawFooter(page, pages.length, mono);
      page = addPage();
      y = PAGE_HEIGHT - 78;
    }

    page.drawText(headingLines.join("\n"), {
      x: MARGIN_X,
      y,
      size: 11,
      lineHeight: 14,
      font: bold,
      color: GOLD,
    });
    y -= headingLines.length * 14 + 8;

    for (const item of bodyItems) {
      const lines = wrapText(item, regular, 10, PAGE_WIDTH - MARGIN_X * 2 - 10);
      for (const line of lines) {
        if (y < BOTTOM_Y + 15) {
          drawFooter(page, pages.length, mono);
          page = addPage();
          y = PAGE_HEIGHT - 78;
        }
        page.drawText(line, {
          x: MARGIN_X + 10,
          y,
          size: 10,
          font: regular,
          color: CREAM,
        });
        y -= 15;
      }
      y -= 6;
    }
    y -= 8;
  }

  drawFooter(page, pages.length, mono);
  return pdf.save();
}
