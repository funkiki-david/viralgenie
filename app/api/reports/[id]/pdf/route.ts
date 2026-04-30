import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";

type AnyObj = Record<string, unknown>;

const FONT_NAME = "NotoSansSC";
const FONT_FILE = "NotoSansSC-Regular.ttf";
const FONT_PATH = path.join(process.cwd(), "public/fonts", FONT_FILE);

let fontBase64Cache: string | null = null;
let fontMissingReported = false;

function loadFontBase64(): string | null {
  if (fontBase64Cache) return fontBase64Cache;
  try {
    fontBase64Cache = fs.readFileSync(FONT_PATH).toString("base64");
    return fontBase64Cache;
  } catch (err) {
    if (!fontMissingReported) {
      fontMissingReported = true;
      console.warn(
        `[pdf] CJK font missing at ${FONT_PATH} — falling back to Helvetica. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return null;
  }
}


function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

const CJK_RE = /[　-〿一-鿿＀-￯]/;

function reportContainsCJK(report: unknown): boolean {
  if (report == null) return false;
  return CJK_RE.test(JSON.stringify(report));
}

function buildPdf(task: {
  id: string;
  url: string;
  urlType: string;
  status: string;
  crawlEngine?: string | null;
  promptType?: string | null;
  createdAt: Date;
  updatedAt: Date;
  report: unknown;
}): ArrayBuffer {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;

  // Embed the CJK font ONLY when the report actually contains CJK chars.
  // English-only PDFs stay tiny (~10 KB); CJK PDFs ship the font (~430 KB).
  const needsCJK = reportContainsCJK(task.report);
  const fontB64 = needsCJK ? loadFontBase64() : null;
  const fontFamily = fontB64 ? FONT_NAME : "helvetica";
  if (fontB64) {
    pdf.addFileToVFS(FONT_FILE, fontB64);
    pdf.addFont(FONT_FILE, FONT_NAME, "normal");
    pdf.addFont(FONT_FILE, FONT_NAME, "bold");
    pdf.addFont(FONT_FILE, FONT_NAME, "italic");
    pdf.addFont(FONT_FILE, FONT_NAME, "bolditalic");
  }

  let y = 0;
  let pageNum = 1;

  const drawHeader = () => {
    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(30, 30, 30);
    pdf.text("ViralGenie", margin, 32);
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      new Date(task.createdAt).toISOString().replace("T", " ").slice(0, 16),
      pageW - margin,
      32,
      { align: "right" },
    );
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 40, pageW - margin, 40);
    y = 60;
  };

  const drawFooter = () => {
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${pageNum}`,
      pageW / 2,
      pageH - 18,
      { align: "center" },
    );
  };

  const newPage = () => {
    drawFooter();
    pdf.addPage();
    pageNum += 1;
    drawHeader();
  };

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageH - 40) newPage();
  };

  const setStyle = (
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = [30, 30, 30],
  ) => {
    pdf.setFont(fontFamily, style);
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
  };

  const writeLines = (
    text: string,
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = [30, 30, 30],
  ) => {
    setStyle(size, style, color);
    const lineHeight = size * 1.4;
    const lines = pdf.splitTextToSize(text || "—", contentW) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  };

  const sectionTitle = (label: string) => {
    y += 14;
    ensureSpace(18);
    setStyle(12, "bold", [30, 30, 30]);
    pdf.text(label, margin, y);
    y += 10;
  };

  const paragraphSection = (label: string, text: string) => {
    sectionTitle(label);
    writeLines(text || "-", 11, "normal");
  };

  const listSection = (
    label: string,
    items: string[],
    ordered = false,
  ) => {
    sectionTitle(label);
    if (items.length === 0) {
      writeLines("-", 11, "normal");
      return;
    }
    items.forEach((item, i) => {
      const prefix = ordered ? `${i + 1}. ` : "- ";
      writeLines(`${prefix}${item}`, 11, "normal");
    });
  };

  // Page 1
  drawHeader();

  // Title block
  setStyle(18, "bold", [30, 30, 30]);
  pdf.text("Analysis Report", margin, y);
  y += 26;

  setStyle(10, "normal", [80, 80, 80]);
  pdf.text(
    `Type: ${task.promptType ?? "-"}    Platform: ${task.urlType}    Engine: ${task.crawlEngine ?? "-"}`,
    margin,
    y,
  );
  y += 16;

  setStyle(9, "normal", [110, 110, 110]);
  const urlLines = pdf.splitTextToSize(`URL: ${task.url}`, contentW) as string[];
  for (const line of urlLines) {
    ensureSpace(13);
    pdf.text(line, margin, y);
    y += 13;
  }

  setStyle(9, "normal", [110, 110, 110]);
  pdf.text(`Task ID: ${task.id}`, margin, y);
  y += 14;

  // Show a small note only if a CJK report failed to load the font.
  if (needsCJK && !fontB64) {
    setStyle(9, "italic", [180, 100, 0]);
    const warn =
      "Note: CJK font missing on server - Chinese characters may render as boxes.";
    const warnLines = pdf.splitTextToSize(warn, contentW) as string[];
    for (const line of warnLines) {
      ensureSpace(12);
      pdf.text(line, margin, y);
      y += 12;
    }
    y += 8;
  }

  const report = (task.report ?? {}) as AnyObj;
  const type = task.promptType;

  if (type === "script_teardown") {
    paragraphSection("Hook", asString(report.hook));
    listSection("Pivot Points", asStringArray(report.pivotPoints), true);
    paragraphSection("Call to Action", asString(report.cta));
    paragraphSection("Pacing", asString(report.pacing));
    paragraphSection("Emotional Arc", asString(report.emotionalArc));
    listSection("Key Takeaways", asStringArray(report.keyTakeaways));
  } else if (type === "product_compare") {
    listSection("Features", asStringArray(report.features));
    paragraphSection("Pricing", asString(report.pricing));
    listSection("Strengths", asStringArray(report.strengths));
    listSection("Weaknesses", asStringArray(report.weaknesses));
    listSection("Pain Points", asStringArray(report.painPoints));
    paragraphSection("Target Audience", asString(report.targetAudience));
    paragraphSection(
      "Competitive Advantage",
      asString(report.competitiveAdvantage),
    );
  } else if (type === "viral_rewrite") {
    if (asString(report.originalAnalysis)) {
      paragraphSection("Original Analysis", asString(report.originalAnalysis));
    }
    const variants = Array.isArray(report.variants) ? report.variants : [];
    variants.forEach((raw, i) => {
      const v = (raw ?? {}) as AnyObj;
      sectionTitle(`Variant ${i + 1} - ${asString(v.style) || "-"}`);
      writeLines(asString(v.content) || "-", 11, "normal");
      const why = asString(v.whyItWorks);
      if (why) {
        y += 4;
        writeLines(`Why it works: ${why}`, 10, "italic", [110, 110, 110]);
      }
    });
  } else {
    sectionTitle("Report");
    writeLines(JSON.stringify(report, null, 2), 9, "normal");
  }

  drawFooter();

  return pdf.output("arraybuffer") as ArrayBuffer;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.analysisTask.findUnique({ where: { id } });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "done") {
    return Response.json(
      {
        error: `Task status is "${task.status}" — PDF only available for completed reports`,
      },
      { status: 400 },
    );
  }

  const buf = buildPdf(task);

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="viralgenie-report-${id}.pdf"`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
