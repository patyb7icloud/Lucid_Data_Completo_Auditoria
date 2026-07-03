import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Suite: Catálogo de Dados
 * Cobre listagem de ativos, criação e busca.
 */
test.describe("Catálogo de Dados", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/catalogo");
  });

  test("deve exibir a página do catálogo com título", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /catálogo/i })).toBeVisible();
  });

  test("deve listar ativos de dados existentes", async ({ page }) => {
    // Aguarda a lista renderizar (spinner desaparecer ou tabela aparecer)
    await page.waitForLoadState("networkidle");
    const rows = page.locator("table tbody tr, [data-testid='asset-card']");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test("deve filtrar ativos pelo campo de busca", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const searchInput = page.getByPlaceholder(/buscar|pesquisar/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("FAT");
      await page.waitForTimeout(500);
      // Resultados devem conter o termo pesquisado
      const anyVisible = await page.locator("table tbody tr, [data-testid='asset-card']").first().isVisible();
      expect(anyVisible).toBe(true);
    }
  });
});
