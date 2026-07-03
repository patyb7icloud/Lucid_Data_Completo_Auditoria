import { describe, expect, it } from "vitest";
import { createLogEntry, shouldSkipRequestLog } from "./logger";

describe("logger", () => {
  it("serializa Error em campos estruturados", () => {
    const entry = createLogEntry("error", "sample.error", {
      error: new Error("boom"),
    });

    expect(entry.level).toBe("error");
    expect(entry.event).toBe("sample.error");
    expect(entry.error).toMatchObject({
      name: "Error",
      message: "boom",
    });
  });

  it("ignora logs ruidosos de health e prometheus", () => {
    expect(shouldSkipRequestLog("/api/health")).toBe(true);
    expect(shouldSkipRequestLog("/api/prometheus")).toBe(true);
    expect(shouldSkipRequestLog("/api/v1/assets")).toBe(false);
  });
});