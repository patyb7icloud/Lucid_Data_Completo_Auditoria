/**
 * passwordReset.ts
 * Módulo de recuperação de senha via e-mail.
 *
 * Rotas registradas:
 *   POST /api/auth/forgot-password  → gera token, envia e-mail
 *   POST /api/auth/reset-password   → valida token, atualiza senha
 */

import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb, getSystemSetting } from "./db";
import { passwordResetTokens, users } from "../drizzle/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import nodemailer from "nodemailer";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTransporter() {
  const [dbHost, dbPort, dbUser, dbPass] = await Promise.all([
    getSystemSetting("SMTP_HOST"),
    getSystemSetting("SMTP_PORT"),
    getSystemSetting("SMTP_USER"),
    getSystemSetting("SMTP_PASS"),
  ]);

  const host = dbHost || process.env.SMTP_HOST;
  const port = parseInt(dbPort || process.env.SMTP_PORT || "587", 10);
  const user = dbUser || process.env.SMTP_USER;
  const pass = dbPass || process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

function buildResetEmail(name: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de Senha</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1B3A8C;padding:32px 40px;text-align:center;">
              <h1 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                Lucid Data Governance
              </h1>
              <p style="color:#A5B4FC;margin:6px 0 0;font-size:13px;">
                Lucid Data Governance — Governança de Dados e IA
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="color:#374151;font-size:16px;margin:0 0 16px;">
                Olá, <strong>${name}</strong>!
              </p>
              <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Recebemos uma solicitação para redefinir a senha da sua conta na plataforma
                <strong>Lucid Data Governance</strong>. Clique no botão abaixo para criar uma nova senha.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#1B3A8C;color:#FFFFFF;text-decoration:none;
                          padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;
                          letter-spacing:0.3px;">
                  Redefinir minha senha
                </a>
              </div>
              <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0 0 8px;">
                Este link é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.
              </p>
              <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0;">
                Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha
                permanece inalterada.
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="color:#9CA3AF;font-size:12px;margin:0;">
                Lucid Data Governance — Plataforma de Governança de Dados e IA
              </p>
              <p style="color:#D1D5DB;font-size:11px;margin:6px 0 0;">
                Este é um e-mail automático. Não responda a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "E-mail obrigatório." });
  }

  try {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    // Busca o usuário pelo e-mail
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Resposta genérica para não revelar se o e-mail existe
    const genericResponse = {
      message:
        "Se este e-mail estiver cadastrado, você receberá as instruções em breve.",
    };

    if (!user) {
      return res.json(genericResponse);
    }

    // Gera token seguro de 64 bytes (128 hex chars)
    const token = crypto.randomBytes(64).toString("hex");

    // Expira em 1 hora
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Salva o token no banco
    await (db as NonNullable<typeof db>).insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Monta a URL de redefinição
    const origin =
      req.headers.origin ??
      process.env.APP_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`;
    const resetUrl = `${origin}/redefinir-senha?token=${token}`;

    // Envia o e-mail
    const transporter = await getTransporter();
    if (transporter) {
      const [dbFromEmail, dbFromName] = await Promise.all([
        getSystemSetting("SMTP_FROM_EMAIL"),
        getSystemSetting("SMTP_FROM_NAME"),
      ]);

      const fromEmail = dbFromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@example.com";
      const fromName = dbFromName || process.env.SMTP_FROM_NAME || "Lucid Data Governance VC";

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: user.email!,
        subject: "Redefinição de senha — Lucid Data Governance",
        html: buildResetEmail(user.name ?? "Usuário", resetUrl),
      });
    } else {
      // Em desenvolvimento sem SMTP configurado, loga a URL no console
      console.log(`[PasswordReset] Link de redefinição (sem SMTP): ${resetUrl}`);
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error("[PasswordReset] Erro em forgot-password:", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }

  try {
    const now = new Date();
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");

    // Busca o token válido (não expirado e não usado)
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, now),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetToken) {
      return res
        .status(400)
        .json({ error: "Link inválido ou expirado. Solicite um novo link." });
    }

    // Gera o hash da nova senha
    const passwordHash = await bcrypt.hash(password, 12);

    // Atualiza a senha do usuário
    await db.update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, resetToken.userId));

    // Marca o token como usado
    await db.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return res.json({ message: "Senha redefinida com sucesso. Faça login com a nova senha." });
  } catch (err) {
    console.error("[PasswordReset] Erro em reset-password:", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

export function registerPasswordResetRoutes(app: import("express").Application) {
  app.use("/api/auth", router);
}
