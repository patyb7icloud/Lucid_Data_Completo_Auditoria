/**
 * Export Service — Lucid Data Governance
 * Geração de relatórios em PDF (pdfmake) e DOCX (docx)
 * com identidade visual corporativa: Azul #1B3A8C, Verde #6DC23A
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
const __dirnameEsm = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PdfPrinter = _require("pdfmake/js/Printer").default as new (
  fonts: Record<string, unknown>,
  virtualfs?: unknown,
  urlResolver?: unknown
) => { createPdfKitDocument: (docDefinition: unknown) => Promise<NodeJS.EventEmitter & { end: () => void }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const URLResolver = _require("pdfmake/js/URLResolver").default as new (fs: unknown) => unknown;
const { virtualfs: pdfVirtualfs } = _require("pdfmake") as { virtualfs: unknown };
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  ImageRun,
} from "docx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getMeetingById,
  getAgendaItems,
  getInvitesByMeeting,
  getDomainById,
  getParticipants,
  getDomains,
  getDashboardMetrics,
  createExportHistory,
} from "./db";
import { storagePut } from "./storage";

export interface ExportContext {
  generatedBy?: string;
  generatedById?: number;
}

// ─── Cores e estilos VC ──────────────────────────────────────────────────────
const VC_BLUE = "#1B3A8C";
const VC_GREEN = "#6DC23A";
const VC_BLUE_LIGHT = "#E8EDF8";
const VC_GRAY = "#F5F5F5";
const VC_TEXT = "#1A1A1A";
const VC_SUBTEXT = "#555555";

// ─── Mapeamentos de labels ────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  data_owner: "Data Owner",
  data_steward: "Data Steward",
  product_owner: "Product Owner",
  project_manager: "Project Manager",
  ai_owner: "AI Owner",
  ai_steward: "AI Steward",
  ai_ethics_officer: "AI Ethics Officer",
  ml_engineer: "ML Engineer",
  model_manager: "Model Manager",
  data_engineer: "Data Engineer",
  data_architect: "Data Architect",
  facilitador: "Facilitador",
  representante_negocio: "Representante de Negócio",
  outro: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  adiada: "Adiada",
  ordinaria: "Ordinária",
  extraordinaria: "Extraordinária",
  piloto: "Piloto",
  workshop: "Workshop",
};

const INVITE_STATUS_LABELS: Record<string, string> = {
  confirmado: "Confirmado",
  recusado: "Recusado",
  talvez: "Talvez",
  pendente: "Pendente",
};

/**
 * Converte uma tabela Markdown (| col1 | col2 | ...) para o formato de tabela do pdfmake.
 * Retorna null se o texto não contiver tabela Markdown.
 */
function parseMarkdownTableToPdfmake(
  text: string,
  headerFillColor: string = "#1B3A8C",
  altFillColor: string = "#EEF7EE"
): unknown | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const tableLines = lines.filter((l) => l.startsWith("|"));
  if (tableLines.length < 2) return null;
  // Remove separator lines like |---|---|---|
  const dataLines = tableLines.filter((l) => !/^\|[-:\s|]+\|$/.test(l));
  if (dataLines.length < 1) return null;
  const parseRow = (line: string): string[] =>
    line.split("|").slice(1, -1).map((c) => c.trim());
  const [headerRow, ...bodyRows] = dataLines;
  const headers = parseRow(headerRow);
  const colCount = headers.length;
  if (colCount === 0) return null;
  const widths: string[] = Array(colCount).fill("*");
  const body: unknown[][] = [
    headers.map((h) => ({
      text: h,
      bold: true,
      fontSize: 9,
      color: "#FFFFFF",
      fillColor: headerFillColor,
      margin: [4, 4, 4, 4],
    })),
    ...bodyRows.map((row, idx) => {
      const cells = parseRow(row);
      return Array(colCount).fill(null).map((_, ci) => ({
        text: cells[ci] ?? "",
        fontSize: 9,
        fillColor: idx % 2 === 0 ? "#FFFFFF" : altFillColor,
        margin: [4, 3, 4, 3],
      }));
    }),
  ];
  return {
    table: { widths, body },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#CCCCCC",
      vLineColor: () => "#CCCCCC",
    },
    margin: [0, 0, 0, 16],
  };
}

/**
 * Converte texto (pode conter tabela Markdown) para conteúdo pdfmake.
 * Se contiver tabela, retorna a tabela formatada; caso contrário, caixa de texto simples.
 */
