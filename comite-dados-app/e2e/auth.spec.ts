import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASS } from "./helpers";

/**
 * Suite: Autenticação
 * Cobre login local, erro com credencial inválida e logout.
 */
test.describe("Autenticação", () => {
  test("deve exibir a página de login com logo e campos", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /comitê de dados/i })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("deve rejeitar credenciais inválidas com mensagem de erro", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("invalido@teste.com");
    await page.getByLabel("Senha").fill("senhaerrada");
    await page.getByRole("button", { name: /entrar/i }).click();
    // Espera toast de erro aparecer
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 5_000 });
  });

  test("deve fazer login com sucesso e redirecionar para o dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });

  test("deve fazer logout e retornar à tela de login", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill(ADMIN_PASS);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL("**/", { timeout: 10_000 });

    // Logout via fetch direto (compatível com qualquer layout de sidebar)
    await page.request.post("/api/auth/logout");
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });
});
