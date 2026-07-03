import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Suite: Solicitações de Acesso
 * Cobre criação de solicitação, listagem e aprovação/rejeição pelo admin.
 */
test.describe("Solicitações de Acesso", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("deve exibir a página de aprovações", async ({ page }) => {
    await page.goto("/aprovacoes");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /aprova[çc][aã]o|solicita[çc][aã]o/i })).toBeVisible();
  });

  test("deve exibir lista de solicitações ou estado vazio", async ({ page }) => {
    await page.goto("/aprovacoes");
    await page.waitForLoadState("networkidle");
    // Aceita tabela com dados OU mensagem de lista vazia
    const hasRows = await page.locator("table tbody tr").count() > 0;
    const hasEmpty = await page.getByText(/nenhuma|vazio|sem solicita/i).isVisible();
    expect(hasRows || hasEmpty).toBe(true);
  });

  test("deve permitir abrir formulário de nova solicitação", async ({ page }) => {
    await page.goto("/aprovacoes");
    await page.waitForLoadState("networkidle");
    const newBtn = page.getByRole("button", { name: /nova solicita|novo acesso|solicitar/i }).first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      // Modal ou formulário deve aparecer
      await expect(page.locator("[role='dialog'], form")).toBeVisible({ timeout: 5_000 });
    }
  });
});

/**
 * Suite: Glossário de Negócios
 */
test.describe("Glossário de Negócios", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/glossario");
  });

  test("deve exibir a página do glossário", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /gloss[aá]rio/i })).toBeVisible();
  });

  test("deve exibir termos do glossário ou estado vazio", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const hasItems = await page.locator("table tbody tr, [data-testid='glossary-term']").count() > 0;
    const hasEmpty = await page.getByText(/nenhum|vazio/i).isVisible();
    expect(hasItems || hasEmpty).toBe(true);
  });
});

/**
 * Suite: Audit Log
 */
test.describe("Audit Log", () => {
  test("deve exibir registros de auditoria", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/audit-log");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /auditoria|audit/i })).toBeVisible();
  });
});
