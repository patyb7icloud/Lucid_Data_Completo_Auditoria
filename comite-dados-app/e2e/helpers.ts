/**
 * E2E helpers — credenciais e seletores reutilizáveis
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@comite-dados.local";
export const ADMIN_PASS  = process.env.E2E_ADMIN_PASS  ?? "Admin@12345";

/** Faz login como admin e aguarda o dashboard carregar */
export async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASS);
  await page.getByRole("button", { name: /entrar/i }).click();
  // Dashboard deve aparecer após login bem-sucedido
  await page.waitForURL("**/", { timeout: 10_000 });
}
