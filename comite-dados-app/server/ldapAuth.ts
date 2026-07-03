/**
 * ldapAuth.ts
 * Autenticação via LDAP/Active Directory para ambientes corporativos.
 * Usa dynamic import de ldapjs — instale com: npm install ldapjs @types/ldapjs
 *
 * Configuração via connector_configs (type = 'ldap'):
 *   - host: hostname do servidor LDAP (ex: ldap.empresa.com)
 *   - port: porta (389 = LDAP, 636 = LDAPS)
 *   - baseDn: base DN de busca (ex: dc=empresa,dc=com)
 *   - bindDn: conta de serviço para bind (ex: cn=app,dc=empresa,dc=com)
 *   - bindPassword: senha da conta de serviço
 *   - userFilter: filtro LDAP para busca (ex: (sAMAccountName={{username}}))
 *   - useTls: true para LDAPS
 *
 * Rota registrada:
 *   POST /api/auth/ldap — { username, password } → JWT cookie
 */
import type { Express, Request, Response } from "express";
import { logger } from "./_core/logger";
import { signLocalSession } from "./localAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";

interface LdapConfig {
  host: string;
  port: number;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string; // ex: "(sAMAccountName={{username}})"
  useTls: boolean;
}

async function loadLdapjs() {
  try {
    const mod = await import("ldapjs");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/** Autentica um usuário contra o servidor LDAP */
async function authenticateWithLdap(config: LdapConfig, username: string, password: string): Promise<{ dn: string; email: string; name: string } | null> {
  const ldap = await loadLdapjs();
  if (!ldap) throw new Error("ldapjs não disponível — execute: npm install ldapjs");

  const url = `${config.useTls ? "ldaps" : "ldap"}://${config.host}:${config.port}`;
  const client = ldap.createClient({ url, tlsOptions: { rejectUnauthorized: !config.useTls } });

  return new Promise((resolve, reject) => {
    // 1. Bind com conta de serviço
    client.bind(config.bindDn, config.bindPassword, (bindErr) => {
      if (bindErr) {
        client.destroy();
        reject(new Error("LDAP service bind failed: " + bindErr.message));
        return;
      }

      // 2. Busca o usuário
      const filter = config.userFilter.replace("{{username}}", username.replace(/[*()\\\0]/g, "")); // sanitiza
      const searchOpts = { filter, scope: "sub" as const, attributes: ["dn", "mail", "cn", "displayName"] };

      client.search(config.baseDn, searchOpts, (searchErr, searchRes) => {
        if (searchErr) {
          client.destroy();
          reject(new Error("LDAP search failed: " + searchErr.message));
          return;
        }

        let userEntry: { dn: string; email: string; name: string } | null = null;

        searchRes.on("searchEntry", (entry) => {
          const attrs = Object.fromEntries(
            (entry.attributes ?? []).map((a: any) => [a.type, a.values?.[0] ?? ""])
          );
          userEntry = {
            dn: entry.dn.toString(),
            email: attrs.mail || `${username}@${config.host}`,
            name: attrs.displayName || attrs.cn || username,
          };
        });

        searchRes.on("end", () => {
          if (!userEntry) {
            client.destroy();
            resolve(null); // usuário não encontrado
            return;
          }

          // 3. Bind com credenciais do usuário para verificar senha
          client.bind(userEntry.dn, password, (userBindErr) => {
            client.destroy();
            if (userBindErr) {
              resolve(null); // senha inválida
            } else {
              resolve(userEntry);
            }
          });
        });

        searchRes.on("error", (err) => {
          client.destroy();
          reject(err);
        });
      });
    });
  });
}

export function registerLdapRoutes(app: Express) {
  /** POST /api/auth/ldap — autenticação LDAP/AD */
  app.post("/api/auth/ldap", async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "BadRequest", message: "username e password são obrigatórios." });
      return;
    }

    // Busca o conector LDAP configurado na primeira organização ativa
    const connectors = await db.getConnectorConfigs();
    const ldapConn = connectors.find((c: any) => c.type === "ldap" && c.enabled);
    if (!ldapConn) {
      res.status(400).json({ error: "LDAPNotConfigured", message: "Nenhum conector LDAP habilitado." });
      return;
    }

    const cfg = typeof ldapConn.configJson === 'string' ? JSON.parse(ldapConn.configJson) as LdapConfig : ldapConn.configJson as LdapConfig;
    if (!cfg?.host || !cfg?.baseDn) {
      res.status(500).json({ error: "LDAPConfigInvalid", message: "Configuração LDAP incompleta." });
      return;
    }

    try {
      const ldapUser = await authenticateWithLdap(cfg, username, password);
      if (!ldapUser) {
        // Pequeno delay para mitigar timing attacks
        await new Promise((r) => setTimeout(r, 300));
        res.status(401).json({ error: "InvalidCredentials", message: "Usuário ou senha inválidos." });
        return;
      }

      // JIT provisioning — cria o usuário local se não existir
      let user = await db.getUserByEmail(ldapUser.email);
      if (!user) {
        user = await db.createUserViaSso({ email: ldapUser.email, name: ldapUser.name });
        logger.info("ldap.jit_provisioning", { email: ldapUser.email });
      }
      if (!user) {
        res.status(500).json({ error: "UserProvisioningFailed", message: "Não foi possível criar o usuário." });
        return;
      }

      const token = await signLocalSession(user);
      const cookieOpts = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, cookieOpts);
      res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      logger.error("ldap.auth_error", { error: String(err) });
      res.status(500).json({ error: "LDAPError", message: "Erro de comunicação com o servidor LDAP." });
    }
  });
}
