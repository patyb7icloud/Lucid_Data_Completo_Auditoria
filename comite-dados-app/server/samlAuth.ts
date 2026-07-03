/**
 * samlAuth.ts
 * Suporte a SAML 2.0 Single Sign-On para integrações corporativas (Okta, Azure AD, ADFS, etc.)
 * Usa dynamic import de @node-saml/node-saml — instale com: npm install @node-saml/node-saml
 *
 * Configuração via organização (organizations.ssoMetadataUrl):
 *   - ssoMetadataUrl: URL pública do IdP metadata XML
 *   - allowSso: boolean para habilitar SSO na organização
 *
 * Rotas registradas:
 *   GET  /api/auth/saml/metadata   — SP metadata XML (para configurar o IdP)
 *   POST /api/auth/saml/login      — Redireciona para o IdP
 *   POST /api/auth/saml/acs        — Assertion Consumer Service (callback do IdP)
 */
import type { Express, Request, Response } from "express";
import { logger } from "./_core/logger";
import { signLocalSession } from "./localAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";

interface SamlConfig {
  callbackUrl: string;
  entryPoint: string;
  issuer: string;
  idpCert: string;
}

/** Tenta carregar @node-saml/node-saml dinamicamente */
async function loadSaml() {
  try {
    const mod = await import("@node-saml/node-saml");
    return mod.SAML || (mod as any).default?.SAML;
  } catch {
    return null;
  }
}

/** Lê metadados do IdP a partir da URL configurada na organização */
async function fetchIdpMetadata(metadataUrl: string): Promise<{ entryPoint: string; idpCert: string } | null> {
  try {
    const { default: https } = await import("https");
    const { default: http } = await import("http");
    const client = metadataUrl.startsWith("https") ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.get(metadataUrl, (res) => {
        let xml = "";
        res.on("data", (chunk: Buffer) => (xml += chunk.toString()));
        res.on("end", () => {
          // Extração simples de entryPoint e cert do XML de metadata
          const epMatch = xml.match(/SingleSignOnService[^>]+Location="([^"]+)"/);
          const certMatch = xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
          if (epMatch && certMatch) {
            resolve({ entryPoint: epMatch[1], idpCert: certMatch[1].trim() });
          } else {
            resolve(null);
          }
        });
        res.on("error", reject);
      });
      req.on("error", reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
    });
  } catch (err) {
    logger.error("saml.metadata_fetch_failed", { error: String(err) });
    return null;
  }
}

export function registerSamlRoutes(app: Express) {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3001";
  const spIssuer = process.env.SAML_SP_ISSUER ?? `${baseUrl}/api/auth/saml/metadata`;

  /** GET /api/auth/saml/metadata — retorna o SP metadata XML */
  app.get("/api/auth/saml/metadata", async (_req: Request, res: Response) => {
    res.set("Content-Type", "application/xml");
    res.send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${spIssuer}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${baseUrl}/api/auth/saml/acs"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`);
  });

  /** POST /api/auth/saml/login — inicia o fluxo SSO redirecionando para o IdP */
  app.post("/api/auth/saml/login", async (req: Request, res: Response) => {
    const SAML = await loadSaml();
    if (!SAML) {
      res.status(501).json({ error: "SAMLNotAvailable", message: "Instale @node-saml/node-saml para usar SSO SAML." });
      return;
    }

    // Busca a organização pelo domínio do e-mail ou host
    const orgs = await db.getOrganizations();
    const activeOrg = orgs.find((o: any) => o.allowSso && o.ssoMetadataUrl);
    if (!activeOrg) {
      res.status(400).json({ error: "SSONotConfigured", message: "SSO não habilitado para esta organização." });
      return;
    }

    const idp = await fetchIdpMetadata(activeOrg.ssoMetadataUrl as string);
    if (!idp) {
      res.status(502).json({ error: "MetadataFetchFailed", message: "Não foi possível obter o metadata do IdP." });
      return;
    }

    const samlConfig: SamlConfig = {
      callbackUrl: `${baseUrl}/api/auth/saml/acs`,
      entryPoint: idp.entryPoint,
      issuer: spIssuer,
      idpCert: idp.idpCert,
    };

    const saml = new SAML(samlConfig);
    try {
      const authorizeUrl = await saml.getAuthorizeUrlAsync("", "", {});
      res.redirect(authorizeUrl);
    } catch (err) {
      logger.error("saml.login_failed", { error: String(err) });
      res.status(500).json({ error: "SAMLError", message: "Erro ao iniciar SSO." });
    }
  });

  /** POST /api/auth/saml/acs — Assertion Consumer Service: processa a resposta do IdP */
  app.post("/api/auth/saml/acs", async (req: Request, res: Response) => {
    const SAML = await loadSaml();
    if (!SAML) {
      res.status(501).json({ error: "SAMLNotAvailable" });
      return;
    }

    const orgs = await db.getOrganizations();
    const activeOrg = orgs.find((o: any) => o.allowSso && o.ssoMetadataUrl);
    if (!activeOrg) {
      res.status(400).json({ error: "SSONotConfigured" });
      return;
    }

    const idp = await fetchIdpMetadata(activeOrg.ssoMetadataUrl as string);
    if (!idp) {
      res.status(502).json({ error: "MetadataFetchFailed" });
      return;
    }

    const saml = new SAML({
      callbackUrl: `${baseUrl}/api/auth/saml/acs`,
      entryPoint: idp.entryPoint,
      issuer: spIssuer,
      idpCert: idp.idpCert,
    } as any);

    try {
      const { profile } = await saml.validatePostResponseAsync(req.body);
      if (!profile?.nameID) {
        res.status(401).json({ error: "InvalidAssertion" });
        return;
      }

      const email = (profile.email as string) || profile.nameID;
      const name = (profile.displayName as string) || (profile.name as string) || email;

      // Busca ou provisiona o usuário na base local (Just-in-Time provisioning)
      let user = await db.getUserByEmail(email);
      if (!user) {
        user = await db.createUserViaSso({ email, name, orgId: activeOrg.id });
        logger.info("saml.jit_provisioning", { email, orgId: activeOrg.id });
      }
      if (!user) {
        res.status(500).json({ error: "UserProvisioningFailed" });
        return;
      }

      const token = await signLocalSession(user);
      const cookieOpts = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, cookieOpts);
      res.redirect("/");
    } catch (err) {
      logger.error("saml.acs_failed", { error: String(err) });
      res.status(401).json({ error: "SAMLValidationFailed", message: "Resposta SAML inválida." });
    }
  });
}
