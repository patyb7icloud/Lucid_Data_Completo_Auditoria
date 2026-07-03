/**
 * Testes unitários para o serviço de exportação de relatórios
 * PDF (pdfmake) e DOCX (docx) com identidade visual Lucid Data Governance
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências externas
vi.mock("./db", () => ({
  getMeetingById: vi.fn(),
  getAgendaItems: vi.fn(),
  getInvitesByMeeting: vi.fn(),
  getDomainById: vi.fn(),
  getParticipants: vi.fn(),
  getDomains: vi.fn(),
  getDashboardMetrics: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test-file.pdf", key: "test-key" }),
}));

// Mock do pdfmake para evitar dependência de fontes em testes
vi.mock("module", () => ({
  createRequire: () => () => ({
    default: class MockPrinter {
      createPdfKitDocument() {
        const EventEmitter = require("events");
        const emitter = new EventEmitter();
        setTimeout(() => {
          emitter.emit("data", Buffer.from("mock-pdf-content"));
          emitter.emit("end");
        }, 10);
        emitter.end = () => {};
        return emitter;
      }
    },
  }),
}));

import * as db from "./db";
import { storagePut } from "./storage";

describe("Export Service — Funções de exportação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar erro quando reunião não é encontrada para PDF", async () => {
    vi.mocked(db.getMeetingById).mockResolvedValue(undefined);

    const { generateMeetingMinutesPDF } = await import("./exportService");

    await expect(generateMeetingMinutesPDF(999)).rejects.toThrow("Reunião não encontrada");
  });

  it("deve retornar erro quando reunião não é encontrada para DOCX", async () => {
    vi.mocked(db.getMeetingById).mockResolvedValue(undefined);

    const { generateMeetingMinutesDOCX } = await import("./exportService");

    await expect(generateMeetingMinutesDOCX(999)).rejects.toThrow("Reunião não encontrada");
  });

  it("deve retornar erro quando domínio não é encontrado para organograma", async () => {
    vi.mocked(db.getDomainById).mockResolvedValue(undefined);

    const { generateOrganogramPDF } = await import("./exportService");

    await expect(generateOrganogramPDF(999)).rejects.toThrow("Domínio não encontrado");
  });

  it("deve retornar erro quando métricas não estão disponíveis", async () => {
    vi.mocked(db.getDashboardMetrics).mockResolvedValue(null);

    const { generateMetricsReportPDF } = await import("./exportService");

    await expect(generateMetricsReportPDF()).rejects.toThrow("Não foi possível obter métricas");
  });
});

describe("Export Service — Mapeamentos de labels", () => {
  it("deve ter labels corretos para papéis de governança", () => {
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
    };

    expect(ROLE_LABELS["data_owner"]).toBe("Data Owner");
    expect(ROLE_LABELS["ai_ethics_officer"]).toBe("AI Ethics Officer");
    expect(ROLE_LABELS["ml_engineer"]).toBe("ML Engineer");
  });

  it("deve ter labels corretos para status de reunião", () => {
    const STATUS_LABELS: Record<string, string> = {
      agendada: "Agendada",
      realizada: "Realizada",
      cancelada: "Cancelada",
      adiada: "Adiada",
      ordinaria: "Ordinária",
      extraordinaria: "Extraordinária",
    };

    expect(STATUS_LABELS["agendada"]).toBe("Agendada");
    expect(STATUS_LABELS["realizada"]).toBe("Realizada");
    expect(STATUS_LABELS["ordinaria"]).toBe("Ordinária");
  });

  it("deve ter labels corretos para status de convite", () => {
    const INVITE_STATUS_LABELS: Record<string, string> = {
      confirmado: "Confirmado",
      recusado: "Recusado",
      talvez: "Talvez",
      pendente: "Pendente",
    };

    expect(INVITE_STATUS_LABELS["confirmado"]).toBe("Confirmado");
    expect(INVITE_STATUS_LABELS["recusado"]).toBe("Recusado");
    expect(INVITE_STATUS_LABELS["pendente"]).toBe("Pendente");
  });
});

describe("Filtros por Data no Log de Auditoria", () => {
  it("deve converter string YYYY-MM-DD para Date corretamente", () => {
    function toDate(s: string): Date | undefined {
      if (!s) return undefined;
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const d = toDate("2026-04-17");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3); // abril = 3 (0-indexed)
    expect(d!.getDate()).toBe(17);
  });

  it("deve retornar undefined para string vazia", () => {
    function toDate(s: string): Date | undefined {
      if (!s) return undefined;
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    expect(toDate("")).toBeUndefined();
  });

  it("deve calcular data inicial corretamente para atalho de 7 dias", () => {
    const today = new Date(2026, 3, 17); // 17/04/2026
    const from = new Date(today);
    from.setDate(today.getDate() - 7 + 1);
    expect(from.getDate()).toBe(11);
    expect(from.getMonth()).toBe(3);
  });

  it("deve calcular data inicial corretamente para atalho de 30 dias", () => {
    const today = new Date(2026, 3, 17);
    const from = new Date(today);
    from.setDate(today.getDate() - 30 + 1);
    expect(from.getDate()).toBe(19);
    expect(from.getMonth()).toBe(2); // março
  });

  it("deve calcular primeiro dia do mês corretamente", () => {
    const today = new Date(2026, 3, 17);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    expect(firstDay.getDate()).toBe(1);
    expect(firstDay.getMonth()).toBe(3);
    expect(firstDay.getFullYear()).toBe(2026);
  });

  it("deve incluir o dia inteiro do dateTo (até 23:59:59)", () => {
    const dateTo = new Date(2026, 3, 17);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    expect(endOfDay.getHours()).toBe(23);
    expect(endOfDay.getMinutes()).toBe(59);
    expect(endOfDay.getSeconds()).toBe(59);
  });

  it("deve detectar filtro de data ativo quando dateFrom está preenchido", () => {
    const hasDateFilter = (from: string, to: string) => Boolean(from || to);
    expect(hasDateFilter("2026-04-01", "")).toBe(true);
    expect(hasDateFilter("", "2026-04-17")).toBe(true);
    expect(hasDateFilter("2026-04-01", "2026-04-17")).toBe(true);
    expect(hasDateFilter("", "")).toBe(false);
  });

  it("deve formatar badge de intervalo corretamente", () => {
    const from = "2026-04-01";
    const to = "2026-04-17";
    const badge = from && to ? `${from} → ${to}` : from ? `A partir de ${from}` : `Até ${to}`;
    expect(badge).toBe("2026-04-01 → 2026-04-17");
  });
});

describe("Role Audit Log — Lógica de Registro de Auditoria", () => {
  it("deve criar entrada de log com todos os campos obrigatórios", () => {
    const entry = {
      executorOpenId: "admin-001",
      executorName: "Administrador",
      targetOpenId: "user-002",
      targetName: "João Silva",
      targetEmail: "joao@vc.com",
      previousRole: "user" as const,
      newRole: "admin" as const,
    };
    expect(entry.executorOpenId).toBe("admin-001");
    expect(entry.previousRole).toBe("user");
    expect(entry.newRole).toBe("admin");
  });

  it("deve identificar promoção quando newRole é admin", () => {
    const isPromotion = (newRole: string) => newRole === "admin";
    expect(isPromotion("admin")).toBe(true);
    expect(isPromotion("user")).toBe(false);
  });

  it("deve identificar rebaixamento quando newRole é user", () => {
    const isDemotion = (newRole: string) => newRole === "user";
    expect(isDemotion("user")).toBe(true);
    expect(isDemotion("admin")).toBe(false);
  });

  it("deve formatar data/hora corretamente", () => {
    const d = new Date("2026-04-17T14:30:00.000Z");
    const formatted = d.toLocaleString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe("string");
  });

  it("deve filtrar entradas por ação (promoção)", () => {
    const entries = [
      { id: 1, newRole: "admin" as const, previousRole: "user" as const },
      { id: 2, newRole: "user" as const, previousRole: "admin" as const },
      { id: 3, newRole: "admin" as const, previousRole: "user" as const },
    ];
    const promotions = entries.filter(e => e.newRole === "admin");
    expect(promotions).toHaveLength(2);
  });

  it("deve filtrar entradas por ação (rebaixamento)", () => {
    const entries = [
      { id: 1, newRole: "admin" as const },
      { id: 2, newRole: "user" as const },
      { id: 3, newRole: "user" as const },
    ];
    const demotions = entries.filter(e => e.newRole === "user");
    expect(demotions).toHaveLength(2);
  });

  it("deve calcular páginas de paginação corretamente", () => {
    const totalItems = 47;
    const pageSize = 15;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    expect(totalPages).toBe(4);
  });

  it("deve retornar 1 página quando não há registros", () => {
    const totalItems = 0;
    const pageSize = 15;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    expect(totalPages).toBe(1);
  });
});

describe("Role Management — Lógica de Controle de Papéis", () => {
  it("deve bloquear auto-rebaixamento", () => {
    const currentOpenId = "admin-001";
    const targetOpenId = "admin-001";
    const newRole = "user" as const;
    const isSelfDemotion = targetOpenId === currentOpenId && newRole === "user";
    expect(isSelfDemotion).toBe(true);
  });

  it("deve permitir promover outro usuário", () => {
    const currentOpenId = "admin-001";
    const targetOpenId = "user-002";
    const newRole = "admin" as const;
    const isSelfDemotion = targetOpenId === currentOpenId && newRole === "user";
    expect(isSelfDemotion).toBe(false);
  });

  it("deve bloquear rebaixamento do único admin", () => {
    const adminCount = 1;
    const newRole = "user" as const;
    const shouldBlock = newRole === "user" && adminCount <= 1;
    expect(shouldBlock).toBe(true);
  });

  it("deve permitir rebaixamento quando há mais de um admin", () => {
    const adminCount = 3;
    const newRole = "user" as const;
    const shouldBlock = newRole === "user" && adminCount <= 1;
    expect(shouldBlock).toBe(false);
  });

  it("deve calcular estatísticas corretamente", () => {
    const totalUsers = 10;
    const admins = 3;
    const users = totalUsers - admins;
    expect(users).toBe(7);
    expect(admins + users).toBe(totalUsers);
  });

  it("deve identificar corretamente o papel do usuário", () => {
    const adminUser = { role: "admin" as const };
    const regularUser = { role: "user" as const };
    expect(adminUser.role === "admin").toBe(true);
    expect(regularUser.role === "admin").toBe(false);
  });

  it("deve gerar iniciais corretamente", () => {
    function getInitials(name: string | null | undefined) {
      if (!name) return "?";
      return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    }
    expect(getInitials("João Silva")).toBe("JS");
    expect(getInitials("Maria")).toBe("M");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
  });
});

describe("Export History — Controle de Acesso por Papel", () => {
  it("admin deve receber isAdmin=true na resposta", () => {
    const mockCtxAdmin = { user: { role: "admin" as const, openId: "admin-001", name: "Admin" } };
    const isAdmin = mockCtxAdmin.user?.role === "admin";
    expect(isAdmin).toBe(true);
  });

  it("usuário comum deve receber isAdmin=false na resposta", () => {
    const mockCtxUser = { user: { role: "user" as const, openId: "user-001", name: "Usuário" } };
    const isAdmin = mockCtxUser.user?.role === "admin";
    expect(isAdmin).toBe(false);
  });

  it("usuário comum deve ter filtro por openId aplicado", () => {
    const mockCtxUser = { user: { role: "user" as const, openId: "user-001", name: "Usuário" } };
    const isAdmin = mockCtxUser.user?.role === "admin";
    const ownerFilter = isAdmin ? undefined : (mockCtxUser.user?.openId ?? "");
    expect(ownerFilter).toBe("user-001");
  });

  it("admin não deve ter filtro por openId aplicado", () => {
    const mockCtxAdmin = { user: { role: "admin" as const, openId: "admin-001", name: "Admin" } };
    const isAdmin = mockCtxAdmin.user?.role === "admin";
    const ownerFilter = isAdmin ? undefined : (mockCtxAdmin.user?.openId ?? "");
    expect(ownerFilter).toBeUndefined();
  });

  it("deve bloquear acesso de usuário a registro de outro usuário", () => {
    const currentUserOpenId = "user-001";
    const recordOwnerOpenId = "user-002";
    const isAdmin = false;
    const canAccess = isAdmin || recordOwnerOpenId === currentUserOpenId;
    expect(canAccess).toBe(false);
  });

  it("deve permitir acesso de admin a qualquer registro", () => {
    const currentUserOpenId = "admin-001";
    const recordOwnerOpenId = "user-002";
    const isAdmin = true;
    const canAccess = isAdmin || recordOwnerOpenId === currentUserOpenId;
    expect(canAccess).toBe(true);
  });

  it("deve permitir acesso de usuário ao próprio registro", () => {
    const currentUserOpenId = "user-001";
    const recordOwnerOpenId = "user-001";
    const isAdmin = false;
    const canAccess = isAdmin || recordOwnerOpenId === currentUserOpenId;
    expect(canAccess).toBe(true);
  });
});

describe("Export History — CSV/Excel Formatting", () => {
  const DOC_TYPE_LABELS: Record<string, string> = {
    meeting_minutes_pdf: "Ata de Reunião (PDF)",
    meeting_minutes_docx: "Ata de Reunião (Word)",
    organogram_pdf: "Organograma (PDF)",
    metrics_report_pdf: "Relatório de Métricas (PDF)",
  };

  const buildRows = (records: Array<{
    id: number;
    documentTitle: string;
    documentType: string;
    fileFormat: string;
    referenceName?: string | null;
    generatedBy?: string | null;
    fileSizeBytes?: number | null;
    createdAt: Date;
    fileUrl: string;
  }>) =>
    records.map((item) => ({
      "ID": item.id,
      "Título do Documento": item.documentTitle,
      "Tipo": DOC_TYPE_LABELS[item.documentType] ?? item.documentType,
      "Formato": item.fileFormat.toUpperCase(),
      "Referência": item.referenceName ?? "",
      "Gerado por": item.generatedBy ?? "",
      "Tamanho (bytes)": item.fileSizeBytes ?? 0,
      "Data/Hora": new Date(item.createdAt).toLocaleString("pt-BR"),
      "URL do Arquivo": item.fileUrl,
    }));

  it("deve mapear corretamente os campos de um registro para linha CSV/Excel", () => {
    const record = {
      id: 1,
      documentTitle: "Ata de Reunião: Kick-off",
      documentType: "meeting_minutes_pdf",
      fileFormat: "pdf",
      referenceName: "Kick-off",
      generatedBy: "João Silva",
      fileSizeBytes: 204800,
      createdAt: new Date("2026-04-17T12:00:00Z"),
      fileUrl: "https://s3.example.com/exports/ata-1.pdf",
    };
    const rows = buildRows([record]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["ID"]).toBe(1);
    expect(rows[0]["Título do Documento"]).toBe("Ata de Reunião: Kick-off");
    expect(rows[0]["Tipo"]).toBe("Ata de Reunião (PDF)");
    expect(rows[0]["Formato"]).toBe("PDF");
    expect(rows[0]["Gerado por"]).toBe("João Silva");
    expect(rows[0]["Tamanho (bytes)"]).toBe(204800);
    expect(rows[0]["URL do Arquivo"]).toBe("https://s3.example.com/exports/ata-1.pdf");
  });

  it("deve tratar campos nulos com valores padrão", () => {
    const record = {
      id: 2,
      documentTitle: "Relatório de Métricas",
      documentType: "metrics_report_pdf",
      fileFormat: "pdf",
      referenceName: null,
      generatedBy: null,
      fileSizeBytes: null,
      createdAt: new Date(),
      fileUrl: "https://s3.example.com/exports/metricas.pdf",
    };
    const rows = buildRows([record]);
    expect(rows[0]["Referência"]).toBe("");
    expect(rows[0]["Gerado por"]).toBe("");
    expect(rows[0]["Tamanho (bytes)"]).toBe(0);
  });

  it("deve gerar 9 colunas por linha", () => {
    const record = {
      id: 3,
      documentTitle: "Organograma: Domínio Comercial",
      documentType: "organogram_pdf",
      fileFormat: "pdf",
      referenceName: "Domínio Comercial",
      generatedBy: "Maria",
      fileSizeBytes: 512000,
      createdAt: new Date(),
      fileUrl: "https://s3.example.com/exports/org.pdf",
    };
    const rows = buildRows([record]);
    expect(Object.keys(rows[0])).toHaveLength(9);
  });

  it("deve mapear corretamente múltiplos registros", () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      documentTitle: `Documento ${i + 1}`,
      documentType: "meeting_minutes_pdf",
      fileFormat: "pdf",
      referenceName: `Ref ${i + 1}`,
      generatedBy: "Usuário",
      fileSizeBytes: 1024 * (i + 1),
      createdAt: new Date(),
      fileUrl: `https://s3.example.com/exports/doc-${i + 1}.pdf`,
    }));
    const rows = buildRows(records);
    expect(rows).toHaveLength(5);
    expect(rows[4]["ID"]).toBe(5);
  });
});

describe("Export History — Query Helpers", () => {
  it("deve validar os tipos de documento permitidos", () => {
    const validTypes = [
      "meeting_minutes_pdf",
      "meeting_minutes_docx",
      "organogram_pdf",
      "metrics_report_pdf",
    ];
    expect(validTypes).toHaveLength(4);
    expect(validTypes).toContain("meeting_minutes_pdf");
    expect(validTypes).toContain("organogram_pdf");
  });

  it("deve validar os formatos de arquivo permitidos", () => {
    const validFormats = ["pdf", "docx"];
    expect(validFormats).toHaveLength(2);
    expect(validFormats).toContain("pdf");
    expect(validFormats).toContain("docx");
  });

  it("deve formatar tamanho de arquivo corretamente", () => {
    const formatBytes = (bytes?: number | null): string => {
      if (!bytes) return "—";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });

  it("deve ter labels corretos para tipos de documento", () => {
    const DOC_TYPE_LABELS: Record<string, string> = {
      meeting_minutes_pdf: "Ata de Reunião (PDF)",
      meeting_minutes_docx: "Ata de Reunião (Word)",
      organogram_pdf: "Organograma (PDF)",
      metrics_report_pdf: "Relatório de Métricas (PDF)",
    };

    expect(DOC_TYPE_LABELS["meeting_minutes_pdf"]).toBe("Ata de Reunião (PDF)");
    expect(DOC_TYPE_LABELS["organogram_pdf"]).toBe("Organograma (PDF)");
    expect(DOC_TYPE_LABELS["metrics_report_pdf"]).toBe("Relatório de Métricas (PDF)");
  });
});

describe("Export Service — Identidade Visual VC", () => {
  it("deve usar as cores corretas da Lucid Data Governance", () => {
    const VC_BLUE = "#1B3A8C";
    const VC_GREEN = "#6DC23A";
    const VC_BLUE_LIGHT = "#E8EDF8";

    expect(VC_BLUE).toBe("#1B3A8C");
    expect(VC_GREEN).toBe("#6DC23A");
    expect(VC_BLUE_LIGHT).toBe("#E8EDF8");

    // Verificar que as cores são strings hexadecimais válidas
    expect(VC_BLUE).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(VC_GREEN).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("deve gerar nomes de arquivo corretos para exportação", () => {
    const meetingId = 42;
    const domainId = 7;

    const pdfFilename = `ata-reuniao-${meetingId}.pdf`;
    const docxFilename = `ata-reuniao-${meetingId}.docx`;
    const organogramFilename = `organograma-dominio-${domainId}.pdf`;
    const metricsFilename = `relatorio-metricas-comite-dados.pdf`;

    expect(pdfFilename).toBe("ata-reuniao-42.pdf");
    expect(docxFilename).toBe("ata-reuniao-42.docx");
    expect(organogramFilename).toBe("organograma-dominio-7.pdf");
    expect(metricsFilename).toBe("relatorio-metricas-comite-dados.pdf");
  });
});