function textOrMarkdownTable(
  text: string,
  textStyle: string = "bodyText",
  boxFillColor: string = "#E8F5E9",
  boxBorderColor: string = "#6DC23A"
): unknown[] {
  const table = parseMarkdownTableToPdfmake(text);
  if (table) return [table];
  return [{
    table: {
      widths: ["*"],
      body: [[{ text, style: textStyle, fillColor: boxFillColor, margin: [8, 8, 8, 8] }]],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => boxBorderColor,
      vLineColor: () => boxBorderColor,
    },
    margin: [0, 0, 0, 16],
  }];
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function formatDateOnly(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

// ─── Geração de PDF (pdfmake v0.3) ───────────────────────────────────────────

// Resolve o diretório das fontes de forma compatível com ESM e Vitest
const pdfmakeDir = (() => {
  try {
    // Node.js runtime: createRequire tem .resolve
    if (typeof (_require as any).resolve === "function") {
      return path.dirname((_require as any).resolve("pdfmake/package.json"));
    }
  } catch (_) { /* ignore */ }
  // Fallback: caminho relativo ao projeto (pnpm symlink)
  return path.resolve(__dirnameEsm, "..", "node_modules", "pdfmake");
})();
const fontsDir = path.join(pdfmakeDir, "fonts", "Roboto");
const pdfFonts = {
  Roboto: {
    normal: path.join(fontsDir, "Roboto-Regular.ttf"),
    bold: path.join(fontsDir, "Roboto-Medium.ttf"),
    italics: path.join(fontsDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
  },
};

const printer = new PdfPrinter(pdfFonts, pdfVirtualfs, new URLResolver(pdfVirtualfs));

/** Converte o PDFDocument (pdfmake v0.3, async) em Buffer */
async function pdfDocToBuffer(docDefinition: unknown): Promise<Buffer> {
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

function pdfHeader(title: string, subtitle?: string) {
  return [
    {
      // Faixa azul do cabeçalho — usa tabela em vez de canvas para evitar bug do pdfmake v0.3
      table: {
        widths: ["*", "auto"],
        body: [[
          {
            stack: [
              { text: "LUCID DATA GOVERNANCE", style: "headerTitle" },
              { text: title, style: "headerSubtitle", margin: [0, 2, 0, 0] },
              ...(subtitle ? [{ text: subtitle, style: "headerSmall", margin: [0, 2, 0, 0] }] : []),
            ],
            fillColor: VC_BLUE,
            margin: [8, 10, 8, 10],
          },
          {
            stack: [
              { text: "Lucid Data Governance", style: "headerRight", alignment: "right" },
              { text: `Gerado em: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, style: "headerSmall", alignment: "right", color: "white", margin: [0, 4, 0, 0] },
            ],
            fillColor: VC_BLUE,
            margin: [8, 10, 8, 10],
          },
        ]],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 0],
    },
    {
      // Faixa verde separadora — usa tabela em vez de canvas
      table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 2, 0, 2] }]] },
      layout: "noBorders",
      margin: [0, 0, 0, 16],
    },
  ];
}

function pdfFooter(currentPage: number, pageCount: number) {
  return {
    columns: [
      {
        text: "Lucid Data Governance — Lucid Data Governance | Documento Confidencial",
        style: "footer",
        alignment: "left",
      },
      {
        text: `Página ${currentPage} de ${pageCount}`,
        style: "footer",
        alignment: "right",
      },
    ],
    margin: [40, 0, 40, 0],
  };
}

const pdfStyles = {
  headerTitle: {
    fontSize: 14,
    bold: true,
    color: "white",
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#C8D8F8",
  },
  headerSmall: {
    fontSize: 8,
    color: "#C8D8F8",
  },
  headerRight: {
    fontSize: 12,
    bold: true,
    color: "white",
  },
  sectionTitle: {
    fontSize: 13,
    bold: true,
    color: VC_BLUE,
    margin: [0, 12, 0, 6],
  },
  sectionSubtitle: {
    fontSize: 10,
    bold: true,
    color: VC_SUBTEXT,
    margin: [0, 8, 0, 4],
  },
  bodyText: {
    fontSize: 10,
    color: VC_TEXT,
    lineHeight: 1.4,
  },
  tableHeader: {
    fontSize: 9,
    bold: true,
    color: "white",
    fillColor: VC_BLUE,
  },
  tableCell: {
    fontSize: 9,
    color: VC_TEXT,
  },
  tableCellAlt: {
    fontSize: 9,
    color: VC_TEXT,
    fillColor: VC_BLUE_LIGHT,
  },
  badge: {
    fontSize: 8,
    bold: true,
  },
  footer: {
    fontSize: 8,
    color: "#888888",
  },
  metaLabel: {
    fontSize: 9,
    bold: true,
    color: VC_BLUE,
  },
  metaValue: {
    fontSize: 9,
    color: VC_TEXT,
  },
};

// ─── PDF: Ata de Reunião ──────────────────────────────────────────────────────

export async function generateMeetingMinutesPDF(meetingId: number): Promise<Buffer> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error("Reunião não encontrada");

  const agenda = await getAgendaItems(meetingId);
  const invitesList = await getInvitesByMeeting(meetingId);
  const domain = meeting.domainId ? await getDomainById(meeting.domainId) : null;

  const confirmed = invitesList.filter((i) => i.status === "confirmado");
  const declined = invitesList.filter((i) => i.status === "recusado");
  const pending = invitesList.filter((i) => i.status === "pendente" || i.status === "talvez");

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 60],
    header: () => pdfHeader(
      "ATA DE REUNIÃO",
      `${meeting.title} — ${formatDateOnly(meeting.scheduledAt)}`
    ),
    footer: (currentPage: number, pageCount: number) => pdfFooter(currentPage, pageCount),
    styles: pdfStyles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
    content: [
      // Informações da reunião
      {
        text: "INFORMAÇÕES DA REUNIÃO",
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: [120, "*", 120, "*"],
          body: [
            [
              { text: "Título:", style: "metaLabel" },
              { text: meeting.title, style: "metaValue", colSpan: 3 },
              {}, {},
            ],
            [
              { text: "Data e Hora:", style: "metaLabel" },
              { text: formatDate(meeting.scheduledAt), style: "metaValue" },
              { text: "Término:", style: "metaLabel" },
              { text: meeting.endAt ? formatDate(meeting.endAt) : "—", style: "metaValue" },
            ],
            [
              { text: "Tipo:", style: "metaLabel" },
              { text: STATUS_LABELS[meeting.type ?? ""] ?? meeting.type ?? "—", style: "metaValue" },
              { text: "Status:", style: "metaLabel" },
              { text: STATUS_LABELS[meeting.status ?? ""] ?? meeting.status ?? "—", style: "metaValue" },
            ],
            [
              { text: "Local:", style: "metaLabel" },
              { text: meeting.location ?? "—", style: "metaValue" },
              { text: "Domínio:", style: "metaLabel" },
              { text: domain?.name ?? "—", style: "metaValue" },
            ],
            ...(meeting.meetingLink ? [[
              { text: "Link:", style: "metaLabel" },
              { text: meeting.meetingLink, style: "metaValue", colSpan: 3, color: VC_BLUE },
              {}, {},
            ]] : []),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#DDDDDD",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 16],
      },

      // Descrição
      ...(meeting.description ? [
        { text: "DESCRIÇÃO", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 8] },
        { text: meeting.description, style: "bodyText", margin: [0, 0, 0, 16] },
      ] : []),

      // Participantes
      {
        text: "PARTICIPANTES",
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 8],
      },
      ...(invitesList.length > 0 ? [
        {
          table: {
            widths: ["*", 100, 80],
            body: [
              [
                { text: "Nome", style: "tableHeader", fillColor: VC_BLUE },
                { text: "E-mail", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Status", style: "tableHeader", fillColor: VC_BLUE },
              ],
              ...invitesList.map((inv, idx) => [
                { text: inv.participantName ?? "—", style: idx % 2 === 0 ? "tableCell" : "tableCellAlt" },
                { text: inv.email ?? "—", style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", fontSize: 8 },
                {
                  text: INVITE_STATUS_LABELS[inv.status ?? "pendente"] ?? "Pendente",
                  style: idx % 2 === 0 ? "tableCell" : "tableCellAlt",
                  color: inv.status === "confirmado" ? "#2D7A2D" : inv.status === "recusado" ? "#C0392B" : VC_SUBTEXT,
                  bold: true,
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#DDDDDD",
            vLineColor: () => "#DDDDDD",
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 4],
        },
        {
          text: `Total: ${invitesList.length} convidados — ${confirmed.length} confirmados, ${declined.length} recusados, ${pending.length} pendentes`,
          style: "metaValue",
          color: VC_SUBTEXT,
          fontSize: 8,
          margin: [0, 4, 0, 16],
        },
      ] : [
        { text: "Nenhum participante registrado.", style: "bodyText", color: VC_SUBTEXT, margin: [0, 0, 0, 16] },
      ]),

      // Pauta
      ...(agenda.length > 0 ? [
        { text: "PAUTA", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 8] },
        ...agenda.map((item, idx) => ({
          stack: [
            {
              columns: [
                {
                  text: `${idx + 1}. ${item.title}`,
                  style: "sectionSubtitle",
                  width: "*",
                },
                ...(item.duration ? [{
                  text: `${item.duration} min`,
                  fontSize: 8,
                  color: VC_SUBTEXT,
                  alignment: "right",
                  width: 60,
                }] : []),
              ],
            },
            ...(item.description ? [{
              text: item.description,
              style: "bodyText",
              margin: [12, 0, 0, 4],
            }] : []),
          ],
          margin: [0, 0, 0, 8],
        })),
        { text: "", margin: [0, 0, 0, 8] },
      ] : []),

      // Ata / Registro
      ...(meeting.minutesContent ? [
        { text: "REGISTRO DA REUNIÃO (ATA)", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 8] },
        { text: meeting.minutesContent, style: "bodyText", margin: [0, 0, 0, 16] },
      ] : []),

      // Decisões
      ...(meeting.decisionsContent ? [
        { text: "DECISÕES", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 8] },
        {
          table: {
            widths: ["*"],
            body: [[
              {
                text: meeting.decisionsContent,
                style: "bodyText",
                fillColor: "#FFF9E6",
                margin: [8, 8, 8, 8],
              },
            ]],
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => "#F0C040",
            vLineColor: () => "#F0C040",
          },
          margin: [0, 0, 0, 16],
        },
      ] : []),

      // Encaminhamentos
      ...(meeting.actionsContent ? [
        { text: "ENCAMINHAMENTOS / AÇÕES", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 8] },
        ...textOrMarkdownTable(meeting.actionsContent, "bodyText", "#E8F5E9", VC_GREEN),
      ] : []),

      // Assinaturas
      {
        text: "ASSINATURAS",
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          {
            stack: [
              { table: { widths: [150], body: [[{ text: "", fillColor: "#AAAAAA", margin: [0, 1, 0, 1] }]] }, layout: "noBorders" },
              { text: "Facilitador / Secretário", fontSize: 8, color: VC_SUBTEXT, margin: [0, 4, 0, 0] },
            ],
          },
          { width: 40, text: "" },
          {
            stack: [
              { table: { widths: [150], body: [[{ text: "", fillColor: "#AAAAAA", margin: [0, 1, 0, 1] }]] }, layout: "noBorders" },
              { text: "Data Owner / Responsável", fontSize: 8, color: VC_SUBTEXT, margin: [0, 4, 0, 0] },
            ],
          },
          { width: 40, text: "" },
          {
            stack: [
              { table: { widths: [150], body: [[{ text: "", fillColor: "#AAAAAA", margin: [0, 1, 0, 1] }]] }, layout: "noBorders" },
              { text: "Aprovação", fontSize: 8, color: VC_SUBTEXT, margin: [0, 4, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 0],
      },
    ],
  };

   return pdfDocToBuffer(docDefinition);
}
// ─── PDF: Organograma do Domínio ──────────────────────────────────────────────

export async function generateOrganogramPDF(domainId: number): Promise<Buffer> {
  const domain = await getDomainById(domainId);
  if (!domain) throw new Error("Domínio não encontrado");

  const participantsList = await getParticipants(domainId);

  // Agrupar por papel
  const byRole: Record<string, typeof participantsList> = {};
  for (const p of participantsList) {
    const role = p.role ?? "outro";
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(p);
  }

  const roleOrder = [
    "data_owner", "data_steward", "product_owner", "project_manager",
    "ai_owner", "ai_steward", "ai_ethics_officer", "ml_engineer",
    "model_manager", "data_engineer", "data_architect",
    "facilitador", "representante_negocio", "outro",
  ];

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 60],
    header: () => pdfHeader(
      "ORGANOGRAMA DE PAPÉIS",
      `Domínio: ${domain.name}`
    ),
    footer: (currentPage: number, pageCount: number) => pdfFooter(currentPage, pageCount),
    styles: pdfStyles,
    defaultStyle: { font: "Roboto", fontSize: 10 },
    content: [
      // Cabeçalho do domínio
      {
        table: {
          widths: ["*"],
          body: [[
            {
              stack: [
                { text: domain.name, fontSize: 16, bold: true, color: VC_BLUE },
                ...(domain.description ? [{ text: domain.description, fontSize: 10, color: VC_SUBTEXT, margin: [0, 4, 0, 0] }] : []),
                {
                  columns: [
                    ...(domain.responsible ? [{ text: `Responsável: ${domain.responsible}`, fontSize: 9, color: VC_TEXT, width: "*" }] : []),
                    { text: `Status: ${STATUS_LABELS[domain.status ?? ""] ?? domain.status ?? "—"}`, fontSize: 9, color: VC_TEXT, width: 120 },
                    { text: `Progresso: ${Math.round(domain.implementationProgress ?? 0)}%`, fontSize: 9, color: VC_BLUE, bold: true, width: 80 },
                  ],
                  margin: [0, 6, 0, 0],
                },
              ],
              fillColor: VC_BLUE_LIGHT,
              margin: [12, 12, 12, 12],
            },
          ]],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => VC_BLUE,
          vLineColor: () => VC_BLUE,
        },
        margin: [0, 0, 0, 20],
      },

      // Resumo de participantes
      {
        text: `PARTICIPANTES DO DOMÍNIO (${participantsList.length} total)`,
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 12],
      },

      // Tabela geral de participantes
      ...(participantsList.length > 0 ? [
        {
          table: {
            widths: ["*", 120, 100, 80],
            body: [
              [
                { text: "Nome", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Cargo", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Papel", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Status", style: "tableHeader", fillColor: VC_BLUE },
              ],
              ...participantsList.map((p, idx) => [
                {
                  stack: [
                    { text: p.name, style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", bold: true },
                    ...(p.email ? [{ text: p.email, fontSize: 7, color: VC_SUBTEXT }] : []),
                  ],
                },
                { text: p.jobTitle ?? "—", style: idx % 2 === 0 ? "tableCell" : "tableCellAlt" },
                { text: ROLE_LABELS[p.role] ?? p.role, style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", color: VC_BLUE, bold: true },
                {
                  text: p.status === "ativo" ? "Ativo" : p.status === "inativo" ? "Inativo" : "A Designar",
                  style: idx % 2 === 0 ? "tableCell" : "tableCellAlt",
                  color: p.status === "ativo" ? "#2D7A2D" : p.status === "inativo" ? "#C0392B" : "#E67E22",
                  bold: true,
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#DDDDDD",
            vLineColor: () => "#DDDDDD",
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 20],
        },
      ] : [
        { text: "Nenhum participante cadastrado para este domínio.", style: "bodyText", color: VC_SUBTEXT, margin: [0, 0, 0, 16] },
      ]),

      // Organograma por papel
      {
        text: "ESTRUTURA POR PAPEL",
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 12],
      },
      ...roleOrder
        .filter((role) => byRole[role] && byRole[role].length > 0)
        .map((role) => ({
          stack: [
            {
              table: {
                widths: [140, "*"],
                body: [
                  [
                    {
                      text: ROLE_LABELS[role] ?? role,
                      style: "tableHeader",
                      fillColor: VC_BLUE,
                      margin: [6, 6, 6, 6],
                    },
                    {
                      stack: byRole[role].map((p) => ({
                        columns: [
                          { text: "●", color: VC_GREEN, width: 12, fontSize: 10 },
                          {
                            stack: [
                              { text: p.name, bold: true, fontSize: 9, color: VC_TEXT },
                              ...(p.jobTitle ? [{ text: p.jobTitle, fontSize: 8, color: VC_SUBTEXT }] : []),
                              ...(p.department ? [{ text: p.department, fontSize: 7, color: VC_SUBTEXT }] : []),
                            ],
                            width: "*",
                          },
                        ],
                        margin: [0, 2, 0, 2],
                      })),
                      margin: [6, 6, 6, 6],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => "#DDDDDD",
                vLineColor: () => "#DDDDDD",
              },
              margin: [0, 0, 0, 6],
            },
          ],
        })),
    ],
  };

  return pdfDocToBuffer(docDefinition);
}
// ─── PDF: Relatório de Métricass ───────────────────────────────────────────────

export async function generateMetricsReportPDF(): Promise<Buffer> {
  const metrics = await getDashboardMetrics();
  if (!metrics) throw new Error("Não foi possível obter métricas");

  const confirmationRate = metrics.totalInvites > 0
    ? Math.round((metrics.confirmedInvites / metrics.totalInvites) * 100)
    : 0;

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 60],
    header: () => pdfHeader(
      "RELATÓRIO DE MÉTRICAS",
      `Lucid Data Governance — ${format(new Date(), "MMMM yyyy", { locale: ptBR })}`
    ),
    footer: (currentPage: number, pageCount: number) => pdfFooter(currentPage, pageCount),
    styles: pdfStyles,
    defaultStyle: { font: "Roboto", fontSize: 10 },
    content: [
      // KPIs principais
      {
        text: "INDICADORES PRINCIPAIS",
        style: "sectionTitle",
      },
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 12],
      },
      {
        columns: [
          {
            table: {
              widths: ["*"],
              body: [[
                {
                  stack: [
                    { text: String(metrics.totalParticipants), fontSize: 28, bold: true, color: VC_BLUE, alignment: "center" },
                    { text: "Participantes", fontSize: 9, color: VC_SUBTEXT, alignment: "center" },
                    { text: `${metrics.activeParticipants} ativos`, fontSize: 8, color: VC_GREEN, alignment: "center", bold: true },
                  ],
                  fillColor: VC_BLUE_LIGHT,
                  margin: [8, 12, 8, 12],
                },
              ]],
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => VC_BLUE, vLineColor: () => VC_BLUE },
          },
          { width: 8, text: "" },
          {
            table: {
              widths: ["*"],
              body: [[
                {
                  stack: [
                    { text: String(metrics.totalDomains), fontSize: 28, bold: true, color: VC_BLUE, alignment: "center" },
                    { text: "Domínios", fontSize: 9, color: VC_SUBTEXT, alignment: "center" },
                    { text: "cadastrados", fontSize: 8, color: VC_GREEN, alignment: "center", bold: true },
                  ],
                  fillColor: VC_BLUE_LIGHT,
                  margin: [8, 12, 8, 12],
                },
              ]],
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => VC_BLUE, vLineColor: () => VC_BLUE },
          },
          { width: 8, text: "" },
          {
            table: {
              widths: ["*"],
              body: [[
                {
                  stack: [
                    { text: String(metrics.totalMeetings), fontSize: 28, bold: true, color: VC_BLUE, alignment: "center" },
                    { text: "Reuniões", fontSize: 9, color: VC_SUBTEXT, alignment: "center" },
                    { text: `${metrics.upcomingMeetings} agendadas`, fontSize: 8, color: VC_GREEN, alignment: "center", bold: true },
                  ],
                  fillColor: VC_BLUE_LIGHT,
                  margin: [8, 12, 8, 12],
                },
              ]],
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => VC_BLUE, vLineColor: () => VC_BLUE },
          },
          { width: 8, text: "" },
          {
            table: {
              widths: ["*"],
              body: [[
                {
                  stack: [
                    { text: `${confirmationRate}%`, fontSize: 28, bold: true, color: VC_GREEN, alignment: "center" },
                    { text: "Confirmações", fontSize: 9, color: VC_SUBTEXT, alignment: "center" },
                    { text: `${metrics.confirmedInvites}/${metrics.totalInvites}`, fontSize: 8, color: VC_BLUE, alignment: "center", bold: true },
                  ],
                  fillColor: "#F0F8E8",
                  margin: [8, 12, 8, 12],
                },
              ]],
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => VC_GREEN, vLineColor: () => VC_GREEN },
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Distribuição de papéis
      ...(metrics.roleDistribution.length > 0 ? [
        { text: "DISTRIBUIÇÃO DE PAPÉIS", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 12] },
        {
          table: {
            widths: ["*", 80, 100],
            body: [
              [
                { text: "Papel", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Quantidade", style: "tableHeader", fillColor: VC_BLUE },
                { text: "% do Total", style: "tableHeader", fillColor: VC_BLUE },
              ],
              ...metrics.roleDistribution.map((r: any, idx: number) => [
                { text: ROLE_LABELS[r.role] ?? r.role, style: idx % 2 === 0 ? "tableCell" : "tableCellAlt" },
                { text: String(r.count), style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", alignment: "center" },
                {
                  text: `${Math.round((r.count / metrics.totalParticipants) * 100)}%`,
                  style: idx % 2 === 0 ? "tableCell" : "tableCellAlt",
                  alignment: "center",
                  color: VC_BLUE,
                  bold: true,
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#DDDDDD",
            vLineColor: () => "#DDDDDD",
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 20],
        },
      ] : []),

      // Progresso por domínio
      ...(metrics.domainProgress.length > 0 ? [
        { text: "PROGRESSO POR DOMÍNIO", style: "sectionTitle" },
        { table: { widths: ["*"], body: [[{ text: "", fillColor: VC_GREEN, margin: [0, 1, 0, 1] }]] }, layout: "noBorders", margin: [0, 0, 0, 12] },
        {
          table: {
            widths: ["*", 80, 200],
            body: [
              [
                { text: "Domínio", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Progresso", style: "tableHeader", fillColor: VC_BLUE },
                { text: "Barra de Progresso", style: "tableHeader", fillColor: VC_BLUE },
              ],
              ...metrics.domainProgress.map((d: any, idx: number) => {
                const pct = Math.round(d.progress ?? 0);
                const barWidth = Math.round((pct / 100) * 180);
                return [
                  { text: d.name, style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", bold: true },
                  { text: `${pct}%`, style: idx % 2 === 0 ? "tableCell" : "tableCellAlt", alignment: "center", color: VC_BLUE, bold: true },
                  {
                    // Barra de progresso via tabelas aninhadas (sem canvas para evitar bug pdfmake v0.3)
                    stack: [
                      {
                        table: {
                          widths: [barWidth > 0 ? barWidth : 1, 180 - (barWidth > 0 ? barWidth : 0)],
                          body: [[
                            barWidth > 0
                              ? { text: "", fillColor: VC_GREEN, margin: [0, 4, 0, 4] }
                              : { text: "", fillColor: "#E0E0E0", margin: [0, 4, 0, 4] },
                            { text: "", fillColor: "#E0E0E0", margin: [0, 4, 0, 4] },
                          ]],
                        },
                        layout: "noBorders",
                        margin: [0, 2, 0, 2],
                      },
                    ],
                    fillColor: idx % 2 === 0 ? "white" : VC_BLUE_LIGHT,
                  },
                ];
              }),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#DDDDDD",
            vLineColor: () => "#DDDDDD",
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 20],
        },
      ] : []),

      // Rodapé informativo
      {
        table: { widths: ["*"], body: [[{ text: "", fillColor: "#DDDDDD", margin: [0, 1, 0, 1] }]] }, layout: "noBorders",
        margin: [0, 0, 0, 8],
      },
      {
        text: `Relatório gerado automaticamente pela Plataforma de Gestão do Lucid Data Governance em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
        fontSize: 8,
        color: VC_SUBTEXT,
        alignment: "center",
      },
    ],
  };

  return pdfDocToBuffer(docDefinition);
}

// ─── DOCX: Ata de Reunião ─────────────────────────────────────────────────────

function docxBlueHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        color: "1B3A8C",
        size: 26,
      }),
    ],
    spacing: { before: 240, after: 120 },
    border: {
      bottom: {
        color: "6DC23A",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
  });
}

function docxMetaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: "1B3A8C", size: 18 })] })],
        width: { size: 2400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "E8EDF8" },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 18 })] })],
        width: { size: 6000, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ],
  });
}

