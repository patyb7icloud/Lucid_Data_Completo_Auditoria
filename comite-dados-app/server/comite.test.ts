import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@vc.com.br",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@vc.com.br");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("domains.list", () => {
  it("returns array", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.domains.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("participants.list", () => {
  it("returns array for authenticated user", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.participants.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("meetings.list", () => {
  it("returns array for authenticated user", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.meetings.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("raci.list", () => {
  it("returns array for authenticated user", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.raci.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("servicenow.list", () => {
  it("returns array for authenticated user", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.servicenow.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("metrics.dashboard", () => {
  it("returns dashboard metrics object", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.metrics.dashboard();
    expect(result).toHaveProperty("totalParticipants");
    expect(result).toHaveProperty("totalDomains");
    expect(result).toHaveProperty("totalMeetings");
    expect(result).toHaveProperty("confirmedInvites");
    expect(result).toHaveProperty("roleDistribution");
    expect(result).toHaveProperty("domainProgress");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1, openId: "u1", email: "u@vc.com", name: "U", loginMethod: "manus",
        role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: (name: string) => { cleared.push(name); } } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBeGreaterThan(0);
  });
});
