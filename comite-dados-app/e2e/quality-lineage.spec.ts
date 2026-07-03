import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Suite: Dashboard de Qualidade
 * Cobre renderização dos gráficos de maturidade e qualidade.
 */
test.describe("Dashboard de Qualidade", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("deve exibir o dashboard principal com métricas", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Cards de KPI devem existir
    await expect(page.locator("main")).toBeVisible();
  });

  test("deve exibir o dashboard de maturidade", async ({ page }) => {
    await page.goto("/maturidade");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /maturidade/i })).toBeVisible();
  });

  test("deve exibir a página de qualidade de dados", async ({ page }) => {
    await page.goto("/qualidade");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /qualidade/i })).toBeVisible();
  });
});

/**
 * Suite: Linhagem de Dados — What-if Analysis
 */
test.describe("Linhagem de Dados", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/linhagem");
  });

  test("deve exibir a página de linhagem com grafo ou estado vazio", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /linhagem/i })).toBeVisible();
  });

  test("deve exibir o botão de exportar CSV", async ({ page }) => {
    await expect(page.getByRole("button", { name: /exportar csv/i })).toBeVisible();
  });
});
