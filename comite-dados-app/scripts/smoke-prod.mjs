import { spawn } from "child_process";

const port = Number(process.env.SMOKE_PORT || 4310);
const baseUrl = `http://127.0.0.1:${port}`;
const nodeBin = process.execPath;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // server still booting
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  const child = spawn(nodeBin, ["dist/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      JWT_SECRET: process.env.JWT_SECRET || "smoke-test-secret-12345",
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || "local",
      LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || ".smoke-uploads",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    const healthResponse = await waitForServer(`${baseUrl}/api/health`);
    const health = await healthResponse.json();
    if (!["ok", "healthy", "degraded"].includes(health.status)) {
      throw new Error(`Unexpected health status: ${health.status}`);
    }

    const openApiResponse = await fetch(`${baseUrl}/api/v1/openapi.json`);
    if (!openApiResponse.ok) {
      throw new Error(`OpenAPI endpoint failed with status ${openApiResponse.status}`);
    }
    const openApi = await openApiResponse.json();
    if (openApi.openapi !== "3.0.3") {
      throw new Error("OpenAPI document has unexpected version");
    }
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }

  if (!output.includes("server.shutdown_completed")) {
    throw new Error("Graceful shutdown log was not emitted during smoke test");
  }

  console.log(`Smoke test passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});