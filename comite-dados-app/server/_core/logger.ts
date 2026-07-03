import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

function sanitizeFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serializeError(value)]),
  );
}

export function createLogEntry(level: LogLevel, event: string, fields: LogFields = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "lucid-data-governance",
    ...sanitizeFields(fields),
  };
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = JSON.stringify(createLogEntry(level, event, fields));
  if (level === "error") {
    console.error(entry);
    return;
  }
  if (level === "warn") {
    console.warn(entry);
    return;
  }
  console.log(entry);
}

export const logger = {
  debug(event: string, fields?: LogFields) {
    write("debug", event, fields);
  },
  info(event: string, fields?: LogFields) {
    write("info", event, fields);
  },
  warn(event: string, fields?: LogFields) {
    write("warn", event, fields);
  },
  error(event: string, fields?: LogFields) {
    write("error", event, fields);
  },
};

export function shouldSkipRequestLog(pathname: string) {
  return pathname === "/api/health" || pathname === "/api/prometheus";
}

export function createRequestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const requestId = req.header("x-request-id") ?? randomUUID();
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      if (shouldSkipRequestLog(req.path)) return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const level: LogLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      write(level, "http.request_completed", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
    });

    next();
  };
}