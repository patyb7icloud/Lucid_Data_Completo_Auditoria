import { execSync } from "child_process";

async function testFallback() {
  const vaultUrl = "https://key-vault-secrets.vault.azure.net";
  const secretName = "Databricks-AccessToken";

  console.log("Executando az account...");
  try {
    const stdout = execSync("az account get-access-token --resource https://vault.azure.net --output json", { encoding: "utf8" });
    const tokenData = JSON.parse(stdout);
    console.log("Token obtido! Fazendo request pro Key Vault...");
    
    let vaultClean = vaultUrl.trim().replace(/\/$/, "");
    const res = await fetch(`${vaultClean}/secrets/${secretName}?api-version=7.4`, {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log(`SUCESSO! Segredo length: ${data?.value?.length}`);
    } else {
      const errText = await res.text();
      console.error(`REST API FALHOU: ${res.status} - ${errText}`);
    }
  } catch (err: any) {
    console.error("ERRO NO FALLBACK:", err.message);
  }
}

testFallback();
