import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("system.health", () => {
  it("retorna ok para input válido", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.system.health({ timestamp: Date.now() });
    expect(result).toEqual({ ok: true });
  });
});