export async function generateMeetingMinutesDOCX(meetingId: number): Promise<Buffer> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error("Reunião não encontrada");

  const agenda = await getAgendaItems(meetingId);
  const invitesList = await getInvitesByMeeting(meetingId);
  const domain = meeting.domainId ? await getDomainById(meeting.domainId) : null;

  const confirmed = invitesList.filter((i) => i.status === "confirmado");
  const declined = invitesList.filter((i) => i.status === "recusado");
  const pending = invitesList.filter((i) => i.status === "pendente" || i.status === "talvez");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.SINGLE, color: "6DC23A", size: 6 },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.NONE },
                  insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: "LUCID DATA GOVERNANCE", bold: true, color: "FFFFFF", size: 22 }),
                            ],
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({ text: "Lucid Data Governance — Ata de Reunião", color: "C8D8F8", size: 16 }),
                            ],
                          }),
                        ],
                        shading: { type: ShadingType.CLEAR, fill: "1B3A8C" },
                        margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({ text: `Gerado em: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, color: "C8D8F8", size: 14 }),
                            ],
                          }),
                        ],
                        shading: { type: ShadingType.CLEAR, fill: "1B3A8C" },
                        margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Lucid Data Governance — Lucid Data Governance | Documento Confidencial | Página ", size: 16, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
                  new TextRun({ text: " de ", size: 16, color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Título
          new Paragraph({
            children: [
              new TextRun({ text: "ATA DE REUNIÃO", bold: true, color: "1B3A8C", size: 36 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: meeting.title, bold: true, size: 24, color: "333333" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
          }),

          // Informações da reunião
          docxBlueHeading("INFORMAÇÕES DA REUNIÃO"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              docxMetaRow("Título:", meeting.title),
              docxMetaRow("Data e Hora:", formatDate(meeting.scheduledAt)),
              docxMetaRow("Término:", meeting.endAt ? formatDate(meeting.endAt) : "—"),
              docxMetaRow("Tipo:", STATUS_LABELS[meeting.type ?? ""] ?? meeting.type ?? "—"),
              docxMetaRow("Status:", STATUS_LABELS[meeting.status ?? ""] ?? meeting.status ?? "—"),
              docxMetaRow("Local:", meeting.location ?? "—"),
              docxMetaRow("Domínio:", domain?.name ?? "—"),
              ...(meeting.meetingLink ? [docxMetaRow("Link:", meeting.meetingLink)] : []),
            ],
          }),

          // Descrição
          ...(meeting.description ? [
            docxBlueHeading("DESCRIÇÃO"),
            new Paragraph({
              children: [new TextRun({ text: meeting.description, size: 20 })],
              spacing: { after: 240 },
            }),
          ] : []),

          // Participantes
          docxBlueHeading(`PARTICIPANTES (${invitesList.length} convidados)`),
          ...(invitesList.length > 0 ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Nome", bold: true, color: "FFFFFF", size: 18 })] })],
                      shading: { type: ShadingType.CLEAR, fill: "1B3A8C" },
                      margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "E-mail", bold: true, color: "FFFFFF", size: 18 })] })],
                      shading: { type: ShadingType.CLEAR, fill: "1B3A8C" },
                      margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 18 })] })],
                      shading: { type: ShadingType.CLEAR, fill: "1B3A8C" },
                      margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    }),
                  ],
                }),
                ...invitesList.map((inv, idx) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: inv.participantName ?? "—", size: 18 })] })],
                        shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "FFFFFF" : "E8EDF8" },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                      }),
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: inv.email ?? "—", size: 16 })] })],
                        shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "FFFFFF" : "E8EDF8" },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                      }),
                      new TableCell({
                        children: [new Paragraph({
                          children: [new TextRun({
                            text: INVITE_STATUS_LABELS[inv.status ?? "pendente"] ?? "Pendente",
                            bold: true,
                            size: 18,
                            color: inv.status === "confirmado" ? "2D7A2D" : inv.status === "recusado" ? "C0392B" : "888888",
                          })],
                        })],
                        shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "FFFFFF" : "E8EDF8" },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                      }),
                    ],
                  })
                ),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Total: ${invitesList.length} convidados — ${confirmed.length} confirmados, ${declined.length} recusados, ${pending.length} pendentes`,
                  size: 16,
                  color: "555555",
                  italics: true,
                }),
              ],
              spacing: { before: 120, after: 240 },
            }),
          ] : [
            new Paragraph({
              children: [new TextRun({ text: "Nenhum participante registrado.", size: 20, color: "888888" })],
              spacing: { after: 240 },
            }),
          ]),

          // Pauta
          ...(agenda.length > 0 ? [
            docxBlueHeading("PAUTA"),
            ...agenda.flatMap((item, idx) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${idx + 1}. `, bold: true, color: "1B3A8C", size: 22 }),
                  new TextRun({ text: item.title, bold: true, size: 22 }),
                  ...(item.duration ? [new TextRun({ text: ` (${item.duration} min)`, size: 18, color: "888888" })] : []),
                ],
                spacing: { before: 120, after: 60 },
              }),
              ...(item.description ? [
                new Paragraph({
                  children: [new TextRun({ text: item.description, size: 18, color: "444444" })],
                  indent: { left: 360 },
                  spacing: { after: 120 },
                }),
              ] : []),
            ]),
          ] : []),

          // Ata
          ...(meeting.minutesContent ? [
            docxBlueHeading("REGISTRO DA REUNIÃO (ATA)"),
            new Paragraph({
              children: [new TextRun({ text: meeting.minutesContent, size: 20 })],
              spacing: { after: 240 },
            }),
          ] : []),

          // Decisões
          ...(meeting.decisionsContent ? [
            docxBlueHeading("DECISÕES"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: meeting.decisionsContent, size: 20 })] })],
                      shading: { type: ShadingType.CLEAR, fill: "FFF9E6" },
                      margins: { top: 120, bottom: 120, left: 160, right: 160 },
                      borders: {
                        top: { style: BorderStyle.SINGLE, color: "F0C040", size: 6 },
                        bottom: { style: BorderStyle.SINGLE, color: "F0C040", size: 6 },
                        left: { style: BorderStyle.SINGLE, color: "F0C040", size: 6 },
                        right: { style: BorderStyle.SINGLE, color: "F0C040", size: 6 },
                      },
                    }),
                  ],
                }),
              ],
            }),
          ] : []),

          // Encaminhamentos
          ...(meeting.actionsContent ? [
            docxBlueHeading("ENCAMINHAMENTOS / AÇÕES"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: meeting.actionsContent, size: 20 })] })],
                      shading: { type: ShadingType.CLEAR, fill: "E8F5E9" },
                      margins: { top: 120, bottom: 120, left: 160, right: 160 },
                      borders: {
                        top: { style: BorderStyle.SINGLE, color: "6DC23A", size: 6 },
                        bottom: { style: BorderStyle.SINGLE, color: "6DC23A", size: 6 },
                        left: { style: BorderStyle.SINGLE, color: "6DC23A", size: 6 },
                        right: { style: BorderStyle.SINGLE, color: "6DC23A", size: 6 },
                      },
                    }),
                  ],
                }),
              ],
            }),
          ] : []),

          // Assinaturas
          docxBlueHeading("ASSINATURAS"),
          new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 480 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "___________________________", color: "AAAAAA" })],
                        spacing: { after: 60 },
                      }),
                      new Paragraph({ children: [new TextRun({ text: "Facilitador / Secretário", size: 16, color: "888888" })] }),
                    ],
                    borders: {
                      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                    },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "___________________________", color: "AAAAAA" })],
                        spacing: { after: 60 },
                      }),
                      new Paragraph({ children: [new TextRun({ text: "Data Owner / Responsável", size: 16, color: "888888" })] }),
                    ],
                    borders: {
                      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                    },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "___________________________", color: "AAAAAA" })],
                        spacing: { after: 60 },
                      }),
                      new Paragraph({ children: [new TextRun({ text: "Aprovação", size: 16, color: "888888" })] }),
                    ],
                    borders: {
                      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ─── Upload para S3 e retorno de URL ─────────────────────────────────────────

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function exportMeetingMinutesPDF(meetingId: number, ctx?: ExportContext): Promise<string> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error("Reunião não encontrada");
  const buffer = await generateMeetingMinutesPDF(meetingId);
  const filename = `ata-reuniao-${meetingId}-${randomSuffix()}.pdf`;
  const key = `exports/${filename}`;
  const { url } = await storagePut(key, buffer, "application/pdf");
  await createExportHistory({
    documentType: "meeting_minutes_pdf",
    documentTitle: `Ata de Reunião: ${meeting.title}`,
    fileUrl: url,
    filename,
    fileFormat: "pdf",
    generatedBy: ctx?.generatedBy,
    generatedById: ctx?.generatedById,
    referenceId: meetingId,
    referenceName: meeting.title,
    fileSizeBytes: buffer.length,
  }).catch(() => {});
  return url;
}

export async function exportMeetingMinutesDOCX(meetingId: number, ctx?: ExportContext): Promise<string> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error("Reunião não encontrada");
  const buffer = await generateMeetingMinutesDOCX(meetingId);
  const filename = `ata-reuniao-${meetingId}-${randomSuffix()}.docx`;
  const key = `exports/${filename}`;
  const { url } = await storagePut(key, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await createExportHistory({
    documentType: "meeting_minutes_docx",
    documentTitle: `Ata de Reunião (Word): ${meeting.title}`,
    fileUrl: url,
    filename,
    fileFormat: "docx",
    generatedBy: ctx?.generatedBy,
    generatedById: ctx?.generatedById,
    referenceId: meetingId,
    referenceName: meeting.title,
    fileSizeBytes: buffer.length,
  }).catch(() => {});
  return url;
}

export async function exportOrganogramPDF(domainId: number, ctx?: ExportContext): Promise<string> {
  const domain = await getDomainById(domainId);
  if (!domain) throw new Error("Domínio não encontrado");
  const buffer = await generateOrganogramPDF(domainId);
  const filename = `organograma-dominio-${domainId}-${randomSuffix()}.pdf`;
  const key = `exports/${filename}`;
  const { url } = await storagePut(key, buffer, "application/pdf");
  await createExportHistory({
    documentType: "organogram_pdf",
    documentTitle: `Organograma: ${domain.name}`,
    fileUrl: url,
    filename,
    fileFormat: "pdf",
    generatedBy: ctx?.generatedBy,
    generatedById: ctx?.generatedById,
    referenceId: domainId,
    referenceName: domain.name,
    fileSizeBytes: buffer.length,
  }).catch(() => {});
  return url;
}

export async function exportMetricsReportPDF(ctx?: ExportContext): Promise<string> {
  const buffer = await generateMetricsReportPDF();
  const filename = `relatorio-metricas-${randomSuffix()}.pdf`;
  const key = `exports/${filename}`;
  const { url } = await storagePut(key, buffer, "application/pdf");
  const now = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  await createExportHistory({
    documentType: "metrics_report_pdf",
    documentTitle: `Relatório de Métricas — ${now}`,
    fileUrl: url,
    filename,
    fileFormat: "pdf",
    generatedBy: ctx?.generatedBy,
    generatedById: ctx?.generatedById,
    fileSizeBytes: buffer.length,
  }).catch(() => {});
  return url;
}

// ─── PDF: Manual do Administrador ────────────────────────────────────────────
export async function generateAdminManualPDF(): Promise<Buffer> {
  const sections = [
    {
      title: "1. Visão Geral da Plataforma",
      content: [
        "O Lucid Data Governance é uma plataforma de Governança de Dados Enterprise desenvolvida especificamente para organizações de grande porte. Ela centraliza o Catálogo de Dados, a Linhagem, a Qualidade, os Contratos de Dados e a conformidade LGPD em um único produto, acessível via navegador.",
        "Principais módulos: Catálogo de Dados, Motor de Qualidade, Linhagem com Impacto em Cascata, Simulador What-if, Data Contracts, Glossário de Negócios, Comitê e Reuniões, LGPD/DSAR/PIA, SLA, Webhooks, API REST v1 e Assistente de IA.",
      ],
    },
    {
      title: "2. Requisitos de Sistema",
      content: [
        "Docker 20.10+ e Docker Compose v2+",
        "Domínio público com registro DNS (para certificado SSL automático via Let's Encrypt)",
        "PostgreSQL 16+ (provisionado automaticamente via Docker Compose)",
        "Variável de ambiente DATABASE_URL configurada",
        "JWT_SECRET com valor aleatório de ao menos 32 caracteres",
        "Opcional: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET para SSO via Google",
        "Opcional: ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET / ENTRA_TENANT_ID para SSO via Microsoft",
        "Opcional: AZURE_OPENAI_ENDPOINT ou OLLAMA_BASE_URL para o Assistente de IA",
      ],
    },
    {
      title: "3. Instalação em 5 Minutos",
      content: [
        "1. Clone o repositório ou extraia o arquivo ZIP do sistema.",
        "2. Copie o arquivo env.example.txt para .env e preencha os valores obrigatórios (DATABASE_URL, JWT_SECRET, APP_DOMAIN).",
        "3. Execute: docker compose up -d",
        "4. Aguarde o health check (30 segundos) e acesse https://SEU_DOMINIO",
        "5. Crie o primeiro usuário (será automaticamente definido como Administrador).",
        "IMPORTANTE: Não exponha a porta 5432 (PostgreSQL) para a internet. O Caddy gerencia o SSL automaticamente.",
      ],
    },
    {
      title: "4. Gerenciamento de Usuários e Papéis (RBAC)",
      content: [
        "ADMIN: Acesso total — cria usuários, configura integrações, aprova glossários e contratos, visualiza log de auditoria.",
        "USER: Acesso de leitura e contribuição — pode criar pautas, solicitar acesso, preencher DSARs e interagir com o Assistente de IA.",
        "Como promover um usuário a Admin: acesse Configurações → Gestão de Papéis e altere o perfil do usuário desejado.",
        "SSO (Google/Microsoft): quando configurado, novos usuários entram automaticamente com perfil USER. O Admin deve promovê-los manualmente se necessário.",
      ],
    },
    {
      title: "5. Motor de Qualidade",
      content: [
        "O Motor de Qualidade executa verificações reais nos dados via Adaptadores (PostgreSQL, MySQL externo, SAP HANA, Databricks, Portal Nativo).",
        "Métricas suportadas: Completude (% de valores não nulos), Unicidade (% de valores únicos), Regex (validação por padrão).",
        "Configuração: acesse Qualidade → Regras e defina o limiar (threshold) para cada ativo.",
        "Agendamento automático: o scheduler executa scans a cada 6 horas. Configure QUALITY_CRON_EXPRESSION no .env para alterar.",
        "Webhooks: ao detectar falhas críticas, o sistema dispara o evento quality.violation para todos os endpoints configurados e ativos.",
      ],
    },
    {
      title: "6. Data Contracts e Proteção contra Breaking Changes",
      content: [
        "Contratos de Dados formalizam o acordo entre o Produtor e o Consumidor de um ativo.",
        "Status do ciclo de vida: Rascunho → Em Revisão → Ativo → Expirado.",
        "Trava automática: se um ativo possui contratos Ativos, o sistema bloqueia qualquer tentativa de renomear o ativo via API ou UI, protegendo os consumidores downstream.",
        "Para alterar um ativo com contrato ativo: expireo ou cancele o contrato primeiro, ou crie uma nova versão (ex: v2.0.0) do contrato com as mudanças acordadas com o consumidor.",
      ],
    },
    {
      title: "7. Webhooks e Integrações",
      content: [
        "Acesse Integrações → Webhooks para configurar endpoints externos (Slack, Teams, PagerDuty, etc.).",
        "Cada webhook possui um segredo (HMAC-SHA256) para verificação de autenticidade — valide o header X-Webhook-Signature no receptor.",
        "Eventos disponíveis: asset.created, asset.updated, asset.deleted, quality.violation, access_request.*, glossary.approved, sla.violation e * (todos).",
        "O Toggle (Ativar/Desativar) em cada webhook permite pausar notificações sem excluir a configuração.",
        "Histórico de entregas: cada entrega é registrada com status HTTP, payload e timestamp para diagnóstico.",
      ],
    },
    {
      title: "8. API REST Pública v1",
      content: [
        "Documentação Swagger: https://SEU_DOMINIO/api/v1/docs",
        "Autenticação: Bearer Token (API Key) no header Authorization.",
        "Criação de API Key: acesse Integrações → API Keys → Nova Chave e defina os escopos.",
        "Escopos disponíveis: assets:read, assets:write, glossary:read, quality:read, lineage:read.",
        "Rate limiting: 10 requisições/segundo por IP (configurável via Caddyfile).",
        "Endpoints principais: GET /api/v1/assets, GET /api/v1/glossary, GET /api/v1/lineage, GET /api/v1/quality-checks.",
      ],
    },
    {
      title: "9. Backup e Recuperação",
      content: [
        "Execute npm run backup:db para gerar um dump PostgreSQL (pg_dump) com timestamp.",
        "Os arquivos de backup são salvos em ./backups/ por padrão (configure BACKUP_DIR no .env).",
        "Automatize o backup diário com cron: 0 3 * * * cd /caminho/projeto && node scripts/backup-db.mjs",
        "Para restaurar: psql -U comite_user -d comite_dados -f ./backups/comite_dados_YYYY-MM-DD.sql",
        "Volumes Docker: os dados do PostgreSQL são persistidos em db_data. Faça backup também do volume Docker em ambientes críticos.",
      ],
    },
    {
      title: "10. Monitoramento e Observabilidade",
      content: [
        "Health Check: GET /api/health — retorna status, latência do banco e uptime.",
        "Métricas Prometheus: GET /api/metrics — integre com Grafana para dashboards de infraestrutura.",
        "Log de Auditoria: todas as ações de usuários e da IA são registradas com timestamp, IP e entidade modificada.",
        "Smoke Test pós-deploy: npm run smoke — valida health, OpenAPI e graceful shutdown.",
        "Testes E2E: npm run test:e2e — executa a suíte Playwright contra a instância local (requer app rodando).",
      ],
    },
  ];

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 90, 40, 60],
    header: () => pdfHeader("Manual do Administrador", "Versão 1.0 — Confidencial"),
    footer: (currentPage: number, pageCount: number) => pdfFooter(currentPage, pageCount),
    styles: pdfStyles,
    content: [
      { text: "Manual do Administrador", style: "sectionTitle", fontSize: 18, margin: [0, 0, 0, 4] },
      { text: "Plataforma de Governança de Dados — Lucid Data Governance VC", style: "bodyText", color: VC_SUBTEXT, margin: [0, 0, 0, 20] },

      ...sections.flatMap(section => [
        { text: section.title, style: "sectionTitle" },
        {
          ul: section.content.map(line => ({
            text: line,
            style: "bodyText",
            margin: [0, 2, 0, 2],
          })),
          margin: [0, 0, 0, 12],
        },
      ]),

      { text: "Suporte Técnico", style: "sectionTitle" },
      { text: "Para dúvidas técnicas, consulte a documentação Swagger em /api/v1/docs ou entre em contato com o time de Governança de Dados.", style: "bodyText" },
    ],
  };

  return pdfDocToBuffer(docDefinition);
}
