import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Suite: API Health & Observabilidade
 * Valida os endpoints críticos de produção sem autenticação de UI.
 */
test.describe("Endpoints de Saúde e Observabilidade", () => {
  test("GET /api/health deve retornar status 200 e campo 'status: ok'", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });

  test("GET /api/prometheus deve retornar métricas em formato texto", async ({ request }) => {
    const res = await request.get("/api/prometheus");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("comite_dados_");
  });

  test("GET /api/v1/openapi.json deve retornar schema OpenAPI válido", async ({ request }) => {
    const res = await request.get("/api/v1/openapi.json");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("openapi");
    expect(body).toHaveProperty("paths");
  });

  test("GET /api/v1/assets sem token deve retornar 401", async ({ request }) => {
    const res = await request.get("/api/v1/assets");
    expect(res.status()).toBe(401);
  });
});

/**
 * Suite: Webhook e Integrações
 */
test.describe("Integrações e Segurança", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("deve exibir a página de Integrações com seção de Webhooks", async ({ page }) => {
    await page.goto("/integracoes");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /webhook|integraç/i })).toBeVisible();
  });

  test("deve exibir o Glossário de Negócios", async ({ page }) => {
    await page.goto("/glossario");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /glossário/i })).toBeVisible();
  });

  test("deve exibir a seção de Conformidade LGPD", async ({ page }) => {
    await page.goto("/lgpd");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /lgpd|compliance|conformidade/i })).toBeVisible();
  });

  test("deve exibir Data Contracts", async ({ page }) => {
    await page.goto("/contratos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /contrato/i })).toBeVisible();
  });
});
