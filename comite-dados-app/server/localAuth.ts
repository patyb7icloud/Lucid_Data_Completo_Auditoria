/**
 * localAuth.ts
 * Sistema de autenticação local independente do Manus.
 * Suporta login com e-mail + senha (bcrypt) e, opcionalmente,
 * Microsoft Entra ID (OIDC) quando ENTRA_CLIENT_ID está configurado.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import type { User } from "../drizzle/schema";

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function getSecretKey() {
  const secret = ENV.cookieSecret;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters long");
  }
  return new TextEncoder().encode(secret);
}

export async function signLocalSession(user: User): Promise<string> {
  const secretKey = getSecretKey();
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ openId: user.openId, name: user.name ?? "", role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(secretKey);
}

export async function verifyLocalSession(
  cookieValue: string | undefined | null
): Promise<{ openId: string; name: string; role: string } | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { openId, name, role } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || !openId) return null;
    return { openId, name: String(name ?? ""), role: String(role ?? "user") };
  } catch {
    return null;
  }
}

// ─── Password helpers ─────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── authenticateRequest (replaces sdk.authenticateRequest) ──────────────────

import { parse as parseCookieHeader } from "cookie";
import { ForbiddenError } from "@shared/_core/errors";

export async function authenticateRequest(req: Request): Promise<User> {
  const cookieHeader = req.headers.cookie;
  const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
  const sessionCookie = cookies[COOKIE_NAME];

  const session = await verifyLocalSession(sessionCookie);
  if (!session) throw ForbiddenError("Invalid or missing session");

  const user = await db.getUserByOpenId(session.openId);
  if (!user) throw ForbiddenError("User not found");

  // Update lastSignedIn asynchronously — don't block the request
  db.upsertUser({ openId: user.openId, lastSignedIn: new Date() }).catch(() => {});

  return user;
}

// ─── Validação de força de senha ──────────────────────────────────────────────

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (typeof password !== "string" || password.length < 8) {
    return { valid: false, message: "A senha deve ter no mínimo 8 caracteres." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra maiúscula." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra minúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um número." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um caractere especial (ex: @, #, !, %)." };
  }
  return { valid: true };
}

// ─── Rate limiting para rotas de autenticação ────────────────────────────────

const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT_MAX = 10;        // 10 tentativas
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000; // 15 minutos

function authRateLimit(req: Request, res: Response, next: () => void) {
  // Use req.ip (set by Express when trust proxy is configured) as the primary
  // source of the client IP. Only fall back to X-Forwarded-For when req.ip is
  // unavailable, preventing clients from bypassing the limit by forging headers.
  const ip = req.ip ?? (req.headers["x-forwarded-for"] as string | undefined ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const entry = authRateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    authRateLimitStore.set(ip, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= AUTH_RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({ error: "Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente." });
    return;
  }
  entry.count++;
  next();
}

// Limpa entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authRateLimitStore.entries()) {
    if (now > val.resetAt) authRateLimitStore.delete(key);
  }
}, 5 * 60_000);

// ─── Express REST routes for local auth ──────────────────────────────────────

export function registerLocalAuthRoutes(app: Express) {
  // POST /api/auth/register
  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required" });
      return;
    }

    const pwCheck = validatePasswordStrength(String(password));
    if (!pwCheck.valid) {
      res.status(400).json({ error: pwCheck.message });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    try {
      // Check if email already exists
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "E-mail already registered" });
        return;
      }

      const openId = `local_${nanoid(16)}`;
      const passwordHash = await hashPassword(password);

      // First user becomes admin automatically
      const userCount = await db.countUsers();
      const role = userCount === 0 ? "admin" : "user";

      await db.upsertUser({
        openId,
        name: String(name),
        email: String(email),
        passwordHash,
        loginMethod: "local",
        lastSignedIn: new Date(),
        role,
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("Failed to create user");

      // Audit log the registration
      await db.createAuditLog({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: "create",
        entity: "user",
        entityId: user.id,
        entityName: user.name ?? user.email,
        details: { method: "local", role: user.role },
        ipAddress: (req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown").split(",")[0].trim(),
        userAgent: req.headers["user-agent"],
      }).catch(() => {});

      const token = await signLocalSession(user);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error: any) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", authRateLimit, async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        // Constant-time response to prevent user enumeration
        await bcrypt.hash("dummy", 1);
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const valid = await verifyPassword(String(password), user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      // Audit log the login
      await db.createAuditLog({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: "login",
        entity: "user",
        entityId: user.id,
        entityName: user.name ?? user.email,
        ipAddress: (req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown").split(",")[0].trim(),
        userAgent: req.headers["user-agent"],
      }).catch(() => {});

      const token = await signLocalSession(user);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        mustChangePassword: (user as any).mustChangePassword === true || (user as any).mustChangePassword === 1,
      });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    // Audit log before clearing cookie if possible
    try {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
      const sessionCookie = cookies[COOKIE_NAME];
      const session = await verifyLocalSession(sessionCookie);
      
      if (session) {
        const user = await db.getUserByOpenId(session.openId);
        if (user) {
          await db.createAuditLog({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            action: "logout",
            entity: "user",
            entityId: user.id,
            entityName: user.name ?? user.email,
            ipAddress: (req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown").split(",")[0].trim(),
            userAgent: req.headers["user-agent"],
          });
        }
      }
    } catch (err) {
      // Ignora erro no log de logout
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // POST /api/auth/change-password — troca de senha autenticada (first-login ou voluntária)
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
      const sessionCookie = cookies[COOKIE_NAME];

      const session = await verifyLocalSession(sessionCookie);
      if (!session) {
        res.status(401).json({ error: "Não autenticado." });
        return;
      }
      const { currentPassword, newPassword } = req.body ?? {};
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "currentPassword e newPassword são obrigatórios." });
        return;
      }
      const pwCheck = validatePasswordStrength(String(newPassword));
      if (!pwCheck.valid) {
        res.status(400).json({ error: pwCheck.message });
        return;
      }
      const user = await db.getUserByOpenId(session.openId);
      if (!user || !user.passwordHash) {
        res.status(400).json({ error: "Usuário não encontrado ou sem senha local." });
        return;
      }
      const valid = await verifyPassword(String(currentPassword), user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Senha atual incorreta." });
        return;
      }
      const newHash = await hashPassword(String(newPassword));
      await db.upsertUser({ openId: user.openId, passwordHash: newHash, mustChangePassword: false } as any);

      // Audit log the password change
      await db.createAuditLog({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: "update",
        entity: "user",
        entityId: user.id,
        entityName: user.name ?? user.email,
        details: { action: "password_change" },
        ipAddress: (req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown").split(",")[0].trim(),
        userAgent: req.headers["user-agent"],
      }).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] change-password failed:", err);
      res.status(500).json({ error: "Erro ao alterar senha." });
    }
  });

  // ─── Optional: Microsoft Entra ID (OIDC) ─────────────────────────────────
  // Activated when ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET and ENTRA_TENANT_ID are set.
  const entraClientId = process.env.ENTRA_CLIENT_ID;
  const entraClientSecret = process.env.ENTRA_CLIENT_SECRET;
  const entraTenantId = process.env.ENTRA_TENANT_ID;

  if (entraClientId && entraClientSecret && entraTenantId) {
    console.log("[Auth] Microsoft Entra ID (OIDC) enabled");

    // GET /api/auth/entra — redirect to Microsoft login
    app.get("/api/auth/entra", (req: Request, res: Response) => {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/entra/callback`;
      const state = Buffer.from(JSON.stringify({ origin: `${req.protocol}://${req.get("host")}` })).toString("base64url");
      const url = new URL(`https://login.microsoftonline.com/${entraTenantId}/oauth2/v2.0/authorize`);
      url.searchParams.set("client_id", entraClientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "openid profile email User.Read");
      url.searchParams.set("state", state);
      res.redirect(302, url.toString());
    });

    // GET /api/auth/entra/callback — handle Microsoft callback
    app.get("/api/auth/entra/callback", async (req: Request, res: Response) => {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({ error: "Authorization code missing" });
        return;
      }

      try {
        const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/entra/callback`;

        // Exchange code for tokens
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${entraTenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: entraClientId,
              client_secret: entraClientSecret,
              code,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
              scope: "openid profile email User.Read",
            }),
          }
        );

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          console.error("[Entra] Token exchange failed:", err);
          res.status(500).json({ error: "Token exchange failed" });
          return;
        }

        const tokens = await tokenRes.json() as any;

        // Get user profile from Microsoft Graph
        const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await graphRes.json() as any;

        const openId = `entra_${profile.id}`;
        const email = profile.mail ?? profile.userPrincipalName ?? null;
        const name = profile.displayName ?? null;

        const userCount = await db.countUsers();
        const role = userCount === 0 ? "admin" : "user";

        await db.upsertUser({
          openId,
          name,
          email,
          loginMethod: "entra",
          lastSignedIn: new Date(),
          role,
        });

        const user = await db.getUserByOpenId(openId);
        if (!user) throw new Error("Failed to create user from Entra");

        const sessionToken = await signLocalSession(user);
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
      } catch (error: any) {
        console.error("[Entra] Callback failed:", error);
        res.status(500).json({ error: "Entra authentication failed" });
      }
    });
  } else {
    console.log("[Auth] Microsoft Entra ID disabled (ENTRA_CLIENT_ID not set)");
  }

  // ─── Optional: Google OAuth 2.0 ──────────────────────────────────────────
  // Activated when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    console.log("[Auth] Google OAuth 2.0 enabled");

    // GET /api/auth/google — redirect to Google login
    app.get("/api/auth/google", (req: Request, res: Response) => {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
      const state = Buffer.from(JSON.stringify({ origin: `${req.protocol}://${req.get("host")}` })).toString("base64url");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", googleClientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "online");
      res.redirect(302, url.toString());
    });

    // GET /api/auth/google/callback — handle Google callback
    app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({ error: "Authorization code missing" });
        return;
      }

      try {
        const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          console.error("[Google] Token exchange failed:", err);
          res.status(500).json({ error: "Google token exchange failed" });
          return;
        }

        const tokens = await tokenRes.json() as any;

        // Get user profile from Google
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await profileRes.json() as any;

        const openId = `google_${profile.id}`;
        const email = profile.email ?? null;
        const name = profile.name ?? null;

        const userCount = await db.countUsers();
        const role = userCount === 0 ? "admin" : "user";

        await db.upsertUser({
          openId,
          name,
          email,
          loginMethod: "google",
          lastSignedIn: new Date(),
          role,
        });

        const user = await db.getUserByOpenId(openId);
        if (!user) throw new Error("Failed to create user from Google");

        const sessionToken = await signLocalSession(user);
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
      } catch (error: any) {
        console.error("[Google] Callback failed:", error);
        res.status(500).json({ error: "Google authentication failed" });
      }
    });
  } else {
    console.log("[Auth] Google OAuth 2.0 disabled (GOOGLE_CLIENT_ID not set)");
  }
}
