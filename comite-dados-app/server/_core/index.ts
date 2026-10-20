import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerLocalAuthRoutes } from "../localAuth";
import { registerPasswordResetRoutes } from "../passwordReset";
import { registerPublicApiV1 } from "../apiV1";
import { registerSamlRoutes } from "../samlAuth";
import { registerLdapRoutes } from "../ldapAuth";
import { appRouter } from "../routers";
import { createRequestLoggingMiddleware, logger } from "./logger";
import { securityHeaders, authRateLimit } from "../securityHeaders";
import { telemetryMiddleware, healthCheck, tryInitOpenTelemetry, renderPrometheusMetrics } from "../telemetry";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}
logger.info("server.starting", { nodeEnv: process.env.NODE_ENV });

import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startAttendanceScheduler, stopAttendanceScheduler } from "../attendanceScheduler";
import { startTicketAlertScheduler, stopTicketAlertScheduler } from "../ticketAlertScheduler";
import { startMetadataScheduler, stopMetadataScheduler } from "../metadataScheduler";
import { startSlaScheduler, stopSlaScheduler } from "../slaScheduler";
import { startProjectSyncScheduler, stopProjectSyncScheduler } from "../projectSyncScheduler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  let isShuttingDown = false;
  app.set("trust proxy", true);
  app.use(securityHeaders()); // OWASP security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(telemetryMiddleware()); // Métricas HTTP (latência, erros, throughput)
  app.use(createRequestLoggingMiddleware());
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Servir arquivos estáticos da pasta de uploads
  const uploadsPath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
  const absoluteUploadsPath = path.isAbsolute(uploadsPath) 
    ? uploadsPath 
    : path.join(process.cwd(), uploadsPath);
    
  if (!fs.existsSync(absoluteUploadsPath)) {
    fs.mkdirSync(absoluteUploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(absoluteUploadsPath));
  // Local auth routes: /api/auth/login, /api/auth/register, /api/auth/logout
  // Rate limit nas rotas de autenticação para prevenir brute-force (OWASP A07)
  app.use("/api/auth", authRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 }));
  registerLocalAuthRoutes(app);
  // Password reset routes: /api/auth/forgot-password, /api/auth/reset-password
  registerPasswordResetRoutes(app);
  // API REST pública v1: /api/v1/assets, /api/v1/glossary, etc.
  registerPublicApiV1(app);
  // SSO: SAML 2.0 (/api/auth/saml/*) e LDAP (/api/auth/ldap)
  registerSamlRoutes(app);
  registerLdapRoutes(app);
  // Observabilidade
  app.get("/api/health", healthCheck);
  app.get("/api/metrics", (_req, res) => {
    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(renderPrometheusMetrics());
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        console.error(`[tRPC Error] Error in path ${path}:`, error);
      }
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn("server.port_fallback", { preferredPort, port });
  }

  server.listen(port, () => {
    const publicUrl = process.env.APP_PUBLIC_URL || `http://localhost:${port}`;
    logger.info("server.ready", { port, url: `${publicUrl}/` });
    tryInitOpenTelemetry(); // Tenta inicializar OpenTelemetry (silencioso se não instalado)
    // Inicia o job de sincronização automática de presença do Teams
    startAttendanceScheduler();
    // Inicia o job de alerta diário de tickets de alta prioridade parados
    startTicketAlertScheduler();
    // Inicia o job de varredura automática de metadados (SAP, Snowflake)
    startMetadataScheduler();
    // Avalia diariamente os SLAs ativos, isolados por organização e com lock no banco.
    startSlaScheduler();
    // Processa somente sincronizações explicitamente enfileiradas para credenciais configuradas.
    startProjectSyncScheduler();
  });

  async function shutdown(signal: NodeJS.Signals) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.warn("server.shutdown_started", { signal });

    stopAttendanceScheduler();
    stopTicketAlertScheduler();
    stopMetadataScheduler();
    stopSlaScheduler();
    stopProjectSyncScheduler();

    await new Promise<void>((resolve) => {
      server.close((error) => {
        if (error) {
          logger.error("server.close_failed", { signal, error });
        }
        resolve();
      });
    });

    logger.info("server.shutdown_completed", { signal });
    process.exit(0);
  }

  process.once("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      logger.error("server.shutdown_failed", { signal: "SIGINT", error });
      process.exit(1);
    });
  });

  process.once("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      logger.error("server.shutdown_failed", { signal: "SIGTERM", error });
      process.exit(1);
    });
  });

  process.once("uncaughtException", (error) => {
    logger.error("process.uncaught_exception", { error });
  });

  process.once("unhandledRejection", (reason) => {
    logger.error("process.unhandled_rejection", { reason });
  });
}

startServer().catch((error) => {
  logger.error("server.start_failed", { error });
});
